import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import or_
from fastapi import HTTPException
from app.models.models import Record, AuditLog
from app.schemas.schemas import RecordCreate, RecordUpdate


def get_records(
    db: Session,
    user_id: str,
    search: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    size: int = 20,
    sort_by: str = "updated_at",
    sort_order: str = "desc",
):
    query = db.query(Record).filter(Record.user_id == user_id, Record.is_deleted == False)
    if search:
        query = query.filter(or_(Record.title.ilike(f"%{search}%"), Record.content.ilike(f"%{search}%")))
    if status:
        query = query.filter(Record.status == status)

    sort_col = getattr(Record, sort_by, Record.updated_at)
    query = query.order_by(sort_col.desc() if sort_order == "desc" else sort_col.asc())

    total = query.count()
    items = query.offset((page - 1) * size).limit(size).all()
    return items, total


def get_record(db: Session, record_id: str, user_id: str) -> Record:
    record = db.query(Record).filter(Record.id == record_id, Record.user_id == user_id, Record.is_deleted == False).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


def create_record(db: Session, data: RecordCreate, user_id: str) -> Record:
    record_id = data.id or str(uuid.uuid4())
    existing = db.query(Record).filter(Record.id == record_id).first()
    if existing:
        return existing
    record = Record(
        id=record_id,
        user_id=user_id,
        title=data.title,
        content=data.content,
        tags=data.tags or [],
        status=data.status or "active",
        version=1,
    )
    db.add(record)
    _audit(db, user_id, record_id, "create", None, {"title": data.title})
    db.commit()
    db.refresh(record)
    return record


def update_record(db: Session, record_id: str, data: RecordUpdate, user_id: str) -> Record:
    record = get_record(db, record_id, user_id)
    if data.version is not None and data.version != record.version:
        raise HTTPException(status_code=409, detail="Version conflict")
    old = {"title": record.title, "content": record.content, "version": record.version}
    if data.title is not None:
        record.title = data.title
    if data.content is not None:
        record.content = data.content
    if data.tags is not None:
        record.tags = data.tags
    if data.status is not None:
        record.status = data.status
    record.version += 1
    record.updated_at = datetime.now(timezone.utc)
    _audit(db, user_id, record_id, "update", old, {"title": record.title, "version": record.version})
    db.commit()
    db.refresh(record)
    return record


def delete_record(db: Session, record_id: str, user_id: str):
    record = get_record(db, record_id, user_id)
    record.is_deleted = True
    record.status = "deleted"
    record.deleted_at = datetime.now(timezone.utc)
    _audit(db, user_id, record_id, "delete", None, None)
    db.commit()


def _audit(db: Session, user_id: str, record_id: str, action: str, old: Optional[dict], new: Optional[dict]):
    db.add(AuditLog(user_id=user_id, record_id=record_id, action=action, old_data=old, new_data=new))
