"""add service_job_cards table and enhance service_history

Revision ID: 003_add_service_job_cards
Revises: 002_add_equipment_fields
Create Date: 2026-06-02 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '003_add_service_job_cards'
down_revision = '002_add_equipment_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'service_job_cards',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('job_card_number', sa.String(30), nullable=False),
        sa.Column('equipment_id', sa.Integer(), sa.ForeignKey('equipment.id'), nullable=False),
        sa.Column('plant_id', sa.Integer(), sa.ForeignKey('plants.id'), nullable=True),
        sa.Column('service_type', sa.String(100), nullable=True),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('service_description', sa.Text(), nullable=True),
        sa.Column('work_to_be_done', sa.Text(), nullable=True),
        sa.Column('assigned_artisan', sa.String(150), nullable=True),
        sa.Column('parts_required', sa.Text(), nullable=True),
        sa.Column('priority', sa.String(20), nullable=False, server_default='medium'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='open'),
        sa.Column('completed_date', sa.Date(), nullable=True),
        sa.Column('created_by_user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('job_card_number'),
    )
    op.create_index('ix_service_job_cards_id', 'service_job_cards', ['id'])
    op.create_index('ix_service_job_cards_job_card_number', 'service_job_cards', ['job_card_number'])
    op.create_index('ix_service_job_cards_equipment_id', 'service_job_cards', ['equipment_id'])

    op.add_column('service_history', sa.Column('work_done', sa.Text(), nullable=True))
    op.add_column('service_history', sa.Column('parts_used', sa.Text(), nullable=True))
    op.add_column('service_history', sa.Column('job_card_id', sa.Integer(), sa.ForeignKey('service_job_cards.id'), nullable=True))


def downgrade() -> None:
    op.drop_column('service_history', 'job_card_id')
    op.drop_column('service_history', 'parts_used')
    op.drop_column('service_history', 'work_done')
    op.drop_index('ix_service_job_cards_equipment_id', 'service_job_cards')
    op.drop_index('ix_service_job_cards_job_card_number', 'service_job_cards')
    op.drop_index('ix_service_job_cards_id', 'service_job_cards')
    op.drop_table('service_job_cards')
