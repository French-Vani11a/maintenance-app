"""add slicer fields to maintenance records

Revision ID: 006_add_slicer_fields
Revises: 005_add_record_type
Create Date: 2026-06-26 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '006_add_slicer_fields'
down_revision = '005_add_record_type'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('maintenance_records', sa.Column('is_slicer', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('maintenance_records', sa.Column('prev_hr_meter', sa.Float(), nullable=True))
    op.add_column('maintenance_records', sa.Column('curr_hr_meter', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('maintenance_records', 'curr_hr_meter')
    op.drop_column('maintenance_records', 'prev_hr_meter')
    op.drop_column('maintenance_records', 'is_slicer')
