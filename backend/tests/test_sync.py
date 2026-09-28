"""Unit tests for synchronization and conflict-resolution logic."""
import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from app.services.sync_service import (
    _handle_create,
    _handle_update,
    _handle_delete,
    _apply_last_write_wins,
    process_bulk_sync,
)
from app.schemas.schemas import SyncOperationIn, OperationType
from app.models.models import Record


def make_op(op_type, record_id, payload, ts=None):
    return SyncOperationIn(
        id=None,
        record_id=record_id,
        operation=op_type,
        payload=payload,
        client_timestamp=ts or datetime.now(timezone.utc),
    )


# ── _apply_last_write_wins ────────────────────────────────────────────────────

def test_lww_applies_client_when_client_is_newer():
    record = MagicMock()
    record.updated_at = datetime(2024, 1, 1, 10, 0, 0, tzinfo=timezone.utc)
    client_ts = datetime(2024, 1, 1, 11, 0, 0, tzinfo=timezone.utc)
    _apply_last_write_wins(record, {"title": "New Title", "content": "C"}, client_ts)
    assert record.title == "New Title"
    assert record.content == "C"


def test_lww_keeps_server_when_server_is_newer():
    record = MagicMock()
    record.updated_at = datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    record.title = "Server Title"
    client_ts = datetime(2024, 1, 1, 10, 0, 0, tzinfo=timezone.utc)
    _apply_last_write_wins(record, {"title": "Old Client Title"}, client_ts)
    # title should NOT be overwritten since client_ts < server_ts
    assert record.title == "Server Title"


def test_lww_same_timestamp_applies_client():
    ts = datetime(2024, 1, 1, 10, 0, 0, tzinfo=timezone.utc)
    record = MagicMock()
    record.updated_at = ts
    record.title = "Server"
    _apply_last_write_wins(record, {"title": "Client"}, ts)
    assert record.title == "Client"


# ── _handle_create ────────────────────────────────────────────────────────────

def test_handle_create_new_record(tmp_db):
    op = make_op("create", "rec-001", {"title": "Hello", "content": "World"})
    result = _handle_create(tmp_db, op, "user-1", "op-001")
    assert result.status == "synced"
    record = tmp_db.query(Record).filter(Record.id == "rec-001").first()
    assert record is not None
    assert record.title == "Hello"


def test_handle_create_idempotent(tmp_db):
    op = make_op("create", "rec-002", {"title": "Dup"})
    _handle_create(tmp_db, op, "user-1", "op-002")
    result = _handle_create(tmp_db, op, "user-1", "op-002b")
    assert result.status == "synced"
    count = tmp_db.query(Record).filter(Record.id == "rec-002").count()
    assert count == 1


# ── _handle_update ────────────────────────────────────────────────────────────

def test_handle_update_no_conflict(tmp_db, sample_record):
    op = make_op("update", sample_record.id, {"title": "Updated", "version": 1})
    result = _handle_update(tmp_db, op, "user-1", "op-upd-1")
    assert result.status == "synced"
    tmp_db.refresh(sample_record)
    assert sample_record.title == "Updated"
    assert sample_record.version == 2


def test_handle_update_conflict_resolved_lww(tmp_db, sample_record):
    # Server is at version 3, client sends version 1 — conflict
    sample_record.version = 3
    tmp_db.commit()
    op = make_op("update", sample_record.id, {"title": "Client Version", "version": 1},
                 ts=datetime(2099, 1, 1, tzinfo=timezone.utc))  # client is newer → wins
    result = _handle_update(tmp_db, op, "user-1", "op-conflict")
    assert result.status == "synced"
    assert result.conflict_id is not None


def test_handle_update_record_not_found(tmp_db):
    op = make_op("update", "nonexistent", {"title": "X", "version": 1})
    result = _handle_update(tmp_db, op, "user-1", "op-miss")
    assert result.status == "failed"


# ── _handle_delete ────────────────────────────────────────────────────────────

def test_handle_delete(tmp_db, sample_record):
    op = make_op("delete", sample_record.id, {})
    result = _handle_delete(tmp_db, op, "user-1", "op-del")
    assert result.status == "synced"
    tmp_db.refresh(sample_record)
    assert sample_record.is_deleted is True


def test_handle_delete_missing(tmp_db):
    op = make_op("delete", "ghost", {})
    result = _handle_delete(tmp_db, op, "user-1", "op-del-ghost")
    assert result.status == "synced"  # idempotent


# ── conftest helpers ──────────────────────────────────────────────────────────

@pytest.fixture
def tmp_db():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.db.database import Base

    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    yield db
    db.close()


@pytest.fixture
def sample_record(tmp_db):
    from app.models.models import User
    user = User(id="user-1", username="tester", email="t@t.com", hashed_password="x")
    tmp_db.add(user)
    record = Record(id="rec-100", user_id="user-1", title="Original", content="Body", version=1)
    tmp_db.add(record)
    tmp_db.commit()
    tmp_db.refresh(record)
    return record
