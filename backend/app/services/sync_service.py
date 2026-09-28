import uuid
from datetime import datetime, timezone
from typing import List
from sqlalchemy.orm import Session
from app.models.models import Record, LocalSyncOperation, SyncHistory, Conflict
from app.schemas.schemas import SyncOperationIn, SyncResult


def process_bulk_sync(db: Session, operations: List[SyncOperationIn], user_id: str) -> List[SyncResult]:
    results: List[SyncResult] = []
    for op in operations:
        result = _process_single_op(db, op, user_id)
        results.append(result)
    return results


def _process_single_op(db: Session, op: SyncOperationIn, user_id: str) -> SyncResult:
    op_id = op.id or str(uuid.uuid4())

    # Idempotency check – if already synced, return success
    existing = db.query(LocalSyncOperation).filter(
        LocalSyncOperation.id == op_id,
        LocalSyncOperation.status == "synced",
    ).first()
    if existing:
        return SyncResult(operation_id=op_id, record_id=op.record_id, status="synced", message="Already synced")

    # Persist the operation record
    sync_op = db.query(LocalSyncOperation).filter(LocalSyncOperation.id == op_id).first()
    if not sync_op:
        sync_op = LocalSyncOperation(
            id=op_id,
            user_id=user_id,
            record_id=op.record_id,
            operation=op.operation,
            payload=op.payload,
            client_timestamp=op.client_timestamp,
        )
        db.add(sync_op)
        db.flush()

    try:
        if op.operation == "create":
            result = _handle_create(db, op, user_id, op_id)
        elif op.operation == "update":
            result = _handle_update(db, op, user_id, op_id)
        elif op.operation == "delete":
            result = _handle_delete(db, op, user_id, op_id)
        else:
            result = SyncResult(operation_id=op_id, record_id=op.record_id, status="failed", message="Unknown operation")

        if result.status == "synced":
            sync_op.status = "synced"
            sync_op.synced_at = datetime.now(timezone.utc)
            _history(db, user_id, op.record_id, op.operation, "success")
        elif result.status == "conflict":
            sync_op.status = "conflict"
            _history(db, user_id, op.record_id, op.operation, "conflict", conflict_status=True)
        else:
            sync_op.status = "failed"
            sync_op.error_message = result.message
            _history(db, user_id, op.record_id, op.operation, "failed", error=result.message)

        db.commit()
        return result

    except Exception as e:
        db.rollback()
        sync_op.status = "failed"
        sync_op.retry_count += 1
        sync_op.error_message = str(e)
        db.commit()
        _history(db, user_id, op.record_id, op.operation, "failed", error=str(e))
        return SyncResult(operation_id=op_id, record_id=op.record_id, status="failed", message=str(e))


def _handle_create(db: Session, op: SyncOperationIn, user_id: str, op_id: str) -> SyncResult:
    existing = db.query(Record).filter(Record.id == op.record_id).first()
    if existing:
        return SyncResult(operation_id=op_id, record_id=op.record_id, status="synced", message="Record already exists")
    payload = op.payload
    record = Record(
        id=op.record_id,
        user_id=user_id,
        title=payload.get("title", "Untitled"),
        content=payload.get("content"),
        tags=payload.get("tags", []),
        status=payload.get("status", "active"),
        version=1,
    )
    db.add(record)
    db.flush()
    return SyncResult(operation_id=op_id, record_id=op.record_id, status="synced")


def _handle_update(db: Session, op: SyncOperationIn, user_id: str, op_id: str) -> SyncResult:
    record = db.query(Record).filter(Record.id == op.record_id, Record.user_id == user_id).first()
    if not record:
        return SyncResult(operation_id=op_id, record_id=op.record_id, status="failed", message="Record not found")

    payload = op.payload
    client_version = payload.get("version", 1)

    # Conflict detection: server version is ahead of client base
    if record.version > client_version:
        conflict = Conflict(
            record_id=op.record_id,
            user_id=user_id,
            client_data=payload,
            server_data={
                "id": record.id, "title": record.title, "content": record.content,
                "tags": record.tags, "status": record.status, "version": record.version,
                "updated_at": record.updated_at.isoformat() if record.updated_at else None,
            },
            resolution_strategy="last_write_wins",
        )
        # Apply last-write-wins automatically
        _apply_last_write_wins(record, payload, op.client_timestamp)
        conflict.resolved = True
        conflict.resolved_data = {
            "title": record.title, "content": record.content,
            "tags": record.tags, "status": record.status,
        }
        conflict.resolved_at = datetime.now(timezone.utc)
        db.add(conflict)
        db.flush()
        return SyncResult(
            operation_id=op_id, record_id=op.record_id,
            status="synced", message="Conflict resolved via last-write-wins",
            conflict_id=conflict.id,
        )

    # No conflict: apply update
    if payload.get("title") is not None:
        record.title = payload["title"]
    if "content" in payload:
        record.content = payload["content"]
    if "tags" in payload:
        record.tags = payload["tags"]
    if "status" in payload:
        record.status = payload["status"]
    record.version += 1
    record.updated_at = datetime.now(timezone.utc)
    db.flush()
    return SyncResult(operation_id=op_id, record_id=op.record_id, status="synced")


def _handle_delete(db: Session, op: SyncOperationIn, user_id: str, op_id: str) -> SyncResult:
    record = db.query(Record).filter(Record.id == op.record_id, Record.user_id == user_id).first()
    if not record:
        return SyncResult(operation_id=op_id, record_id=op.record_id, status="synced", message="Already deleted")
    record.is_deleted = True
    record.status = "deleted"
    record.deleted_at = datetime.now(timezone.utc)
    db.flush()
    return SyncResult(operation_id=op_id, record_id=op.record_id, status="synced")


def _apply_last_write_wins(record: Record, payload: dict, client_ts: datetime):
    """Apply client data if client timestamp is newer than server updated_at."""
    server_ts = record.updated_at
    if server_ts and server_ts.tzinfo is None:
        server_ts = server_ts.replace(tzinfo=timezone.utc)
    if client_ts.tzinfo is None:
        client_ts = client_ts.replace(tzinfo=timezone.utc)

    if client_ts >= server_ts:
        if payload.get("title") is not None:
            record.title = payload["title"]
        if "content" in payload:
            record.content = payload["content"]
        if "tags" in payload:
            record.tags = payload["tags"]
        if "status" in payload:
            record.status = payload["status"]

    record.version += 1
    record.updated_at = datetime.now(timezone.utc)


def _history(db: Session, user_id: str, record_id: str, operation: str, status: str, error: str = None, conflict_status: bool = False):
    db.add(SyncHistory(
        user_id=user_id,
        record_id=record_id,
        operation=operation,
        status=status,
        error_details=error,
        conflict_status=conflict_status,
    ))


def resolve_conflict(db: Session, conflict_id: str, strategy: str, manual_data: dict, user_id: str) -> Conflict:
    from fastapi import HTTPException
    conflict = db.query(Conflict).filter(Conflict.id == conflict_id, Conflict.user_id == user_id).first()
    if not conflict:
        raise HTTPException(status_code=404, detail="Conflict not found")
    if conflict.resolved:
        raise HTTPException(status_code=400, detail="Conflict already resolved")

    record = db.query(Record).filter(Record.id == conflict.record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    if strategy == "server_wins":
        resolved_data = conflict.server_data
    elif strategy == "client_wins":
        resolved_data = conflict.client_data
    elif strategy == "manual" and manual_data:
        resolved_data = manual_data
    else:
        resolved_data = conflict.server_data

    record.title = resolved_data.get("title", record.title)
    record.content = resolved_data.get("content", record.content)
    record.tags = resolved_data.get("tags", record.tags)
    record.status = resolved_data.get("status", record.status)
    record.version += 1
    record.updated_at = datetime.now(timezone.utc)

    conflict.resolved = True
    conflict.resolution_strategy = strategy
    conflict.resolved_data = resolved_data
    conflict.resolved_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(conflict)
    return conflict
