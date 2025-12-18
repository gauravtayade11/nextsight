# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.3.x   | :white_check_mark: |
| 1.2.x   | :white_check_mark: |
| 1.1.x   | :x:                |
| < 1.1   | :x:                |

## Reporting a Vulnerability

We take the security of NextSight seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Please DO NOT

- Open a public GitHub issue for security vulnerabilities
- Disclose the vulnerability publicly before it has been addressed
- Exploit the vulnerability for malicious purposes

### Please DO

1. **Email us directly** at: security@nextsight.local
2. Include the following in your report:
   - Type of vulnerability (e.g., SQL injection, XSS, authentication bypass)
   - Full paths of source file(s) related to the vulnerability
   - Location of the affected source code (tag/branch/commit or direct URL)
   - Step-by-step instructions to reproduce the issue
   - Proof-of-concept or exploit code (if possible)
   - Impact of the issue, including how an attacker might exploit it

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your vulnerability report within 48 hours.
- **Communication**: We will keep you informed of the progress towards a fix.
- **Timeline**: We aim to address critical vulnerabilities within 7 days and high-severity issues within 30 days.
- **Credit**: We will credit you in the security advisory (unless you prefer to remain anonymous).

## Security Best Practices for Deployment

### Authentication & Authorization

- Always change default credentials before deploying to production
- Use strong, unique passwords for all accounts
- Enable RBAC and follow the principle of least privilege
- Rotate JWT secrets regularly
- Set appropriate token expiration times

### Network Security

- Deploy NextSight behind a reverse proxy with TLS/SSL
- Use network policies to restrict pod-to-pod communication
- Limit API access to trusted networks
- Enable rate limiting on API endpoints

### Kubernetes Security

- Run NextSight with a non-root user
- Use read-only file systems where possible
- Apply Pod Security Standards (Restricted profile)
- Regularly update Kubernetes and container images
- Use private container registries

### Secret Management

- Never commit secrets to version control
- Use Kubernetes Secrets or external secret managers (Vault, AWS Secrets Manager)
- Encrypt secrets at rest
- Rotate secrets regularly

### Monitoring & Logging

- Enable audit logging for all API operations
- Monitor for suspicious activities
- Set up alerts for security-related events
- Regularly review access logs

## Security Features in NextSight

NextSight includes built-in security features:

- **Security Posture Dashboard**: Real-time security monitoring
- **RBAC Analysis**: Identify overly permissive roles
- **Network Policy Coverage**: Ensure proper network segmentation
- **Image Vulnerability Scanning**: Detect CVEs in container images
- **AI-Powered Remediation**: Get intelligent security recommendations

## Dependency Security

We use the following tools to maintain dependency security:

- **Dependabot**: Automated dependency updates
- **Trivy**: Container and filesystem vulnerability scanning
- **CodeQL**: Static code analysis for security issues
- **Secret Scanning**: Detect exposed secrets in code

## Security Updates

Security updates are released as patch versions (e.g., 1.3.1) and announced via:

- GitHub Security Advisories
- Release notes in CHANGELOG.md
- Email notifications to registered users (if applicable)

## Bug Bounty

We currently do not have a formal bug bounty program, but we appreciate responsible disclosure and will acknowledge security researchers who help improve NextSight security.

---

Thank you for helping keep NextSight and its users safe!
