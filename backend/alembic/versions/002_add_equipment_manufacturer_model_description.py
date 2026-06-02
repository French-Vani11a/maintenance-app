"""add manufacturer, model_number, description to equipment

Revision ID: 002_add_equipment_fields
Revises: 001_add_equip_group
Create Date: 2026-06-02 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '002_add_equipment_fields'
down_revision = '001_add_equip_group'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('equipment', sa.Column('manufacturer', sa.String(200), nullable=True))
    op.add_column('equipment', sa.Column('model_number', sa.String(100), nullable=True))
    op.add_column('equipment', sa.Column('description', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('equipment', 'description')
    op.drop_column('equipment', 'model_number')
    op.drop_column('equipment', 'manufacturer')
