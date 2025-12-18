<div align="center">

# NextSight AI

### See your DevOps world in one intelligent view

[![CI](https://github.com/gauravtayade11/nextsight/actions/workflows/ci.yml/badge.svg)](https://github.com/gauravtayade11/nextsight/actions/workflows/ci.yml)
[![Security](https://github.com/gauravtayade11/nextsight/actions/workflows/security.yml/badge.svg)](https://github.com/gauravtayade11/nextsight/actions/workflows/security.yml)
[![CodeQL](https://github.com/gauravtayade11/nextsight/security/code-scanning/badge.svg)](https://github.com/gauravtayade11/nextsight/security/code-scanning)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.4.0-blue.svg)](https://github.com/gauravtayade11/nextsight/releases)
[![GitHub stars](https://img.shields.io/github/stars/gauravtayade11/nextsight?style=social)](https://github.com/gauravtayade11/nextsight/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/gauravtayade11/nextsight?style=social)](https://github.com/gauravtayade11/nextsight/network/members)

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://reactjs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Ready-326CE5.svg)](https://kubernetes.io/)
[![Helm](https://img.shields.io/badge/Helm-Chart-0F1689.svg)](https://helm.sh/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/gauravtayade11/nextsight/pulls)

**AI-powered Kubernetes management platform with real-time monitoring, security scanning, and intelligent insights.**

[Features](#features) • [Screenshots](#screenshots) • [Quick Start](#quick-start) • [Documentation](#documentation) • [Helm](#helm-installation) • [Contributing](#contributing)

---

</div>

## Screenshots

<div align="center">

### 1. Dashboard Overview
**Real-time cluster health monitoring with AI-powered insights**

![Dashboard - Overview with cluster metrics, pod status, and AI recommendations](docs/images/dashboard-overview.png)

*Cluster overview with live metrics, health indicators, and actionable AI-powered insights*

---

### 2. Kubernetes Workloads
**Complete resource management with health indicators**

![Kubernetes - Workload management with health status and quick actions](docs/images/kubernetes-workloads.png)

*Workload management showing pods, deployments with health indicators and one-click operations*

---

### 3. Security Dashboard
**Trivy-powered vulnerability scanning with plain English explanations**

![Security - Vulnerability scanning and security posture analysis](docs/images/security-dashboard.png)

*Security posture showing Top 3 risks, vulnerability scans, and AI-powered remediation suggestions*

---

### 4. AI Assistant
**Natural language queries with Groq/Gemini/Claude**

![AI Assistant - Chat interface with cluster insights](docs/images/ai-assistant.png)

*AI assistant providing intelligent answers about cluster status with real-time data*

---

### 5. Interactive Terminal
**Pod exec and debug containers with xterm.js**

![Terminal - Interactive shell access to pods and containers](docs/images/terminal.png)

*Interactive terminal for pod exec, debug containers, and kubectl command execution*

---

### 6. Real-time Pod Logs
**WebSocket-based log streaming with search**

![Logs - Real-time streaming logs with search and filter](docs/images/pod-logs.png)

*Live log viewer with WebSocket streaming, search functionality, and download option*

---

### 7. YAML Deployment
**Deploy manifests with validation and summary**

![Deploy - YAML editor with dry-run and deployment summary](docs/images/yaml-deploy.png)

*YAML deployment with syntax validation, dry-run mode, and deployment summary modal*

---

### 8. Helm Management
**Visual Helm chart deployment and management**

![Helm - Chart catalog and release management](docs/images/helm-dashboard.png)

*Helm chart browser with installation wizard, release management, and rollback capabilities*

---

### 9. Multi-Cluster Management
**Switch between clusters seamlessly**

![Clusters - Multi-cluster switcher and management](docs/images/cluster-management.png)

*Cluster switcher showing multiple Kubernetes clusters with real-time status*

---

### 10. Security Remediation
**AI-powered security fixes with kubectl commands**

![Security Remediation - AI-generated fix suggestions](docs/images/security-remediation.png)

*AI-powered security remediation with step-by-step kubectl commands and YAML examples*

---

> 💡 **Note**: Screenshots show NextSight AI v1.4.0 with all features enabled. Some features require optional components (metrics-server, Prometheus) or AI API keys (Groq/Gemini/Claude).

</div>

## Overview

NextSight AI is an AI-powered Kubernetes management platform that provides real-time visibility, intelligent security insights, and complete control over your clusters. Built with FastAPI and React, it combines traditional monitoring with AI-powered analysis for smarter DevOps operations.

## Features

### Dashboard & Monitoring
- **Real-time Cluster Health** - Live overview of pods, nodes, and namespace statistics
- **Resource Metrics** - CPU and memory utilization across nodes and pods
- **Event Timeline** - Track cluster events and anomalies
- **Dark Mode Support** - Full dark/light theme with system preference detection

### Workload Management
- **Pods** - View status, logs, and execute commands
- **Deployments** - Scale, restart, and rollback with one click
- **StatefulSets & DaemonSets** - Manage stateful and node-level workloads
- **Jobs & CronJobs** - Monitor batch processing

### Configuration & Storage
- **ConfigMaps & Secrets** - Secure configuration management
- **Persistent Volumes** - Storage provisioning and claims
- **Services & Ingresses** - Network routing and load balancing
- **HPAs** - Autoscaling policies

### Interactive Terminals
- **kubectl Terminal** - Execute kubectl commands directly in the browser
- **Shell Terminal** - Full bash access with kubectl and helm pre-installed
- **Terminal State Persistence** - Command history and output preserved across navigation
- **Pod Exec** - Interactive PTY-based terminal sessions inside containers
  - Full xterm.js terminal with resize support
  - WebSocket-based real-time communication
- **Debug Containers** - Debug distroless/minimal containers without a shell
  - Ephemeral container support via kubectl debug
  - Multiple debug images (busybox, alpine, netshoot)
- **Log Viewer** - Real-time streaming with WebSocket support, search filters, and download
- **Pod Events** - View Kubernetes events for pending/failed pods directly in log viewer

### DevOps Features
- **YAML Deploy** - Apply manifests with dry-run validation
- **Helm Chart UI** - Deploy, upgrade, and rollback Helm releases visually
- **AI Analysis** - Intelligent incident insights (Gemini/Claude)
- **GitFlow Integration** - Branch and release management

### Multi-Cluster & Security
- **Multi-Cluster Support** - Manage multiple Kubernetes clusters from one dashboard
  - Cluster switcher for quick context switching
  - **Cluster Management UI** - Add, remove, and configure clusters
  - View cluster status, metrics, and health
  - Discover clusters from kubeconfig contexts
- **RBAC Integration** - Role-based access control for user permissions
  - JWT-based authentication with 4 user roles (Admin, Developer, Operator, Viewer)
  - Protected routes and API endpoints
  - User management (admin only)
  - Default test users: admin/admin123, developer/developer123, operator/operator123, viewer/viewer123

### Cost Management
- **Cost Analysis Dashboard** - Monitor and optimize cluster costs
  - Resource cost estimation per namespace and pod
  - CPU and memory cost breakdown
  - 30-day cost trend visualization
  - Optimization recommendations
  - Resource efficiency metrics
  - Top cost consumers identification

### Security Posture Dashboard
- **Security Score & Grade** - Overall cluster security assessment (A-F grading)
- **Security Findings** - Real-time detection of misconfigurations
  - Privileged containers detection
  - Root user containers
  - Host path mounts
  - Missing security contexts
- **RBAC Analysis** - Role-based access control security assessment
  - Service account risk analysis
  - Cluster-admin binding detection
  - Wildcard permission identification
- **Network Policy Coverage** - Network security posture
  - Namespace protection status
  - Pod coverage percentage
- **Image Vulnerability Scanning** - Container security with Trivy
  - CVE detection with severity levels
  - CVSS scores and fix versions
- **AI-Powered Remediation** - Google Gemini integration
  - Detailed risk assessments
  - Step-by-step remediation commands
  - YAML configuration examples
  - Best practices and prevention tips

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/gauravtayade11/nextsight.git
cd nextsight

# Start the application
make dev
# or
docker-compose up -d

# View logs
make logs
```

Access at **http://localhost:3000**

### Using Makefile

```bash
make help          # Show all available commands
make dev           # Start development environment
make build         # Build Docker images
make logs          # View container logs
make down          # Stop containers
```

## Documentation

### Prerequisites

#### Required Components

| Requirement | Version | Notes |
|-------------|---------|-------|
| Docker | 20.10+ | For containerized deployment |
| Docker Compose | 2.0+ | For local development |
| kubectl | 1.25+ | Kubernetes CLI tool |
| Kubernetes Cluster | 1.24+ | Any CNCF-compliant distribution |

#### Optional Components (Recommended)

| Component | Purpose | Installation |
|-----------|---------|--------------|
| **metrics-server** | Pod/Node CPU & memory metrics | [Install Guide](https://github.com/kubernetes-sigs/metrics-server#installation) |
| **Prometheus** | Advanced monitoring & alerting | [Helm Chart](https://prometheus-community.github.io/helm-charts) |
| **Redis** | Caching for better performance | Included in docker-compose.yml |
| **PostgreSQL** | User & pipeline data persistence | Included in docker-compose.yml |

#### Built-in Tools (No Installation Required)

| Tool | Purpose | Version |
|------|---------|---------|
| **Trivy** | Container vulnerability scanning | v0.58.0 (built into Docker image) |
| **kubectl** | Kubernetes operations | Latest (included in backend) |
| **helm** | Helm chart management | Latest (included in backend) |

#### Installing metrics-server (Recommended)

metrics-server is required for pod and node resource metrics:

```bash
# For most clusters (Docker Desktop, EKS, GKE, AKS)
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# For Minikube
minikube addons enable metrics-server

# For Kind or other clusters with self-signed certificates
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl patch deployment metrics-server -n kube-system --type='json' \
  -p='[{"op": "add", "path": "/spec/template/spec/containers/0/args/-", "value": "--kubelet-insecure-tls"}]'

# Verify installation
kubectl get deployment metrics-server -n kube-system
kubectl top nodes
```

#### Installing Prometheus (Optional)

For advanced monitoring and alerting:

```bash
# Add Prometheus Helm repo
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install Prometheus
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace

# Port forward to access Prometheus UI (optional)
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090
```

NextSight AI will automatically detect and integrate with Prometheus if available.

### Configuration

Create a `.env` file in the backend directory:

```env
# Application
APP_NAME=NextSight AI
DEBUG=false

# Kubernetes (for local development)
K8S_CONFIG_PATH=~/.kube/config
K8S_IN_CLUSTER=false

# AI Provider (optional)
AI_PROVIDER=gemini
GEMINI_API_KEY=your-api-key
```

### Project Structure

```
nextsight/
├── backend/                 # FastAPI Backend
│   ├── app/
│   │   ├── api/routes/     # REST API endpoints
│   │   ├── core/           # Configuration & settings
│   │   ├── schemas/        # Pydantic models
│   │   └── services/       # Business logic
│   ├── Dockerfile
│   ├── entrypoint.sh
│   └── requirements.txt
├── frontend/               # React Frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # API client
│   │   └── types/          # TypeScript types
│   ├── Dockerfile
│   └── nginx.conf
├── k8s/                    # Kubernetes Manifests
│   ├── namespace.yaml
│   ├── rbac.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   └── ingress.yaml
├── docker-compose.yml
├── Makefile
└── README.md
```

### API Reference

#### Cluster Resources
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/kubernetes/health` | GET | Cluster health status |
| `/api/v1/kubernetes/namespaces` | GET | List all namespaces |
| `/api/v1/kubernetes/pods` | GET | List all pods |
| `/api/v1/kubernetes/deployments` | GET | List deployments |
| `/api/v1/kubernetes/services` | GET | List services |
| `/api/v1/kubernetes/nodes` | GET | List nodes with details |
| `/api/v1/kubernetes/metrics` | GET | Cluster metrics |

#### Operations
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/kubernetes/scale` | POST | Scale deployment replicas |
| `/api/v1/kubernetes/restart` | POST | Rolling restart deployment |
| `/api/v1/kubernetes/apply` | POST | Apply YAML manifest |
| `/api/v1/kubernetes/kubectl` | POST | Execute kubectl command |
| `/api/v1/kubernetes/shell` | POST | Execute shell command |

#### Pod Operations
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/kubernetes/pods/{ns}/{pod}/logs` | GET | Stream pod logs |
| `/api/v1/kubernetes/pods/{ns}/{pod}/events` | GET | Get pod events |
| `/api/v1/kubernetes/pods/{ns}/{pod}/exec` | POST | Execute in container |

#### WebSocket Endpoints
| Endpoint | Protocol | Description |
|----------|----------|-------------|
| `/api/v1/ws/pods/{ns}/{pod}/logs` | WS | Real-time log streaming |
| `/api/v1/ws/pods/{ns}/{pod}/exec` | WS | Interactive terminal session |
| `/api/v1/ws/pods/{ns}/{pod}/debug` | WS | Debug container session |

### Kubernetes Deployment

```bash
# Build images
make build-prod

# Deploy to cluster
make k8s-deploy

# Check status
make k8s-status

# Port forward for access
kubectl port-forward -n nextsight svc/nextsight-frontend 3000:80
```

### Helm Installation

Deploy NextSight AI to your Kubernetes cluster using Helm:

```bash
# Add the repository (when published)
# helm repo add nextsight https://gauravtayade11.github.io/nextsight/charts

# Install from local chart
helm install nextsight ./charts/nextsight -n nextsight --create-namespace

# Install with custom values
helm install nextsight ./charts/nextsight -n nextsight --create-namespace \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=nextsight.example.com

# Upgrade existing installation
helm upgrade nextsight ./charts/nextsight -n nextsight

# Uninstall
helm uninstall nextsight -n nextsight
```

**Configuration options:**

| Parameter | Description | Default |
|-----------|-------------|---------|
| `backend.replicaCount` | Backend replicas | `1` |
| `frontend.replicaCount` | Frontend replicas | `1` |
| `ingress.enabled` | Enable ingress | `false` |
| `ingress.hosts[0].host` | Ingress hostname | `nextsight.local` |
| `backend.extraEnv` | Extra env vars (secrets) | `[]` |

See [charts/nextsight/values.yaml](charts/nextsight/values.yaml) for all options.

## Security

### Application Security
- **Shell Protection** - Dangerous commands are blocked (rm -rf /, sudo, etc.)
- **kubectl Guard** - Destructive operations require confirmation
- **Secret Masking** - Only key names displayed, not values
- **RBAC Ready** - Granular Kubernetes permissions

### CI/CD Security Scanning
- **CodeQL Analysis** - Static code analysis for JavaScript and Python
- **Trivy Docker Scan** - Container vulnerability scanning for CRITICAL/HIGH CVEs
- **Dependency Review** - License compliance and vulnerability checks on PRs
- **Secret Detection** - Gitleaks integration for credential leak prevention

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | FastAPI, Python 3.11, kubernetes-client |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Container | Docker, nginx |
| Orchestration | Kubernetes, Helm |
| CLI Tools | kubectl, helm |

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
# Development setup
git clone https://github.com/gauravtayade11/nextsight.git
cd nextsight
make dev
```

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for detailed version history and release notes.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with passion for DevOps teams**

[Report Bug](../../issues) • [Request Feature](../../issues)

</div>
