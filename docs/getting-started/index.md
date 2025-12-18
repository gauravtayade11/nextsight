---
title: Getting Started
description: Get started with NextSight AI - installation, configuration, and quick start guide
---

# Getting Started

Welcome to NextSight AI! This section will help you get up and running quickly.

## What You'll Need

NextSight AI is designed to be easy to set up with minimal dependencies. Here's what you need:

### ✅ Required (5 minutes)
- **Docker & Docker Compose** - For running NextSight AI
- **kubectl** - For Kubernetes management
- **Kubernetes Cluster** - Any CNCF-compliant cluster (Docker Desktop, Minikube, Kind, EKS, GKE, AKS)

### 🎯 Recommended (10 minutes)
- **metrics-server** - For pod/node CPU & memory metrics (auto-detected)
- **Prometheus** - For advanced monitoring (auto-detected)

### 🚀 Built-in (0 minutes)
- **Trivy v0.58.0** - Container vulnerability scanning (included in image)
- **kubectl & helm** - Pre-installed in backend container
- **Redis & PostgreSQL** - Included in docker-compose for development

<div class="grid" markdown>

<div class="card" markdown>
### :material-download: Installation
Step-by-step installation guide for Docker Compose, Kubernetes, and Helm deployments.

[:octicons-arrow-right-24: Installation Guide](installation.md)
</div>

<div class="card" markdown>
### :material-rocket-launch: Quick Start
Get NextSight AI running in under 5 minutes with our quick start guide.

[:octicons-arrow-right-24: Quick Start](quickstart.md)
</div>

<div class="card" markdown>
### :material-cog: Configuration
Configure environment variables, AI providers, and cluster connections.

[:octicons-arrow-right-24: Configuration](configuration.md)
</div>

<div class="card" markdown>
### :material-sitemap: Architecture
Understand how NextSight AI components work together.

[:octicons-arrow-right-24: Architecture](architecture.md)
</div>

</div>

## Prerequisites

Before you begin, ensure you have:

- [x] **Docker** (v20.10+) and Docker Compose (v2.0+)
- [x] **kubectl** configured with cluster access
- [x] **Node.js** (v18+) for development
- [x] **Python** (v3.11+) for backend development

## Deployment Options

| Method | Best For | Complexity |
|--------|----------|------------|
| Docker Compose | Local development, quick testing | :material-star: Easy |
| Kubernetes | Production deployments | :material-star::material-star: Medium |
| Helm | Customized K8s deployments | :material-star::material-star::material-star: Advanced |

## Need Help?

- :material-github: [Open an Issue](https://github.com/gauravtayade11/nextsight/issues)
- :material-file-document: [Read the Docs](../features/index.md)
- :material-api: [API Reference](../api/index.md)
