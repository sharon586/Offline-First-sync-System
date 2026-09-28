from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.db.database import get_db
from app.schemas.schemas import RecordCreate, RecordUpdate, RecordOut, RecordListResponse
from app.services.record_service import get_records, get_record, create_record, update_record, delete_record
from app.core.deps import get_current_user
from app.models.models import User

router = APIRouter(prefix="/records", tags=["Records"])


@router.get("", response_model=RecordListResponse)
def list_records(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("updated_at"),
    sort_order: str = Query("desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items, total = get_records(db, current_user.id, search, status, page, size, sort_by, sort_order)
    return RecordListResponse(items=items, total=total, page=page, size=size)


@router.post("", response_model=RecordOut, status_code=201)
def create(data: RecordCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return create_record(db, data, current_user.id)


@router.get("/{record_id}", response_model=RecordOut)
def read(record_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_record(db, record_id, current_user.id)


@router.put("/{record_id}", response_model=RecordOut)
def update(record_id: str, data: RecordUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return update_record(db, record_id, data, current_user.id)


@router.delete("/{record_id}", status_code=204)
def delete(record_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    delete_record(db, record_id, current_user.id)
