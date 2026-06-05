"""add record_type to maintenance_records

Revision ID: 005_add_record_type
Revises: 004_add_job_card_assigned_by_start_date
Create Date: 2026-06-02 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '005_add_record_type'
down_revision = '004_add_job_card_assigned_by_start_date'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'maintenance_records',
        sa.Column('record_type', sa.String(20), nullable=False, server_default='regular'),
    )
    op.create_index('ix_maintenance_records_record_type', 'maintenance_records', ['record_type'])


def downgrade() -> None:
    op.drop_index('ix_maintenance_records_record_type', 'maintenance_records')
    op.drop_column('maintenance_records', 'record_type')
