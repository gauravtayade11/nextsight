# Changelog

All notable changes to NexOps will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.0] - 2024-12-03

### Added
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
- **Modal UX Enhancement** - AI responses now appear inline within detail modals
  - Single modal experience instead of separate popup
  - Seamless loading states with animated gradients
  - Collapsible AI analysis section
- **Modern AI Styling** - Beautiful gradient-based UI for AI features
  - Violet/Cyan gradient theme
  - Syntax-highlighted code blocks with copy functionality
  - Responsive markdown rendering

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
- Initial release of NexOps DevOps Operations Center
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
| 1.3.0 | 2024-12-03 | Security Posture Dashboard with AI-Powered Remediation |
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
