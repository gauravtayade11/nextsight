"""Add test results and coverage tables

Revision ID: 005_test_coverage
Revises: 004_agents_execution
Create Date: 2024-12-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '005_test_coverage'
down_revision: Union[str, None] = '004_agents_execution'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # Check if pipeline_test_results table exists
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'pipeline_test_results')"
    )).scalar()

    if not result:
        # Create pipeline_test_results table
        conn.execute(sa.text("""
            CREATE TABLE pipeline_test_results (
                id VARCHAR(36) PRIMARY KEY,
                run_id VARCHAR(36) NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
                stage_id VARCHAR(36) REFERENCES pipeline_stages(id) ON DELETE SET NULL,

                -- Test framework info
                framework VARCHAR(50) NOT NULL DEFAULT 'other',
                test_file_pattern VARCHAR(255),

                -- Test counts
                total_tests INTEGER NOT NULL DEFAULT 0,
                passed_tests INTEGER NOT NULL DEFAULT 0,
                failed_tests INTEGER NOT NULL DEFAULT 0,
                skipped_tests INTEGER NOT NULL DEFAULT 0,
                error_tests INTEGER NOT NULL DEFAULT 0,

                -- Timing
                duration_seconds FLOAT,
                pass_rate FLOAT NOT NULL DEFAULT 0.0,

                -- Details (JSON arrays)
                test_details JSONB DEFAULT '[]'::jsonb,
                failed_test_names JSONB DEFAULT '[]'::jsonb,

                -- Report URLs
                report_url VARCHAR(500),
                junit_xml_url VARCHAR(500),

                -- Timestamps
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
        """))
        conn.execute(sa.text("CREATE INDEX ix_pipeline_test_results_run_id ON pipeline_test_results (run_id)"))
        conn.execute(sa.text("CREATE INDEX ix_pipeline_test_results_stage_id ON pipeline_test_results (stage_id)"))
        conn.execute(sa.text("CREATE INDEX ix_pipeline_test_results_framework ON pipeline_test_results (framework)"))

    # Check if pipeline_coverage table exists
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'pipeline_coverage')"
    )).scalar()

    if not result:
        # Create pipeline_coverage table
        conn.execute(sa.text("""
            CREATE TABLE pipeline_coverage (
                id VARCHAR(36) PRIMARY KEY,
                run_id VARCHAR(36) NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
                stage_id VARCHAR(36) REFERENCES pipeline_stages(id) ON DELETE SET NULL,

                -- Coverage tool info
                coverage_tool VARCHAR(50) DEFAULT 'unknown',

                -- Coverage percentages
                line_coverage FLOAT,
                branch_coverage FLOAT,
                statement_coverage FLOAT,
                function_coverage FLOAT,

                -- Line counts
                total_lines INTEGER,
                covered_lines INTEGER,
                missing_lines INTEGER,

                -- Branch counts
                total_branches INTEGER,
                covered_branches INTEGER,

                -- File-level coverage (JSON)
                file_coverage JSONB DEFAULT '{}'::jsonb,
                lowest_coverage_files JSONB DEFAULT '[]'::jsonb,

                -- Report URLs
                report_url VARCHAR(500),
                lcov_url VARCHAR(500),

                -- Change from previous run
                coverage_change FLOAT,

                -- Timestamps
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
        """))
        conn.execute(sa.text("CREATE INDEX ix_pipeline_coverage_run_id ON pipeline_coverage (run_id)"))
        conn.execute(sa.text("CREATE INDEX ix_pipeline_coverage_stage_id ON pipeline_coverage (stage_id)"))

    # Check if coverage_trends table exists
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'coverage_trends')"
    )).scalar()

    if not result:
        # Create coverage_trends table
        conn.execute(sa.text("""
            CREATE TABLE coverage_trends (
                id VARCHAR(36) PRIMARY KEY,
                pipeline_id VARCHAR(36) NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
                run_id VARCHAR(36) REFERENCES pipeline_runs(id) ON DELETE SET NULL,

                -- Trend data
                recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                branch VARCHAR(100) NOT NULL DEFAULT 'main',

                -- Coverage metrics
                line_coverage FLOAT,
                branch_coverage FLOAT,

                -- Test metrics
                total_tests INTEGER,
                passed_tests INTEGER,
                test_pass_rate FLOAT,

                -- Timestamps
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
        """))
        conn.execute(sa.text("CREATE INDEX ix_coverage_trends_pipeline_id ON coverage_trends (pipeline_id)"))
        conn.execute(sa.text("CREATE INDEX ix_coverage_trends_branch ON coverage_trends (branch)"))
        conn.execute(sa.text("CREATE INDEX ix_coverage_trends_recorded_at ON coverage_trends (recorded_at)"))


def downgrade() -> None:
    conn = op.get_bind()

    # Drop tables in reverse order
    conn.execute(sa.text("DROP TABLE IF EXISTS coverage_trends"))
    conn.execute(sa.text("DROP TABLE IF EXISTS pipeline_coverage"))
    conn.execute(sa.text("DROP TABLE IF EXISTS pipeline_test_results"))
