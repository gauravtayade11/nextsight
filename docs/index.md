---
title: Home
description: AI-powered Kubernetes management platform with real-time monitoring, security scanning, and intelligent insights
hide:
  - navigation
  - toc
---

<style>
.md-content__button {
  display: none;
}
</style>

<div class="hero" markdown>
<div class="hero-content" markdown>

# :material-kubernetes:{ .lg } NextSight AI

## See your DevOps world in one intelligent view

AI-powered Kubernetes management platform with real-time visibility, intelligent security insights, and complete control over your clusters.

[Get Started :material-arrow-right:](getting-started/installation.md){ .md-button .md-button--primary }
[View on GitHub :material-github:](https://github.com/gauravtayade11/nextsight){ .md-button }

</div>
</div>

<div class="stats" markdown>
<div class="stat">
<div class="stat-value">v1.4.0</div>
<div class="stat-label">Latest Release</div>
</div>
<div class="stat">
<div class="stat-value">MIT</div>
<div class="stat-label">License</div>
</div>
<div class="stat">
<div class="stat-value">100%</div>
<div class="stat-label">Open Source</div>
</div>
</div>

---

## :material-rocket-launch: Features

<div class="grid" markdown>

<div class="card" markdown>
### :material-view-dashboard: Dashboard
Real-time cluster health with live pod, node, and namespace statistics. Beautiful visualizations with dark mode support.

[:octicons-arrow-right-24: Learn more](features/dashboard.md)
</div>

<div class="card" markdown>
### :material-kubernetes: Kubernetes Management
Complete control over pods, deployments, services, and nodes. Scale, restart, and manage resources with ease.

[:octicons-arrow-right-24: Learn more](features/kubernetes.md)
</div>

<div class="card" markdown>
### :material-shield-check: Security Posture
Comprehensive security scanning with Trivy integration, RBAC analysis, and AI-powered remediation suggestions.

[:octicons-arrow-right-24: Learn more](features/security.md)
</div>

<div class="card" markdown>
### :material-robot: AI Assistant
Ask questions about your cluster in natural language. Get intelligent insights and troubleshooting help powered by Gemini.

[:octicons-arrow-right-24: Learn more](features/ai-assistant.md)
</div>

<div class="card" markdown>
### :material-console: Pod Terminal
Interactive PTY-based terminal sessions inside containers. Support for debug containers in distroless images.

[:octicons-arrow-right-24: Learn more](features/terminal.md)
</div>

</div>

---

## :material-clock-fast: Quick Start

Get NextSight AI running in under 5 minutes:

=== "Docker Compose"

    ```bash
    # Clone the repository
    git clone https://github.com/gauravtayade11/nextsight.git
    cd nextsight

    # Start the stack
    docker-compose up -d

    # Access at http://localhost:3000
    ```

=== "Kubernetes"

    ```bash
    # Apply manifests
    kubectl apply -f k8s/

    # Port forward to access
    kubectl port-forward svc/nextsight-frontend 3000:80
    ```

=== "Helm"

    ```bash
    # Add the Helm repo
    helm repo add nextsight https://gauravtayade11.github.io/nextsight

    # Install the chart
    helm install nextsight ./charts/nextsight -n nextsight --create-namespace
    ```

---

## :material-image-multiple: Screenshots

<div class="grid" markdown>

![Dashboard](images/dashboard.svg){ loading=lazy }

![Kubernetes Resources](images/kubernetes.svg){ loading=lazy }

</div>

---

## :material-layers: Tech Stack

| Component | Technologies |
|-----------|--------------|
| **Backend** | :material-language-python: FastAPI, Python 3.11, kubernetes-client, WebSockets |
| **Frontend** | :material-react: React 18, TypeScript, Vite, Tailwind CSS, xterm.js |
| **Database** | :material-database: Redis (caching), PostgreSQL (persistence) |
| **Container** | :material-docker: Docker, nginx |
| **Orchestration** | :material-kubernetes: Kubernetes, Helm |
| **Security** | :material-shield: Trivy v0.58.0 (built-in), RBAC Analysis |
| **AI** | :material-robot: Groq (Llama 3.3), Gemini 2.0, Claude Sonnet |
| **OAuth** | :material-login: Google, GitHub, GitLab SSO |

---

## :material-help-circle: What's New in v1.4.0

!!! success "Latest Release Highlights"

    - **AI-Powered Proactive Insights** - Automatic detection of issues before they become incidents
    - **Trivy Built-in** - Container vulnerability scanning with no external dependencies (v0.58.0)
    - **Smart Runbook Generation** - AI creates step-by-step incident response guides
    - **Enhanced Security Dashboard** - Top 3 risks view with plain English explanations
    - **Workload Health Indicators** - Visual health status for all Kubernetes resources
    - **Performance Optimization** - Redis caching with intelligent TTLs for faster responses

[:octicons-arrow-right-24: View Full Changelog](changelog.md)

---

## :material-license: License

NextSight AI is released under the [MIT License](https://github.com/gauravtayade11/nextsight/blob/main/LICENSE).

<div style="text-align: center; margin-top: 2rem;">

**Built with :material-heart: by [Gaurav Tayade](https://github.com/gauravtayade11)**

</div>
