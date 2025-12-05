# NextSight AI

**See your DevOps world in one intelligent view**

NextSight AI is an AI-powered Kubernetes management platform that provides real-time visibility, intelligent security insights, and complete control over your clusters. Built with FastAPI and React, it combines traditional monitoring with AI-powered analysis for smarter DevOps operations.

<div class="grid cards" markdown>

-   :material-clock-fast:{ .lg .middle } __Set up in 5 minutes__

    ---

    Get NextSight AI running with Docker Compose in just a few commands

    [:octicons-arrow-right-24: Getting Started](getting-started/installation.md)

-   :material-kubernetes:{ .lg .middle } __Kubernetes Management__

    ---

    Monitor and manage your Kubernetes clusters with real-time insights

    [:octicons-arrow-right-24: Kubernetes Features](features/kubernetes.md)

-   :material-shield-check:{ .lg .middle } __Security Posture__

    ---

    Comprehensive security scanning with AI-powered remediation

    [:octicons-arrow-right-24: Security Dashboard](features/security.md)

-   :material-robot:{ .lg .middle } __AI Assistant__

    ---

    Ask questions about your cluster in natural language

    [:octicons-arrow-right-24: AI Features](features/ai-assistant.md)

</div>

## Key Features

### Dashboard & Monitoring
- **Real-time Cluster Health** - Live overview of pods, nodes, and namespace statistics
- **Resource Metrics** - CPU and memory utilization across nodes and pods
- **Event Timeline** - Track cluster events and anomalies
- **Dark Mode Support** - Full dark/light theme with system preference detection

### Security & Compliance
- **Security Score & Grade** - Overall cluster security assessment (A-F grading)
- **Vulnerability Scanning** - Container security with Trivy integration
- **RBAC Analysis** - Role-based access control security assessment
- **AI-Powered Remediation** - Step-by-step fix recommendations

### Interactive Terminals
- **Pod Exec** - Interactive PTY-based terminal sessions inside containers
- **Debug Containers** - Debug distroless/minimal containers
- **Log Viewer** - Real-time streaming with search and filters

## Quick Start

```bash
# Clone the repository
git clone https://github.com/gauravtayade11/nexops.git
cd nexops

# Start with Docker Compose
docker-compose up -d

# Access at http://localhost:3000
```

## Screenshots

### Dashboard
![Dashboard](images/HomePage.png)

### Kubernetes Resources
![Kubernetes](images/Kuberntes.png)

### Security Dashboard
![Security](images/Security.png)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | FastAPI, Python 3.11, kubernetes-client |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Container | Docker, nginx |
| Orchestration | Kubernetes, Helm |
| AI | Google Gemini |

## License

NextSight AI is released under the [MIT License](https://github.com/gauravtayade11/nexops/blob/main/LICENSE).
