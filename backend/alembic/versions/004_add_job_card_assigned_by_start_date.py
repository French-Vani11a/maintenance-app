"""add assigned_by and start_date to service_job_cards

Revision ID: 004_add_job_card_assigned_by_start_date
Revises: 003_add_service_job_cards
Create Date: 2026-06-02 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '004_add_job_card_assigned_by_start_date'
down_revision = '003_add_service_job_cards'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('service_job_cards', sa.Column('assigned_by', sa.String(150), nullable=True))
    op.add_column('service_job_cards', sa.Column('start_date', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('service_job_cards', 'start_date')
    op.drop_column('service_job_cards', 'assigned_by')
