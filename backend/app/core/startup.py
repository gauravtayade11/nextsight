"""
Production startup validation and initialization.
Validates configuration and performs security checks before the app starts.
"""

import logging
import os
import sys
from dataclasses import dataclass
from enum import Enum
from typing import List, Optional

logger = logging.getLogger(__name__)


class ValidationSeverity(Enum):
    """Severity level for validation issues."""
    CRITICAL = "critical"  # App should not start
    WARNING = "warning"    # App can start but issue should be fixed
    INFO = "info"          # Informational only


@dataclass
class ValidationResult:
    """Result of a single validation check."""
    name: str
    passed: bool
    severity: ValidationSeverity
    message: str
    recommendation: Optional[str] = None


class StartupValidator:
    """Validates application configuration for production readiness."""

    def __init__(self, settings):
        self.settings = settings
        self.results: List[ValidationResult] = []

    def validate_all(self) -> bool:
        """Run all validation checks. Returns True if no critical issues."""
        self._validate_secret_key()
        self._validate_admin_password()
        self._validate_database()
        self._validate_cors()
        self._validate_debug_mode()
        self._validate_api_keys()
        self._validate_redis()
        self._validate_oauth()

        return self._report_results()

    def _add_result(
        self,
        name: str,
        passed: bool,
        severity: ValidationSeverity,
        message: str,
        recommendation: Optional[str] = None,
    ):
        self.results.append(
            ValidationResult(
                name=name,
                passed=passed,
                severity=severity,
                message=message,
                recommendation=recommendation,
            )
        )

    def _validate_secret_key(self):
        """Ensure SECRET_KEY is properly configured."""
        secret_key = getattr(self.settings, "SECRET_KEY", "")

        # Check for default/weak keys
        weak_keys = [
            "your-secret-key-change-in-production",
            "secret",
            "changeme",
            "password",
            "123456",
        ]

        if not secret_key:
            self._add_result(
                "SECRET_KEY",
                False,
                ValidationSeverity.CRITICAL,
                "SECRET_KEY is not set",
                "Generate a secure key: python -c \"import secrets; print(secrets.token_urlsafe(64))\"",
            )
        elif secret_key.lower() in weak_keys or len(secret_key) < 32:
            self._add_result(
                "SECRET_KEY",
                False,
                ValidationSeverity.CRITICAL,
                "SECRET_KEY is weak or default value",
                "Generate a secure key: python -c \"import secrets; print(secrets.token_urlsafe(64))\"",
            )
        else:
            self._add_result(
                "SECRET_KEY",
                True,
                ValidationSeverity.INFO,
                "SECRET_KEY is properly configured",
            )

    def _validate_admin_password(self):
        """Ensure default admin password is changed in production."""
        admin_password = getattr(self.settings, "DEFAULT_ADMIN_PASSWORD", "admin123")
        debug = getattr(self.settings, "DEBUG", False)

        # Check for default/weak passwords
        weak_passwords = [
            "admin123",
            "admin",
            "password",
            "123456",
            "changeme",
        ]

        if admin_password.lower() in weak_passwords:
            if debug:
                self._add_result(
                    "ADMIN_PASSWORD",
                    True,
                    ValidationSeverity.WARNING,
                    "Using default admin password (acceptable in DEBUG mode)",
                    "Set DEFAULT_ADMIN_PASSWORD env var for production",
                )
            else:
                self._add_result(
                    "ADMIN_PASSWORD",
                    False,
                    ValidationSeverity.WARNING,
                    "Using default/weak admin password",
                    "Generate secure password: python -c \"import secrets; print(secrets.token_urlsafe(16))\"",
                )
        else:
            self._add_result(
                "ADMIN_PASSWORD",
                True,
                ValidationSeverity.INFO,
                "Admin password is customized",
            )

    def _validate_database(self):
        """Validate database configuration."""
        db_url = getattr(self.settings, "DATABASE_URL", "")
        use_db = getattr(self.settings, "USE_DATABASE_AUTH", False)

        if use_db:
            if not db_url:
                self._add_result(
                    "DATABASE",
                    False,
                    ValidationSeverity.CRITICAL,
                    "DATABASE_URL not set but USE_DATABASE_AUTH is enabled",
                    "Set DATABASE_URL environment variable",
                )
            elif "sqlite" in db_url.lower():
                self._add_result(
                    "DATABASE",
                    True,
                    ValidationSeverity.WARNING,
                    "Using SQLite database - not recommended for production",
                    "Use PostgreSQL for production deployments",
                )
            elif "localhost" in db_url or "127.0.0.1" in db_url:
                self._add_result(
                    "DATABASE",
                    True,
                    ValidationSeverity.WARNING,
                    "Database is configured to localhost",
                    "Ensure this is intentional for your deployment",
                )
            else:
                self._add_result(
                    "DATABASE",
                    True,
                    ValidationSeverity.INFO,
                    "Database is configured",
                )
        else:
            self._add_result(
                "DATABASE",
                True,
                ValidationSeverity.WARNING,
                "Using in-memory authentication (USE_DATABASE_AUTH=false)",
                "Enable database authentication for production",
            )

    def _validate_cors(self):
        """Validate CORS configuration."""
        cors_origins = getattr(self.settings, "CORS_ORIGINS", "")
        debug = getattr(self.settings, "DEBUG", False)

        if cors_origins == "*" and not debug:
            self._add_result(
                "CORS",
                False,
                ValidationSeverity.WARNING,
                "CORS allows all origins in non-debug mode",
                "Restrict CORS_ORIGINS to specific domains",
            )
        elif not cors_origins:
            self._add_result(
                "CORS",
                True,
                ValidationSeverity.INFO,
                "No CORS origins configured",
            )
        else:
            self._add_result(
                "CORS",
                True,
                ValidationSeverity.INFO,
                f"CORS configured with specific origins",
            )

    def _validate_debug_mode(self):
        """Validate debug mode is disabled for production."""
        debug = getattr(self.settings, "DEBUG", False)
        demo_mode = getattr(self.settings, "DEMO_MODE", False)

        if debug:
            self._add_result(
                "DEBUG_MODE",
                False,
                ValidationSeverity.WARNING,
                "DEBUG mode is enabled",
                "Set DEBUG=false for production",
            )
        else:
            self._add_result(
                "DEBUG_MODE",
                True,
                ValidationSeverity.INFO,
                "DEBUG mode is disabled",
            )

        if demo_mode:
            self._add_result(
                "DEMO_MODE",
                False,
                ValidationSeverity.WARNING,
                "DEMO_MODE is enabled - some security features may be relaxed",
                "Set DEMO_MODE=false for production",
            )

    def _validate_api_keys(self):
        """Validate API keys are set for enabled services."""
        gemini_key = getattr(self.settings, "GEMINI_API_KEY", "")
        anthropic_key = getattr(self.settings, "ANTHROPIC_API_KEY", "")
        github_token = getattr(self.settings, "GITHUB_TOKEN", "")

        if not gemini_key and not anthropic_key:
            self._add_result(
                "AI_PROVIDER",
                True,
                ValidationSeverity.INFO,
                "No AI provider API key configured - AI features disabled",
                "Set GEMINI_API_KEY or ANTHROPIC_API_KEY to enable AI features",
            )
        else:
            self._add_result(
                "AI_PROVIDER",
                True,
                ValidationSeverity.INFO,
                "AI provider configured",
            )

        if not github_token:
            self._add_result(
                "GITHUB",
                True,
                ValidationSeverity.INFO,
                "No GitHub token configured - GitHub integration disabled",
            )

    def _validate_redis(self):
        """Validate Redis configuration."""
        redis_url = getattr(self.settings, "REDIS_URL", "")
        use_redis = getattr(self.settings, "USE_REDIS_CACHE", False)

        if use_redis and not redis_url:
            self._add_result(
                "REDIS",
                False,
                ValidationSeverity.WARNING,
                "USE_REDIS_CACHE is enabled but REDIS_URL is not set",
                "Set REDIS_URL or disable USE_REDIS_CACHE",
            )
        elif use_redis:
            self._add_result(
                "REDIS",
                True,
                ValidationSeverity.INFO,
                "Redis cache is configured",
            )
        else:
            self._add_result(
                "REDIS",
                True,
                ValidationSeverity.INFO,
                "Using in-memory cache (Redis disabled)",
            )

    def _validate_oauth(self):
        """Validate OAuth configuration."""
        oauth_providers = []

        if getattr(self.settings, "GOOGLE_CLIENT_ID", ""):
            oauth_providers.append("Google")
        if getattr(self.settings, "GITHUB_CLIENT_ID", ""):
            oauth_providers.append("GitHub")
        if getattr(self.settings, "GITLAB_CLIENT_ID", ""):
            oauth_providers.append("GitLab")

        if oauth_providers:
            self._add_result(
                "OAUTH",
                True,
                ValidationSeverity.INFO,
                f"OAuth providers configured: {', '.join(oauth_providers)}",
            )
        else:
            self._add_result(
                "OAUTH",
                True,
                ValidationSeverity.INFO,
                "No OAuth providers configured",
            )

    def _report_results(self) -> bool:
        """Report validation results and return True if no critical issues."""
        critical_count = 0
        warning_count = 0

        logger.info("=" * 60)
        logger.info("STARTUP VALIDATION RESULTS")
        logger.info("=" * 60)

        for result in self.results:
            status = "PASS" if result.passed else "FAIL"
            icon = "+" if result.passed else "!" if result.severity == ValidationSeverity.WARNING else "X"

            if result.severity == ValidationSeverity.CRITICAL and not result.passed:
                critical_count += 1
                logger.error(f"[{icon}] {result.name}: {result.message}")
                if result.recommendation:
                    logger.error(f"    Recommendation: {result.recommendation}")
            elif result.severity == ValidationSeverity.WARNING and not result.passed:
                warning_count += 1
                logger.warning(f"[{icon}] {result.name}: {result.message}")
                if result.recommendation:
                    logger.warning(f"    Recommendation: {result.recommendation}")
            else:
                logger.info(f"[{icon}] {result.name}: {result.message}")

        logger.info("=" * 60)
        logger.info(
            f"Validation complete: {len(self.results)} checks, "
            f"{critical_count} critical, {warning_count} warnings"
        )
        logger.info("=" * 60)

        if critical_count > 0:
            logger.critical(
                f"STARTUP BLOCKED: {critical_count} critical issue(s) must be resolved"
            )
            return False

        return True


def validate_production_config(settings, strict: bool = False) -> bool:
    """
    Validate configuration for production.

    Args:
        settings: Application settings object
        strict: If True, treat warnings as critical

    Returns:
        True if validation passes, False otherwise
    """
    validator = StartupValidator(settings)
    passed = validator.validate_all()

    if strict:
        warnings = sum(
            1 for r in validator.results
            if not r.passed and r.severity == ValidationSeverity.WARNING
        )
        if warnings > 0:
            logger.error(f"Strict mode: {warnings} warning(s) treated as critical")
            return False

    return passed


def run_startup_checks(settings, block_on_failure: bool = True) -> bool:
    """
    Run all startup checks and optionally block if they fail.

    Args:
        settings: Application settings object
        block_on_failure: If True, exit the application on critical failures

    Returns:
        True if all checks pass
    """
    is_production = not getattr(settings, "DEBUG", False)

    logger.info(f"Running startup checks (production={is_production})")

    # Validate configuration
    config_valid = validate_production_config(settings, strict=False)

    if not config_valid and block_on_failure and is_production:
        logger.critical("Application startup blocked due to configuration issues")
        logger.critical("Set DEBUG=true to bypass these checks (not recommended)")
        sys.exit(1)

    return config_valid


# =============================================================================
# Environment Detection
# =============================================================================

def get_environment() -> str:
    """Detect the current environment."""
    env = os.environ.get("ENVIRONMENT", os.environ.get("ENV", "development"))
    return env.lower()


def is_production() -> bool:
    """Check if running in production environment."""
    return get_environment() in ("production", "prod")


def is_development() -> bool:
    """Check if running in development environment."""
    return get_environment() in ("development", "dev", "local")


def is_testing() -> bool:
    """Check if running in test environment."""
    return get_environment() in ("test", "testing", "ci")
