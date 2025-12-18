"""Security utilities for input validation and SSRF prevention."""
import re
import ipaddress
from urllib.parse import urlparse
from typing import Optional
from fastapi import HTTPException


def is_private_ip(ip_str: str) -> bool:
    """Check if an IP address is private/internal."""
    try:
        ip = ipaddress.ip_address(ip_str)
        return ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved
    except ValueError:
        return False


def validate_url_safe(url: str, allow_private: bool = False) -> str:
    """
    Validate URL to prevent SSRF attacks.

    Args:
        url: The URL to validate
        allow_private: Whether to allow private/internal IPs (default: False)

    Returns:
        The validated URL

    Raises:
        HTTPException: If the URL is invalid or points to a private network
    """
    try:
        parsed = urlparse(url)

        # Validate scheme
        if parsed.scheme not in ('http', 'https'):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid URL scheme: {parsed.scheme}. Only http and https are allowed."
            )

        # Validate hostname exists
        if not parsed.hostname:
            raise HTTPException(status_code=400, detail="URL must include a hostname")

        # Check for localhost variations
        localhost_patterns = ['localhost', '127.', '0.0.0.0', '::1', '0:0:0:0:0:0:0:1']
        if any(pattern in parsed.hostname.lower() for pattern in localhost_patterns):
            if not allow_private:
                raise HTTPException(
                    status_code=400,
                    detail="Access to localhost is not allowed"
                )

        # Check for private IPs
        if not allow_private:
            # Try to resolve hostname to IP
            hostname = parsed.hostname.lower()

            # Check if hostname is an IP address
            try:
                if is_private_ip(hostname):
                    raise HTTPException(
                        status_code=400,
                        detail="Access to private IP addresses is not allowed"
                    )
            except ValueError:
                # Not an IP address, check for metadata service endpoints
                metadata_endpoints = [
                    '169.254.169.254',  # AWS/Azure/GCP metadata
                    'metadata.google.internal',
                    '100.100.100.200',  # Alibaba Cloud
                ]
                if hostname in metadata_endpoints:
                    raise HTTPException(
                        status_code=400,
                        detail="Access to cloud metadata services is not allowed"
                    )

        return url

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid URL: {str(e)}")


def validate_kubernetes_name(name: str, field_name: str = "name") -> str:
    """
    Validate Kubernetes resource name.

    Args:
        name: The name to validate
        field_name: Field name for error messages

    Returns:
        The validated name

    Raises:
        HTTPException: If the name is invalid
    """
    # Kubernetes names must be DNS-1123 subdomain names
    # - contain only lowercase alphanumeric characters, '-' or '.'
    # - start with an alphanumeric character
    # - end with an alphanumeric character
    # - be at most 253 characters

    if not name:
        raise HTTPException(status_code=400, detail=f"{field_name} cannot be empty")

    if len(name) > 253:
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} must be at most 253 characters"
        )

    if not re.match(r'^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$', name):
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} must be a valid Kubernetes name (lowercase alphanumeric, '-', '.')"
        )

    return name


def sanitize_log_input(value: str, max_length: int = 500) -> str:
    """
    Sanitize user input before logging to prevent log injection.

    Args:
        value: The value to sanitize
        max_length: Maximum length to log

    Returns:
        Sanitized string safe for logging
    """
    if not isinstance(value, str):
        value = str(value)

    # Remove newlines and control characters that could be used for log injection
    sanitized = re.sub(r'[\r\n\t\x00-\x1f\x7f-\x9f]', ' ', value)

    # Truncate to max length
    if len(sanitized) > max_length:
        sanitized = sanitized[:max_length] + "..."

    return sanitized


def validate_path_safe(path: str, allowed_base_paths: Optional[list] = None) -> str:
    """
    Validate file path to prevent path traversal attacks.

    Args:
        path: The path to validate
        allowed_base_paths: List of allowed base paths (optional)

    Returns:
        The validated path

    Raises:
        HTTPException: If the path contains path traversal attempts
    """
    # Check for path traversal patterns
    dangerous_patterns = ['..', '~', '${', '$ENV']

    for pattern in dangerous_patterns:
        if pattern in path:
            raise HTTPException(
                status_code=400,
                detail=f"Path contains dangerous pattern: {pattern}"
            )

    # If allowed base paths specified, ensure path starts with one of them
    if allowed_base_paths:
        if not any(path.startswith(base) for base in allowed_base_paths):
            raise HTTPException(
                status_code=400,
                detail="Path is outside allowed directories"
            )

    return path


def validate_shell_command(command: str) -> str:
    """
    Validate shell command for dangerous patterns.

    Args:
        command: The command to validate

    Returns:
        The validated command

    Raises:
        HTTPException: If the command contains dangerous patterns
    """
    # Check for dangerous patterns
    dangerous_patterns = [
        r'\brm\s+-rf\s+/',  # rm -rf /
        r'\bdd\s+if=',  # dd commands
        r'>\s*/dev/sd',  # Writing to disk devices
        r'\bformat\s+',  # format commands
        r'\bmkfs\.',  # filesystem creation
        r':\(\)\{\s*:\|:&\s*\};:',  # Fork bomb
        r'\bcurl\s+.*\|\s*bash',  # Pipe to bash
        r'\bwget\s+.*\|\s*sh',  # Pipe to shell
    ]

    for pattern in dangerous_patterns:
        if re.search(pattern, command, re.IGNORECASE):
            raise HTTPException(
                status_code=400,
                detail=f"Command contains dangerous pattern"
            )

    return command
