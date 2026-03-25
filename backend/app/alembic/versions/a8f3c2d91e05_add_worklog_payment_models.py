"""Add worklog payment models

Revision ID: a8f3c2d91e05
Revises: 1a31ce608336
Create Date: 2026-03-25 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = 'a8f3c2d91e05'
down_revision = '1a31ce608336'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'freelancer',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column('email', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column('hourly_rate', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_freelancer_email', 'freelancer', ['email'], unique=True)
    op.create_index('ix_freelancer_name', 'freelancer', ['name'], unique=False)

    op.create_table(
        'task',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('title', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(length=1000), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_task_title', 'task', ['title'], unique=False)

    op.create_table(
        'payment',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('date_from', sa.Date(), nullable=False),
        sa.Column('date_to', sa.Date(), nullable=False),
        sa.Column('total_amt', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_payment_created_at', 'payment', ['created_at'], unique=False)

    op.create_table(
        'worklog',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('task_id', sa.UUID(), nullable=False),
        sa.Column('freelancer_id', sa.UUID(), nullable=False),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
        sa.Column('payment_id', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['freelancer_id'], ['freelancer.id']),
        sa.ForeignKeyConstraint(['payment_id'], ['payment.id']),
        sa.ForeignKeyConstraint(['task_id'], ['task.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_worklog_created_at', 'worklog', ['created_at'], unique=False)
    op.create_index('ix_worklog_payment_id', 'worklog', ['payment_id'], unique=False)
    op.create_index('ix_worklog_status', 'worklog', ['status'], unique=False)

    op.create_table(
        'time_entry',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('worklog_id', sa.UUID(), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(length=1000), nullable=False),
        sa.Column('hours', sa.Numeric(precision=6, scale=2), nullable=False),
        sa.Column('entry_date', sa.Date(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['worklog_id'], ['worklog.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_time_entry_entry_date', 'time_entry', ['entry_date'], unique=False)
    op.create_index('ix_time_entry_worklog_id', 'time_entry', ['worklog_id'], unique=False)


def downgrade():
    op.drop_index('ix_time_entry_worklog_id', table_name='time_entry')
    op.drop_index('ix_time_entry_entry_date', table_name='time_entry')
    op.drop_table('time_entry')

    op.drop_index('ix_worklog_status', table_name='worklog')
    op.drop_index('ix_worklog_payment_id', table_name='worklog')
    op.drop_index('ix_worklog_created_at', table_name='worklog')
    op.drop_table('worklog')

    op.drop_index('ix_payment_created_at', table_name='payment')
    op.drop_table('payment')

    op.drop_index('ix_task_title', table_name='task')
    op.drop_table('task')

    op.drop_index('ix_freelancer_name', table_name='freelancer')
    op.drop_index('ix_freelancer_email', table_name='freelancer')
    op.drop_table('freelancer')
