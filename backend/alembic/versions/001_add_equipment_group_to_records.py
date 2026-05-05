"""add equipment_group_id to maintenance_records

Revision ID: 001_add_equip_group
Revises: 
Create Date: 2026-05-05 10:30:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '001_add_equip_group'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('maintenance_records', sa.Column('equipment_group_id', sa.Integer(), sa.ForeignKey('equipment_groups.id'), nullable=True, index=True))


def downgrade() -> None:
    op.drop_column('maintenance_records', 'equipment_group_id')