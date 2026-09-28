from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Any, Dict
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    admin = "admin"
    user = "user"


class RecordStatus(str, Enum):
    active = "active"
    archived = "archived"
    deleted = "deleted"


class OperationType(str, Enum):
    create = "create"
    update = "update"
    delete = "delete"


class SyncOpStatus(str, Enum):
    pending = "pending"
    synced = "synced"
    failed = "failed"
    conflict = "conflict"


class ResolutionStrategy(str, Enum):
    last_write_wins = "last_write_wins"
    server_wins = "server_wins"
    client_wins = "client_wins"
    manual = "manual"


# ── Auth ──────────────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: Optional[str] = None


class UserLogin(BaseModel):
    username: str
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None


class UserOut(BaseModel):
    id: str
    username: str
    email: str
    full_name: Optional[str]
    role: UserRole
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ── Records ───────────────────────────────────────────────────────────────────

class RecordCreate(BaseModel):
    id: Optional[str] = None          # client-generated UUID
    title: str = Field(..., min_length=1, max_length=255)
    content: Optional[str] = None
    tags: Optional[List[str]] = []
    status: Optional[RecordStatus] = RecordStatus.active


class RecordUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[str] = None
    tags: Optional[List[str]] = None
    status: Optional[RecordStatus] = None
    version: Optional[int] = None     # for optimistic concurrency


class RecordOut(BaseModel):
    id: str
    user_id: str
    title: str
    content: Optional[str]
    tags: Optional[List[str]]
    status: RecordStatus
    version: int
    is_deleted: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RecordListResponse(BaseModel):
    items: List[RecordOut]
    total: int
    page: int
    size: int


# ── Sync ──────────────────────────────────────────────────────────────────────

class SyncOperationIn(BaseModel):
    id: Optional[str] = None
    record_id: str
    operation: OperationType
    payload: Dict[str, Any]
    client_timestamp: datetime


class BulkSyncRequest(BaseModel):
    operations: List[SyncOperationIn]


class SyncOperationOut(BaseModel):
    id: str
    record_id: str
    operation: OperationType
    status: SyncOpStatus
    error_message: Optional[str]
    created_at: datetime
    synced_at: Optional[datetime]

    model_config = {"from_attributes": True}


class SyncResult(BaseModel):
    operation_id: str
    record_id: str
    status: str
    message: Optional[str] = None
    conflict_id: Optional[str] = None


class BulkSyncResponse(BaseModel):
    results: List[SyncResult]
    synced: int
    failed: int
    conflicts: int


# ── Sync History ──────────────────────────────────────────────────────────────

class SyncHistoryOut(BaseModel):
    id: str
    user_id: str
    record_id: Optional[str]
    operation: str
    status: str
    error_details: Optional[str]
    conflict_status: bool
    timestamp: datetime

    model_config = {"from_attributes": True}


class SyncHistoryList(BaseModel):
    items: List[SyncHistoryOut]
    total: int
    page: int
    size: int


# ── Conflicts ─────────────────────────────────────────────────────────────────

class ConflictOut(BaseModel):
    id: str
    record_id: str
    user_id: str
    client_data: Dict[str, Any]
    server_data: Dict[str, Any]
    resolution_strategy: Optional[ResolutionStrategy]
    resolved: bool
    resolved_data: Optional[Dict[str, Any]]
    created_at: datetime
    resolved_at: Optional[datetime]

    model_config = {"from_attributes": True}


class ConflictResolve(BaseModel):
    strategy: ResolutionStrategy
    manual_data: Optional[Dict[str, Any]] = None


class ConflictListResponse(BaseModel):
    items: List[ConflictOut]
    total: int
    page: int
    size: int


# ── Dashboard ─────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_records: int
    pending_changes: int
    synced_records: int
    failed_syncs: int
    unresolved_conflicts: int
    last_sync_time: Optional[datetime]
    sync_success_rate: float
