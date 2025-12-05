# Changelog

All notable changes to NextSight AI are documented here.

## [1.4.0] - 2024-12-05

### Added
- Rebranded to **NextSight AI** with new tagline
- Enhanced AI assistant with multi-service context
- Cost management dashboard
- Security findings AI remediation

### Changed
- Updated dashboard with improved metrics
- Better AI response formatting
- Improved security score calculation

### Fixed
- Log injection vulnerabilities in WebSocket handlers
- ESLint dependency version mismatch
- OSSF Scorecard workflow permissions

## [1.3.1] - 2024-12-05

### Fixed
- CodeQL security alerts (log injection)
- ESLint @typescript-eslint version conflict
- Empty except blocks in health checks

### Changed
- Removed OSSF Scorecard (permission conflicts)
- Updated dependencies (date-fns, websockets, redis)

## [1.3.0] - 2024-12-04

### Added
- Pod Exec terminal with full PTY support
- Debug containers for distroless images
- WebSocket-based log streaming
- Terminal resize support

### Fixed
- XSS vulnerability in log viewer
- Stack trace exposure in AI health check

## [1.2.0] - 2024-12-03

### Added
- Security Posture Dashboard
- Trivy vulnerability scanning
- RBAC analysis
- Network policy coverage
- AI-powered remediation suggestions

### Changed
- Improved security score algorithm
- Better finding categorization

## [1.1.0] - 2024-12-02

### Added
- AI Chat Assistant (Gemini integration)
- Real-time Kubernetes data in AI responses
- Cost estimation by namespace
- Dark mode support

### Changed
- Updated UI with glass-morphism design
- Improved response times

## [1.0.0] - 2024-12-01

### Added
- Initial release
- Kubernetes dashboard
- Pod/Deployment/Service management
- Node monitoring
- kubectl terminal
- Multi-cluster support
- RBAC authentication

---

## Version Format

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** - Breaking changes
- **MINOR** - New features (backwards compatible)
- **PATCH** - Bug fixes

## Contributing

See [Contributing Guide](contributing/pull-requests.md) for how to contribute.
