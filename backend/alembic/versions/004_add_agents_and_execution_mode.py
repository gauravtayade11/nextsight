"""Add pipeline agents and execution mode support

Revision ID: 004_agents_execution
Revises: 003_settings_tables
Create Date: 2024-12-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '004_agents_execution'
down_revision: Union[str, None] = '003_settings_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # Create execution_mode enum
    conn.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE executionmode AS ENUM ('local', 'kubernetes', 'agent');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """))

    # Create agent_status enum
    conn.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE agentstatus AS ENUM ('online', 'offline', 'busy', 'maintenance');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """))

    # Check if pipeline_agents table exists
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'pipeline_agents')"
    )).scalar()

    if not result:
        # Create pipeline_agents table
        conn.execute(sa.text("""
            CREATE TABLE pipeline_agents (
                id VARCHAR(36) PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                description TEXT,

                -- Connection info
                host VARCHAR(255) NOT NULL,
                port INTEGER NOT NULL DEFAULT 8080,
                api_key VARCHAR(255),
                ssh_user VARCHAR(100),
                ssh_key_id VARCHAR(36),

                -- Agent status
                status agentstatus NOT NULL DEFAULT 'offline',
                last_heartbeat TIMESTAMP WITH TIME ZONE,
                version VARCHAR(50),

                -- Capabilities
                labels JSONB DEFAULT '[]'::jsonb,
                max_concurrent_jobs INTEGER NOT NULL DEFAULT 2,
                current_jobs INTEGER NOT NULL DEFAULT 0,

                -- System info
                os_type VARCHAR(50),
                os_version VARCHAR(100),
                cpu_cores INTEGER,
                memory_gb FLOAT,
                disk_gb FLOAT,

                -- Workspace configuration
                workspace_path VARCHAR(500) NOT NULL DEFAULT '/tmp/nexops-agent',
                docker_available BOOLEAN NOT NULL DEFAULT false,
                kubernetes_available BOOLEAN NOT NULL DEFAULT false,

                -- Pool assignment
                pool VARCHAR(100) NOT NULL DEFAULT 'default',

                -- Statistics
                total_jobs INTEGER NOT NULL DEFAULT 0,
                successful_jobs INTEGER NOT NULL DEFAULT 0,
                failed_jobs INTEGER NOT NULL DEFAULT 0,
                avg_job_duration_seconds INTEGER NOT NULL DEFAULT 0,

                -- Timestamps
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
        """))
        conn.execute(sa.text("CREATE INDEX ix_pipeline_agents_status ON pipeline_agents (status)"))
        conn.execute(sa.text("CREATE INDEX ix_pipeline_agents_pool ON pipeline_agents (pool)"))
        conn.execute(sa.text("CREATE INDEX ix_pipeline_agents_name ON pipeline_agents (name)"))

    # Check if agent_job_assignments table exists
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'agent_job_assignments')"
    )).scalar()

    if not result:
        # Create agent_job_assignments table
        conn.execute(sa.text("""
            CREATE TABLE agent_job_assignments (
                id VARCHAR(36) PRIMARY KEY,
                agent_id VARCHAR(36) REFERENCES pipeline_agents(id) ON DELETE SET NULL,
                run_id VARCHAR(36) NOT NULL UNIQUE REFERENCES pipeline_runs(id) ON DELETE CASCADE,

                -- Assignment info
                assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                started_at TIMESTAMP WITH TIME ZONE,
                completed_at TIMESTAMP WITH TIME ZONE,

                -- Remote execution details
                remote_workspace VARCHAR(500),
                remote_log_path VARCHAR(500),

                -- Timestamps
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
        """))
        conn.execute(sa.text("CREATE INDEX ix_agent_job_assignments_agent_id ON agent_job_assignments (agent_id)"))
        conn.execute(sa.text("CREATE INDEX ix_agent_job_assignments_run_id ON agent_job_assignments (run_id)"))

    # Add execution_mode column to pipelines table if it doesn't exist
    result = conn.execute(sa.text("""
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_name = 'pipelines' AND column_name = 'execution_mode'
        )
    """)).scalar()

    if not result:
        conn.execute(sa.text("""
            ALTER TABLE pipelines
            ADD COLUMN execution_mode executionmode DEFAULT 'local'
        """))
        conn.execute(sa.text("""
            ALTER TABLE pipelines
            ADD COLUMN preferred_agent_id VARCHAR(36)
        """))
        conn.execute(sa.text("""
            ALTER TABLE pipelines
            ADD COLUMN kubernetes_namespace VARCHAR(100)
        """))

    # Add execution_mode column to pipeline_runs table if it doesn't exist
    result = conn.execute(sa.text("""
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_name = 'pipeline_runs' AND column_name = 'execution_mode'
        )
    """)).scalar()

    if not result:
        conn.execute(sa.text("""
            ALTER TABLE pipeline_runs
            ADD COLUMN execution_mode executionmode DEFAULT 'local'
        """))
        conn.execute(sa.text("""
            ALTER TABLE pipeline_runs
            ADD COLUMN agent_id VARCHAR(36)
        """))


def downgrade() -> None:
    conn = op.get_bind()

    # Remove columns from pipeline_runs
    conn.execute(sa.text("ALTER TABLE pipeline_runs DROP COLUMN IF EXISTS execution_mode"))
    conn.execute(sa.text("ALTER TABLE pipeline_runs DROP COLUMN IF EXISTS agent_id"))

    # Remove columns from pipelines
    conn.execute(sa.text("ALTER TABLE pipelines DROP COLUMN IF EXISTS execution_mode"))
    conn.execute(sa.text("ALTER TABLE pipelines DROP COLUMN IF EXISTS preferred_agent_id"))
    conn.execute(sa.text("ALTER TABLE pipelines DROP COLUMN IF EXISTS kubernetes_namespace"))

    # Drop tables
    conn.execute(sa.text("DROP TABLE IF EXISTS agent_job_assignments"))
    conn.execute(sa.text("DROP TABLE IF EXISTS pipeline_agents"))

    # Drop enums
    conn.execute(sa.text("DROP TYPE IF EXISTS agentstatus"))
    conn.execute(sa.text("DROP TYPE IF EXISTS executionmode"))
