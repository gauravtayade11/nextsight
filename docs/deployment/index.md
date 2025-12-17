---
title: Deployment
description: Deploy NextSight AI using Docker Compose, Kubernetes manifests, or Helm charts
---

# Deployment Guide

Choose the deployment method that best fits your environment and requirements.

<div class="grid" markdown>

<div class="card" markdown>
### :material-docker: Docker Compose
Quickest way to get started. Perfect for development and testing.

[:octicons-arrow-right-24: Docker Compose](docker-compose.md)
</div>

<div class="card" markdown>
### :material-kubernetes: Kubernetes
Production-ready deployment using native Kubernetes manifests.

[:octicons-arrow-right-24: Kubernetes](kubernetes.md)
</div>

<div class="card" markdown>
### :material-ship-wheel: Helm Chart
Customizable deployment with Helm for advanced configurations.

[:octicons-arrow-right-24: Helm Chart](helm.md)
</div>

</div>

## Deployment Comparison

| Feature | Docker Compose | Kubernetes | Helm |
|---------|---------------|------------|------|
| Setup Time | ~2 min | ~10 min | ~5 min |
| Customization | Limited | High | Very High |
| Scaling | Manual | Auto (HPA) | Auto (HPA) |
| Best For | Development | Production | Production |
| Updates | Manual | Rolling | Rolling |

## Architecture Overview

```mermaid
graph TB
    subgraph Client
        Browser[Web Browser]
    end

    subgraph NextSight AI
        Frontend[React Frontend<br/>:3000]
        Backend[FastAPI Backend<br/>:8000]
        Redis[(Redis Cache)]
    end

    subgraph Kubernetes Cluster
        API[K8s API Server]
        Pods[Pods]
        Nodes[Nodes]
    end

    subgraph External Services
        Gemini[Google Gemini AI]
        Trivy[Trivy Scanner]
    end

    Browser --> Frontend
    Frontend --> Backend
    Backend --> Redis
    Backend --> API
    API --> Pods
    API --> Nodes
    Backend --> Gemini
    Backend --> Trivy
```

## Resource Requirements

### Minimum Requirements

| Component | CPU | Memory | Storage |
|-----------|-----|--------|---------|
| Backend | 0.5 cores | 512 MB | - |
| Frontend | 0.25 cores | 256 MB | - |
| Redis | 0.25 cores | 128 MB | 1 GB |

### Recommended for Production

| Component | CPU | Memory | Storage |
|-----------|-----|--------|---------|
| Backend | 2 cores | 2 GB | - |
| Frontend | 1 core | 512 MB | - |
| Redis | 1 core | 1 GB | 10 GB |

## Security Considerations

!!! warning "Production Checklist"

    - [ ] Enable TLS/SSL for all connections
    - [ ] Configure proper RBAC permissions
    - [ ] Use secrets management for API keys
    - [ ] Set up network policies
    - [ ] Enable audit logging
    - [ ] Configure resource limits
