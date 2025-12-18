# Changelog

All notable changes to NextSight will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.4.0] - 2025-12-17

### Added
- **Trivy in Docker Image** - Built-in vulnerability scanning
  - Trivy binary included in backend Docker image
  - No external dependencies required for image scanning
  - Version 0.58.0 installed
- **Metrics Server Status Endpoint** - Check metrics-server availability
  - New `/api/v1/kubernetes/metrics/status` endpoint
  - Auto-detect if metrics-server is installed
  - Graceful fallback for clusters without metrics-server
- **AI-Powered Proactive Insights** - Identifies issues before they become incidents
  - New `/api/v1/ai/insights/proactive` endpoint
  - Automatic detection of failed/crashing pods, degraded deployments
  - Security risk identification from security dashboard
  - Resource optimization opportunities
  - Cluster health scoring
- **AI Runbook Generation** - Creates incident response runbooks
  - New `/api/v1/ai/runbook/generate` endpoint
  - Support for pod_crash, deployment_failed, node_not_ready, oom_killed, network_issue
  - Step-by-step kubectl commands with expected outputs
  - Verification and escalation paths
- **Smart Suggestions** - Context-aware cluster recommendations
  - New `/api/v1/ai/suggestions/smart` endpoint
  - Real-time cluster state analysis
  - Actionable kubectl commands

### User Experience Enhancements
- **Dashboard Actionable Insights Card** - AI-powered recommendations on main dashboard
  - Automatic issue detection and remediation suggestions
  - One-click actions for common problems
  - Severity-based priority indicators
- **Top 3 Security Risks View** - Priority security findings on dashboard
  - Highlights most critical vulnerabilities
  - Quick access to detailed remediation
  - "View All" button for complete security dashboard
- **Plain English Security Explanations** - Business-friendly risk messaging
  - Translates technical CVEs into understandable language
  - Business impact assessment for each finding
  - Non-technical stakeholder communication
- **Workload Health Indicators** - Visual health status for all Kubernetes resources
  - Green/Yellow/Red health dots on workload tables
  - Instant visual assessment of resource health
  - Health status based on replica readiness, restarts, and conditions
- **WorkloadDrawer AI Fixes Tab** - Root cause analysis for failing workloads
  - AI-powered troubleshooting suggestions
  - Step-by-step remediation steps
  - Integration with proactive insights
- **YAML Deploy Summary Modal** - Pre-deployment validation and overview
  - Resource type and name extraction
  - Namespace detection and override
  - Dry-run validation results
  - Deployment confirmation with detailed summary

### Changed
- **Project Rebrand to NextSight AI**
  - New name: NextSight AI
  - Tagline: "See your DevOps world in one intelligent view"
  - Updated all UI components, configs, and documentation
  - Helm chart description updated

### Improved
- **Enhanced Caching** - Production-ready Redis caching
  - Optimization dashboard caching (60s TTL)
  - Prometheus targets caching (30s TTL)
  - Prometheus alerts caching (15s TTL)
  - AI proactive insights caching (120s TTL)
- **Production Readiness**
  - Comprehensive environment configuration
  - Production checklist in .env.example
  - Proper error handling across all services
  - Graceful degradation when services unavailable
- **Multi-Provider AI Support** - Support for Groq, Gemini, and Claude
  - Groq with Llama 3.3 (recommended, 14.4K req/day free tier)
  - Google Gemini 2.0 Flash (fast multimodal)
  - Anthropic Claude Sonnet 4 (highest quality)
  - Provider-agnostic configuration

### Documentation
- **Comprehensive Prerequisites Guide** - Complete installation documentation
  - Required, optional, and built-in components clearly categorized
  - Step-by-step installation guides for metrics-server (3 platform variants)
  - Prometheus installation with Helm chart instructions
  - Kubernetes cluster setup options (local and cloud)
- **Screenshot Placeholders** - Visual documentation structure
  - 10 screenshot placeholders in README.md
  - 9 screenshot placeholders in MkDocs documentation
  - Detailed screenshot capture guidelines
- **Enhanced MkDocs Documentation** - Complete feature documentation
  - Updated all AI provider references (Groq, Gemini, Claude)
  - OAuth/SSO configuration guides (Google, GitHub, GitLab)
  - PostgreSQL and Redis setup instructions
  - Production deployment checklist

### Deferred to Future Release
- **Pipelines Module** - Full CI/CD pipeline management with agent-based execution
- **Cost Analyzer** - Resource cost tracking, namespace breakdown, and savings recommendations

## [1.3.0] - 2025-12-04

### Added
- **Interactive Pod Exec Terminal** - Full PTY-based terminal sessions
  - xterm.js integration with resize support
  - WebSocket-based real-time communication
  - Input validation for security (RFC 1123 names)
- **Debug Containers** - Debug distroless/minimal containers
  - Ephemeral container support via kubectl debug
  - Multiple debug images (busybox, alpine, netshoot, ubuntu)
  - Target container process namespace sharing
- **Toast Notifications** - Visual feedback for user actions
  - Success/error/warning/info toast types
  - Auto-dismiss with configurable duration
  - Integrated with Scale, Restart, and Delete actions
- **Quick Status Filters** - Filter resources by status
  - Deployments: All / Healthy / Degraded
  - Pods: All / Running / Pending / Failed
- **Column Sorting** - Click-to-sort table headers
  - Sortable columns: Name, Namespace, Status, Age, Node, Restarts
  - Visual sort direction indicators
- **View YAML Modal** - Inspect resource YAML definitions
  - Fetches live YAML from cluster via kubectl
  - Copy-to-clipboard functionality
  - Available for Deployments and Pods
- **Security Posture Dashboard** - Comprehensive security monitoring and analysis
  - **Security Score & Grade** - Overall cluster security assessment with letter grade (A-F)
  - **Security Findings** - Real-time detection of misconfigurations and vulnerabilities
    - Privileged containers detection
    - Root user containers
    - Host path mounts
    - Missing security contexts
    - Sensitive volume mounts
  - **RBAC Analysis** - Role-based access control security assessment
    - Service account risk analysis
    - Role binding security checks
    - Cluster-admin binding detection
    - Wildcard permission identification
  - **Network Policy Coverage** - Network security posture analysis
    - Namespace protection status
    - Pod coverage percentage
    - Unprotected namespace identification
  - **Image Vulnerability Scanning** - Container image security analysis
    - CVE detection with severity levels
    - CVSS scores and fix versions
    - Vulnerability trends over time
  - **AI-Powered Remediation** - Google Gemini integration for intelligent security advice
    - Detailed risk assessments
    - Step-by-step remediation commands
    - YAML configuration examples
    - Best practices and prevention tips
    - Modern AI-themed UI with gradient styling

### Improved
- **Modern Glass-morphism UI** - Enhanced visual design
  - Gradient backgrounds and blur effects
  - Smooth animations with Framer Motion
  - Consistent dark mode support
- **Modal UX Enhancement** - AI responses now appear inline within detail modals
  - Single modal experience instead of separate popup
  - Seamless loading states with animated gradients
  - Collapsible AI analysis section
- **Modern AI Styling** - Beautiful gradient-based UI for AI features
  - Violet/Cyan gradient theme
  - Syntax-highlighted code blocks with copy functionality
  - Responsive markdown rendering

### Security
- **CodeQL Fixes** - Resolved security scanning issues
  - Input validation for Kubernetes resource names (RFC 1123)
  - Allowlist validation for shells and debug images
  - Log injection prevention with input sanitization
  - Secure logging with parameterized format strings

### CI/CD
- Removed redundant Trivy filesystem scan (Docker scan is sufficient)
- Updated documentation with CI/CD security scanning info

## [1.2.0] - 2024-12-02

### Added
- **Dark Mode** - Complete dark theme support across all components
  - System preference detection via `prefers-color-scheme`
  - Manual toggle in header
  - Persistent preference storage in localStorage
  - ThemeContext for global theme state management
- **Terminal State Persistence** - Terminal history preserved across navigation
  - Command history maintained in React Context (TerminalContext)
  - Mode (kubectl/shell) and working directory remembered
  - Output history preserved when switching views
  - No more losing terminal state when navigating away
- **Pod Events in Log Viewer** - View Kubernetes events for non-running pods
  - Helpful for debugging Pending/Failed pods
  - Events displayed with timestamps and repeat counts
  - New API endpoint: `GET /api/v1/kubernetes/pods/{namespace}/{pod}/events`
- **Multi-Cluster Support** - Manage multiple Kubernetes clusters from a single dashboard
  - Cluster switcher in the header for quick context switching
  - Cluster-specific context management
  - Unified view across clusters
  - **Cluster Management UI** - Full CRUD operations for cluster configurations
    - View all configured clusters with real-time status (connected/disconnected/error)
    - Add new clusters from kubeconfig contexts
    - Delete clusters with safety checks (admin only)
    - Display cluster metrics (version, nodes, namespaces)
    - List available kubeconfig contexts
    - Admin-only cluster operations with RBAC protection
- **RBAC Integration** - Role-based access control for user permissions
  - JWT-based authentication with login/logout
  - 4 user roles: Admin, Developer, Operator, Viewer
  - Role-based permissions mapping for all operations
  - Protected routes and API endpoints
  - User management UI (admin only)
  - Password hashing with pbkdf2_sha256
  - Default test users for each role
- **Helm Chart Deployment UI** - Deploy and manage Helm charts visually
  - List all Helm releases across namespaces
  - View release details, history, and values
  - Install charts from repositories
  - Upgrade releases with custom values
  - Rollback to previous revisions
  - Uninstall releases
  - Repository management
  - Chart search and version selection
- **Cost Analysis Dashboard** - Monitor and optimize cluster costs
  - Resource cost estimation per namespace and pod
  - Cost breakdown by CPU and memory usage
  - 30-day cost trend visualization
  - Cost optimization recommendations
  - Resource efficiency metrics
  - Top cost consumers identification
  - Estimated monthly/annual projections

### Improved
- **Pod Log Viewer** - Graceful handling of non-running pods
  - Informative status messages based on pod state (Pending, Failed, Unknown)
  - "Try Fetching Logs Anyway" option for edge cases
  - Status badge in header shows current pod state
- **Dark Mode UI** - All Kubernetes views fully themed
  - Resources view with dark tables and cards
  - Nodes view
  - Cluster Metrics
  - YAML Deploy with dark editor
  - Terminal with dark theme

## [1.1.0] - 2024-12-01

### Added
- **WebSocket Real-Time Log Streaming**
  - Live pod log streaming via WebSocket connections
  - New `useWebSocketLogs` React hook for frontend integration
  - WebSocket connection manager for handling multiple concurrent streams
  - Real-time mode toggle in Pod Logs Viewer
  - Live connection status indicator (Connected/Connecting/Disconnected)
  - Auto-scroll to latest logs in streaming mode
  - Clear logs functionality during streaming
  - Heartbeat/ping-pong support for connection health

### Changed
- Enhanced PodLogsViewer component with streaming mode
- Updated Vite proxy configuration to support WebSocket connections

### Technical
- Backend: New `/api/v1/ws/pods/{namespace}/{pod_name}/logs` WebSocket endpoint
- Backend: WebSocketManager class for connection lifecycle management
- Backend: Async log streaming with Kubernetes client
- Frontend: Custom React hook with auto-reconnect capability
- Frontend: Proper WebSocket URL construction based on current host

## [1.0.0] - 2024-12-01

### Added
- Initial release of NextSight DevOps Operations Center
- **Kubernetes Dashboard**
  - Real-time cluster health monitoring
  - Pod, deployment, and node management
  - Namespace overview and filtering
- **Workload Management**
  - Pods with logs and exec capabilities
  - Deployments with scale and restart
  - StatefulSets, DaemonSets, Jobs, CronJobs
- **Configuration Resources**
  - ConfigMaps and Secrets browser
  - Services and Ingresses viewer
  - PersistentVolumeClaims management
  - HorizontalPodAutoscalers
- **Interactive Terminals**
  - kubectl terminal with command blocking
  - Shell terminal with full bash access
  - Pod exec for container access
- **DevOps Features**
  - YAML manifest deployment with dry-run
  - AI-powered incident analysis (Gemini/Claude)
  - GitFlow integration endpoints
- **Security**
  - Dangerous command blocking
  - Secret value masking
  - RBAC-ready deployment manifests
- **Docker Support**
  - Multi-stage Dockerfiles
  - Docker Compose for local development
  - Kubernetes deployment manifests
- **Documentation**
  - Comprehensive README
  - API documentation
  - Contributing guidelines

### Infrastructure
- FastAPI backend with kubernetes-client
- React 18 frontend with TypeScript
- nginx reverse proxy configuration
- Health checks and liveness probes

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 1.4.0 | 2025-12-05 | NextSight AI Rebrand, Trivy in Docker, Metrics Server Status |
| 1.3.0 | 2025-12-04 | Pod Exec Terminal, Debug Containers, Security Dashboard, Glass-morphism UI |
| 1.2.0 | 2024-12-02 | Dark Mode, Terminal Persistence, Multi-Cluster, RBAC, Helm UI, Cost Dashboard |
| 1.1.0 | 2024-12-01 | WebSocket Real-Time Log Streaming |
| 1.0.0 | 2024-12-01 | Initial Release |

---

## Upgrade Guide

### From 0.x to 1.0.0
This is the initial release. No upgrade path required.

---

## Release Process

1. Update version in:
   - `backend/app/core/config.py` (APP_VERSION)
   - `frontend/package.json` (version)
   - `k8s/deployment.yaml` (image tags)

2. Update CHANGELOG.md with release notes

3. Create release branch:
   ```bash
   git checkout develop
   git checkout -b release/1.x.x
   ```

4. Merge to main and tag:
   ```bash
   git checkout main
   git merge release/1.x.x
   git tag -a v1.x.x -m "Release v1.x.x"
   git push origin main --tags
   ```

5. Merge back to develop:
   ```bash
   git checkout develop
   git merge main
   git push origin develop
   ```
