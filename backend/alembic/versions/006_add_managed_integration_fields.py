"""Add managed integration fields

Revision ID: 006_managed_integration
Revises: 005_test_coverage
Create Date: 2024-12-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '006_managed_integration'
down_revision: Union[str, None] = '005_test_coverage'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # Check if integrations table exists
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'integrations')"
    )).scalar()

    if result:
        # Check if is_managed column exists
        col_exists = conn.execute(sa.text("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_name = 'integrations' AND column_name = 'is_managed'
            )
        """)).scalar()

        if not col_exists:
            conn.execute(sa.text("""
                ALTER TABLE integrations
                ADD COLUMN is_managed BOOLEAN NOT NULL DEFAULT false
            """))

        # Check if setup_url column exists
        col_exists = conn.execute(sa.text("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_name = 'integrations' AND column_name = 'setup_url'
            )
        """)).scalar()

        if not col_exists:
            conn.execute(sa.text("""
                ALTER TABLE integrations
                ADD COLUMN setup_url VARCHAR(200)
            """))


def downgrade() -> None:
    conn = op.get_bind()

    # Check if integrations table exists before dropping columns
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'integrations')"
    )).scalar()

    if result:
        conn.execute(sa.text("ALTER TABLE integrations DROP COLUMN IF EXISTS is_managed"))
        conn.execute(sa.text("ALTER TABLE integrations DROP COLUMN IF EXISTS setup_url"))
