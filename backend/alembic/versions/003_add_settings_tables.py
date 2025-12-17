"""Add settings, integrations, and API token tables

Revision ID: 003_settings_tables
Revises: 002_oauth_fields
Create Date: 2024-12-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM

# revision identifiers, used by Alembic.
revision: str = '003_settings_tables'
down_revision: Union[str, None] = '002_oauth_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # Create enums using raw SQL with DO block for idempotency
    conn.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE integrationcategory AS ENUM ('source-control', 'ci-cd', 'monitoring', 'logging', 'cloud', 'notification');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """))

    conn.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE integrationstatus AS ENUM ('connected', 'disconnected', 'error');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """))

    # Check if integrations table exists
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'integrations')"
    )).scalar()

    if not result:
        # Create integrations table using raw SQL
        conn.execute(sa.text("""
            CREATE TABLE integrations (
                id VARCHAR(36) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description VARCHAR(500),
                icon VARCHAR(50),
                category integrationcategory NOT NULL,
                status integrationstatus NOT NULL DEFAULT 'disconnected',
                config JSONB,
                auto_sync BOOLEAN NOT NULL DEFAULT true,
                sync_interval_seconds INTEGER NOT NULL DEFAULT 300,
                last_sync TIMESTAMP WITH TIME ZONE,
                last_error TEXT,
                health_check_url VARCHAR(500),
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
        """))
        conn.execute(sa.text("CREATE INDEX ix_integrations_name ON integrations (name)"))

    # Check if api_tokens table exists
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'api_tokens')"
    )).scalar()

    if not result:
        # Create api_tokens table
        conn.execute(sa.text("""
            CREATE TABLE api_tokens (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                token_hash VARCHAR(255) NOT NULL,
                prefix VARCHAR(20) NOT NULL,
                scopes JSONB,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                last_used TIMESTAMP WITH TIME ZONE,
                is_revoked BOOLEAN NOT NULL DEFAULT false,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
        """))
        conn.execute(sa.text("CREATE INDEX ix_api_tokens_user_id ON api_tokens (user_id)"))
        conn.execute(sa.text("CREATE INDEX ix_api_tokens_hash ON api_tokens (token_hash)"))

    # Check if user_settings table exists
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_settings')"
    )).scalar()

    if not result:
        # Create user_settings table
        conn.execute(sa.text("""
            CREATE TABLE user_settings (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                theme VARCHAR(20) NOT NULL DEFAULT 'system',
                notifications JSONB,
                default_namespace VARCHAR(100) NOT NULL DEFAULT 'default',
                auto_refresh BOOLEAN NOT NULL DEFAULT true,
                refresh_interval_seconds INTEGER NOT NULL DEFAULT 30,
                timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
                date_format VARCHAR(20) NOT NULL DEFAULT 'YYYY-MM-DD',
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
        """))
        conn.execute(sa.text("CREATE INDEX ix_user_settings_user_id ON user_settings (user_id)"))


def downgrade() -> None:
    op.execute('DROP TABLE IF EXISTS user_settings')
    op.execute('DROP TABLE IF EXISTS api_tokens')
    op.execute('DROP TABLE IF EXISTS integrations')
    op.execute('DROP TYPE IF EXISTS integrationstatus')
    op.execute('DROP TYPE IF EXISTS integrationcategory')
