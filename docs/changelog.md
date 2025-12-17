# Changelog

All notable changes to NextSight AI are documented here.

## [1.4.0] - 2025-12-17

### Added

#### AI-Powered Features
- **Proactive Insights** - `/api/v1/ai/insights/proactive` endpoint for automatic issue detection
  - Failed/crashing pod detection
  - Degraded deployment identification
  - Security risk highlighting
  - Resource optimization opportunities
  - Cluster health scoring
- **AI Runbook Generation** - `/api/v1/ai/runbook/generate` endpoint for incident response
  - Support for pod_crash, deployment_failed, node_not_ready, oom_killed, network_issue
  - Step-by-step kubectl commands with expected outputs
  - Verification and escalation paths
- **Smart Suggestions** - `/api/v1/ai/suggestions/smart` endpoint for context-aware recommendations
  - Real-time cluster state analysis
  - Actionable kubectl commands

#### Security & Monitoring
- **Trivy in Docker Image** - Built-in vulnerability scanning
  - Trivy v0.58.0 binary included in backend image
  - No external dependencies required
  - Works in air-gapped environments
- **Metrics Server Status Endpoint** - `/api/v1/kubernetes/metrics/status`
  - Auto-detect metrics-server availability
  - Graceful fallback when unavailable
- **Top 3 Security Risks View** - Priority security findings on dashboard
- **Plain English Security Explanations** - Business-friendly risk messaging with impact assessment

#### User Experience Enhancements
- **Dashboard Actionable Insights Card** - AI-powered recommendations on main dashboard
- **Workload Health Indicators** - Visual health status (green/yellow/red) for all workloads
- **WorkloadDrawer AI Fixes Tab** - Root cause analysis and intelligent remediation
- **YAML Deploy Summary Modal** - Pre-deployment overview and validation

### Changed
- **Project Rebrand to NextSight AI**
  - New name and tagline: "See your DevOps world in one intelligent view"
  - Updated all UI components, configs, and documentation
  - Helm chart description updated

### Improved
- **Enhanced Redis Caching** - Production-ready caching with optimized TTLs
  - Optimization dashboard: 60s TTL
  - Prometheus targets: 30s TTL
  - Prometheus alerts: 15s TTL
  - AI proactive insights: 120s TTL
- **Production Readiness**
  - Comprehensive environment configuration
  - Production checklist in `.env.example`
  - Proper error handling across all services
  - Graceful degradation when services unavailable

### Deferred to Future Release
- **Pipelines Module** - Full CI/CD pipeline management with agent-based execution
- **Cost Analyzer** - Resource cost tracking, namespace breakdown, and savings recommendations

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
