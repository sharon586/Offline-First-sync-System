from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.db.database import get_db
from app.schemas.schemas import (
    BulkSyncRequest, BulkSyncResponse,
    SyncHistoryList, SyncHistoryOut,
    ConflictOut, ConflictResolve, ConflictListResponse,
    DashboardStats,
)
from app.services.sync_service import process_bulk_sync, resolve_conflict
from app.models.models import LocalSyncOperation, SyncHistory, Conflict, Record
from app.core.deps import get_current_user
from app.models.models import User

router = APIRouter(prefix="/sync", tags=["Synchronization"])


@router.post("/bulk", response_model=BulkSyncResponse)
def bulk_sync(body: BulkSyncRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    results = process_bulk_sync(db, body.operations, current_user.id)
    synced = sum(1 for r in results if r.status == "synced")
    failed = sum(1 for r in results if r.status == "failed")
    conflicts = sum(1 for r in results if r.conflict_id)
    return BulkSyncResponse(results=results, synced=synced, failed=failed, conflicts=conflicts)


@router.get("/history", response_model=SyncHistoryList)
def sync_history(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(SyncHistory).filter(SyncHistory.user_id == current_user.id)
    if status:
        query = query.filter(SyncHistory.status == status)
    total = query.count()
    items = query.order_by(SyncHistory.timestamp.desc()).offset((page - 1) * size).limit(size).all()
    return SyncHistoryList(items=items, total=total, page=page, size=size)


@router.get("/conflicts", response_model=ConflictListResponse)
def list_conflicts(
    resolved: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Conflict).filter(Conflict.user_id == current_user.id)
    if resolved is not None:
        query = query.filter(Conflict.resolved == resolved)
    total = query.count()
    items = query.order_by(Conflict.created_at.desc()).offset((page - 1) * size).limit(size).all()
    return ConflictListResponse(items=items, total=total, page=page, size=size)


@router.post("/conflicts/{conflict_id}/resolve", response_model=ConflictOut)
def resolve(
    conflict_id: str,
    body: ConflictResolve,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return resolve_conflict(db, conflict_id, body.strategy, body.manual_data or {}, current_user.id)


@router.get("/dashboard", response_model=DashboardStats)
def dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    uid = current_user.id
    total_records = db.query(Record).filter(Record.user_id == uid, Record.is_deleted == False).count()
    pending = db.query(LocalSyncOperation).filter(LocalSyncOperation.user_id == uid, LocalSyncOperation.status == "pending").count()
    synced = db.query(SyncHistory).filter(SyncHistory.user_id == uid, SyncHistory.status == "success").count()
    failed = db.query(SyncHistory).filter(SyncHistory.user_id == uid, SyncHistory.status == "failed").count()
    unresolved_conflicts = db.query(Conflict).filter(Conflict.user_id == uid, Conflict.resolved == False).count()
    last_sync = db.query(SyncHistory).filter(SyncHistory.user_id == uid, SyncHistory.status == "success").order_by(SyncHistory.timestamp.desc()).first()
    total_ops = synced + failed
    success_rate = (synced / total_ops * 100) if total_ops > 0 else 0.0
    return DashboardStats(
        total_records=total_records,
        pending_changes=pending,
        synced_records=synced,
        failed_syncs=failed,
        unresolved_conflicts=unresolved_conflicts,
        last_sync_time=last_sync.timestamp if last_sync else None,
        sync_success_rate=round(success_rate, 2),
    )
