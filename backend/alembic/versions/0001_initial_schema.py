"""initial schema

Revision ID: 0001
Revises:
Create Date: 2024-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("username", sa.String(50), unique=True, nullable=False),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(100)),
        sa.Column("role", sa.Enum("admin", "user", name="user_role"), default="user"),
        sa.Column("is_active", sa.Boolean, default=True),
        sa.Column("created_at", sa.DateTime),
        sa.Column("updated_at", sa.DateTime),
    )
    op.create_index("ix_users_username", "users", ["username"])
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "records",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("content", sa.Text),
        sa.Column("tags", sa.JSON),
        sa.Column("status", sa.Enum("active", "archived", "deleted", name="record_status"), default="active"),
        sa.Column("version", sa.Integer, default=1),
        sa.Column("is_deleted", sa.Boolean, default=False),
        sa.Column("created_at", sa.DateTime),
        sa.Column("updated_at", sa.DateTime),
        sa.Column("deleted_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_records_user_id", "records", ["user_id"])
    op.create_index("ix_records_user_status", "records", ["user_id", "status"])

    op.create_table(
        "local_sync_operations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("record_id", sa.String(36), nullable=False),
        sa.Column("operation", sa.Enum("create", "update", "delete", name="operation_type"), nullable=False),
        sa.Column("payload", sa.JSON, nullable=False),
        sa.Column("client_timestamp", sa.DateTime, nullable=False),
        sa.Column("status", sa.Enum("pending", "synced", "failed", "conflict", name="sync_op_status"), default="pending"),
        sa.Column("retry_count", sa.Integer, default=0),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime),
        sa.Column("synced_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_local_sync_user_id", "local_sync_operations", ["user_id"])
    op.create_index("ix_local_sync_status", "local_sync_operations", ["status"])

    op.create_table(
        "sync_history",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("record_id", sa.String(36), sa.ForeignKey("records.id", ondelete="SET NULL"), nullable=True),
        sa.Column("operation", sa.Enum("create", "update", "delete", name="history_op_type"), nullable=False),
        sa.Column("status", sa.Enum("success", "failed", "conflict", name="sync_history_status"), nullable=False),
        sa.Column("error_details", sa.Text, nullable=True),
        sa.Column("conflict_status", sa.Boolean, default=False),
        sa.Column("timestamp", sa.DateTime),
    )
    op.create_index("ix_sync_history_user_id", "sync_history", ["user_id"])
    op.create_index("ix_sync_history_timestamp", "sync_history", ["timestamp"])

    op.create_table(
        "conflicts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("record_id", sa.String(36), sa.ForeignKey("records.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("client_data", sa.JSON, nullable=False),
        sa.Column("server_data", sa.JSON, nullable=False),
        sa.Column("resolution_strategy", sa.Enum("last_write_wins", "server_wins", "client_wins", "manual", name="resolution_type"), nullable=True),
        sa.Column("resolved", sa.Boolean, default=False),
        sa.Column("resolved_data", sa.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime),
        sa.Column("resolved_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_conflicts_record_id", "conflicts", ["record_id"])
    op.create_index("ix_conflicts_resolved", "conflicts", ["resolved"])

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("record_id", sa.String(36), sa.ForeignKey("records.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("old_data", sa.JSON, nullable=True),
        sa.Column("new_data", sa.JSON, nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("timestamp", sa.DateTime),
    )
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.create_index("ix_audit_logs_timestamp", "audit_logs", ["timestamp"])


def downgrade():
    op.drop_table("audit_logs")
    op.drop_table("conflicts")
    op.drop_table("sync_history")
    op.drop_table("local_sync_operations")
    op.drop_table("records")
    op.drop_table("users")
