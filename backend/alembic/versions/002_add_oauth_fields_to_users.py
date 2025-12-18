"""Add OAuth authentication fields to users table

Revision ID: 002_oauth_fields
Revises: 078b9fb1e2f9
Create Date: 2024-12-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '002_oauth_fields'
down_revision: Union[str, None] = '078b9fb1e2f9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create auth_provider enum
    auth_provider_enum = sa.Enum('local', 'google', 'github', 'gitlab', name='authprovider')
    auth_provider_enum.create(op.get_bind(), checkfirst=True)

    # Make password_hash nullable (OAuth users don't have passwords)
    op.alter_column(
        'users',
        'password_hash',
        existing_type=sa.String(255),
        nullable=True
    )

    # Add OAuth-specific columns
    op.add_column(
        'users',
        sa.Column('auth_provider', auth_provider_enum, nullable=True)
    )

    op.add_column(
        'users',
        sa.Column('oauth_provider_id', sa.String(255), nullable=True)
    )

    op.add_column(
        'users',
        sa.Column('avatar_url', sa.String(500), nullable=True)
    )

    # Set default auth_provider for existing users
    op.execute("UPDATE users SET auth_provider = 'local' WHERE auth_provider IS NULL")

    # Make auth_provider non-nullable after setting defaults
    op.alter_column(
        'users',
        'auth_provider',
        nullable=False,
        server_default='local'
    )

    # Create unique constraint for OAuth users (provider + provider_id)
    op.create_unique_constraint(
        'uq_oauth_provider_user',
        'users',
        ['auth_provider', 'oauth_provider_id']
    )

    # Create index for OAuth lookups
    op.create_index(
        'ix_users_oauth',
        'users',
        ['auth_provider', 'oauth_provider_id']
    )


def downgrade() -> None:
    # Drop index and constraint
    op.drop_index('ix_users_oauth', table_name='users')
    op.drop_constraint('uq_oauth_provider_user', 'users', type_='unique')

    # Drop OAuth columns
    op.drop_column('users', 'avatar_url')
    op.drop_column('users', 'oauth_provider_id')
    op.drop_column('users', 'auth_provider')

    # Make password_hash non-nullable again
    op.alter_column(
        'users',
        'password_hash',
        existing_type=sa.String(255),
        nullable=False
    )

    # Drop the enum type
    op.execute('DROP TYPE IF EXISTS authprovider')
