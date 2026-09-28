import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Boolean, DateTime, Enum, ForeignKey,
    JSON, Integer, Index
)
from sqlalchemy.orm import relationship
from app.db.database import Base


def utcnow():
    return datetime.now(timezone.utc)


def new_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=new_uuid)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100))
    role = Column(Enum("admin", "user", name="user_role"), default="user")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    records = relationship("Record", back_populates="owner", cascade="all, delete-orphan")
    sync_operations = relationship("LocalSyncOperation", back_populates="user", cascade="all, delete-orphan")
    sync_history = relationship("SyncHistory", back_populates="user", cascade="all, delete-orphan")


class Record(Base):
    __tablename__ = "records"

    id = Column(String(36), primary_key=True, default=new_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text)
    tags = Column(JSON, default=list)
    status = Column(Enum("active", "archived", "deleted", name="record_status"), default="active")
    version = Column(Integer, default=1)
    is_deleted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    deleted_at = Column(DateTime, nullable=True)

    owner = relationship("User", back_populates="records")
    sync_history = relationship("SyncHistory", back_populates="record")
    conflicts = relationship("Conflict", back_populates="record", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="record", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_records_user_status", "user_id", "status"),
        Index("ix_records_user_deleted", "user_id", "is_deleted"),
    )


class LocalSyncOperation(Base):
    __tablename__ = "local_sync_operations"

    id = Column(String(36), primary_key=True, default=new_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    record_id = Column(String(36), nullable=False, index=True)
    operation = Column(Enum("create", "update", "delete", name="operation_type"), nullable=False)
    payload = Column(JSON, nullable=False)
    client_timestamp = Column(DateTime, nullable=False)
    status = Column(
        Enum("pending", "synced", "failed", "conflict", name="sync_op_status"),
        default="pending",
        index=True,
    )
    retry_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    synced_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="sync_operations")

    __table_args__ = (
        Index("ix_local_sync_user_status", "user_id", "status"),
    )


class SyncHistory(Base):
    __tablename__ = "sync_history"

    id = Column(String(36), primary_key=True, default=new_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    record_id = Column(String(36), ForeignKey("records.id", ondelete="SET NULL"), nullable=True, index=True)
    operation = Column(Enum("create", "update", "delete", name="history_op_type"), nullable=False)
    status = Column(
        Enum("success", "failed", "conflict", name="sync_history_status"),
        nullable=False,
        index=True,
    )
    error_details = Column(Text, nullable=True)
    conflict_status = Column(Boolean, default=False)
    timestamp = Column(DateTime, default=utcnow, index=True)

    user = relationship("User", back_populates="sync_history")
    record = relationship("Record", back_populates="sync_history")

    __table_args__ = (
        Index("ix_sync_history_user_time", "user_id", "timestamp"),
    )


class Conflict(Base):
    __tablename__ = "conflicts"

    id = Column(String(36), primary_key=True, default=new_uuid)
    record_id = Column(String(36), ForeignKey("records.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), nullable=False, index=True)
    client_data = Column(JSON, nullable=False)
    server_data = Column(JSON, nullable=False)
    resolution_strategy = Column(
        Enum("last_write_wins", "server_wins", "client_wins", "manual", name="resolution_type"),
        nullable=True,
    )
    resolved = Column(Boolean, default=False, index=True)
    resolved_data = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    resolved_at = Column(DateTime, nullable=True)

    record = relationship("Record", back_populates="conflicts")

    __table_args__ = (
        Index("ix_conflicts_record_resolved", "record_id", "resolved"),
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=new_uuid)
    user_id = Column(String(36), nullable=False, index=True)
    record_id = Column(String(36), ForeignKey("records.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(50), nullable=False)
    old_data = Column(JSON, nullable=True)
    new_data = Column(JSON, nullable=True)
    ip_address = Column(String(45), nullable=True)
    timestamp = Column(DateTime, default=utcnow, index=True)

    record = relationship("Record", back_populates="audit_logs")
