# Installation

This guide covers all the ways to install and run NextSight AI.

## Prerequisites

### Required Components

Before installing NextSight AI, ensure you have these components:

| Requirement | Version | Purpose | Installation |
|-------------|---------|---------|--------------|
| **Docker** | 20.10+ | Container runtime | [Get Docker](https://docs.docker.com/get-docker/) |
| **Docker Compose** | 2.0+ | Local development orchestration | Included with Docker Desktop |
| **kubectl** | 1.25+ | Kubernetes CLI tool | [Install kubectl](https://kubernetes.io/docs/tasks/tools/) |
| **Kubernetes Cluster** | 1.24+ | Container orchestration | See [cluster options](#kubernetes-cluster-options) below |

### Optional Components (Recommended)

These components enhance NextSight AI's capabilities but are not required:

| Component | Purpose | Auto-Detected | Installation |
|-----------|---------|---------------|--------------|
| **metrics-server** | Pod/Node CPU & memory metrics | ✅ Yes | [See below](#installing-metrics-server) |
| **Prometheus** | Advanced monitoring & alerting | ✅ Yes | [See below](#installing-prometheus) |
| **Redis** | Response caching for performance | - | Included in docker-compose.yml |
| **PostgreSQL** | User & pipeline data persistence | - | Included in docker-compose.yml |

### Built-in Tools (No Installation Required)

NextSight AI includes these tools in the Docker image:

| Tool | Purpose | Version | Notes |
|------|---------|---------|-------|
| **Trivy** | Container vulnerability scanning | v0.58.0 | Built into backend image |
| **kubectl** | Kubernetes operations | Latest | Pre-installed in backend |
| **helm** | Helm chart management | Latest | Pre-installed in backend |

!!! success "Zero Configuration Security Scanning"
    Trivy is built directly into the NextSight AI backend image, requiring no external installation or configuration. Image scanning works immediately out of the box, even in air-gapped environments.

## Docker Compose (Recommended)

The fastest way to get started is using Docker Compose:

```bash
# Clone the repository
git clone https://github.com/gauravtayade11/nextsight.git
cd nextsight

# Start the application
docker-compose up -d

# View logs
docker-compose logs -f
```

Access NextSight AI at **http://localhost:3000**

## Using Makefile

If you have `make` installed:

```bash
make help          # Show all available commands
make dev           # Start development environment
make build         # Build Docker images
make logs          # View container logs
make down          # Stop containers
```

## Kubernetes Deployment

Deploy NextSight AI to your Kubernetes cluster:

```bash
# Build production images
make build-prod

# Deploy to cluster
make k8s-deploy

# Check status
make k8s-status

# Port forward for access
kubectl port-forward -n nextsight svc/nextsight-frontend 3000:80
```

## Helm Installation

For production deployments, use the Helm chart:

```bash
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

See the [Helm Chart documentation](../deployment/helm.md) for all configuration options.

## Default Credentials

NextSight AI comes with default test users:

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Admin |
| developer | developer123 | Developer |
| operator | operator123 | Operator |
| viewer | viewer123 | Viewer |

!!! warning "Security Notice"
    Change these default credentials before deploying to production!

## Installing Optional Components

### Installing metrics-server

metrics-server provides pod and node resource metrics (CPU & memory). NextSight AI will automatically detect if it's available.

=== "Docker Desktop / Cloud Providers"

    For most managed Kubernetes clusters (EKS, GKE, AKS) and Docker Desktop:

    ```bash
    kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
    ```

=== "Minikube"

    Minikube has a built-in addon:

    ```bash
    minikube addons enable metrics-server
    ```

=== "Kind / Self-Signed Certs"

    For Kind or clusters with self-signed certificates:

    ```bash
    # Apply the manifest
    kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

    # Patch to accept insecure TLS
    kubectl patch deployment metrics-server -n kube-system --type='json' \
      -p='[{"op": "add", "path": "/spec/template/spec/containers/0/args/-", "value": "--kubelet-insecure-tls"}]'
    ```

**Verify Installation:**

```bash
# Check deployment
kubectl get deployment metrics-server -n kube-system

# Test metrics
kubectl top nodes
kubectl top pods -A
```

!!! info "Graceful Degradation"
    If metrics-server is not installed, NextSight AI will still work but some features (resource metrics charts, pod/node CPU/memory usage) will be unavailable.

### Installing Prometheus

Prometheus provides advanced monitoring, metrics collection, and alerting capabilities.

```bash
# Add Prometheus Helm repository
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install kube-prometheus-stack
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace

# Wait for pods to be ready
kubectl wait --for=condition=ready pod -l "release=prometheus" -n monitoring --timeout=300s
```

**Access Prometheus UI (optional):**

```bash
# Port forward to access locally
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090

# Open http://localhost:9090
```

**What NextSight AI Uses:**

- Prometheus metrics endpoint for advanced queries
- AlertManager integration for alert status
- Service discovery for dynamic target monitoring

!!! tip "Auto-Detection"
    NextSight AI automatically detects if Prometheus is running in your cluster and integrates with it. No additional configuration needed!

### Kubernetes Cluster Options

If you don't have a Kubernetes cluster yet, here are some options:

=== "Local Development"

    **Docker Desktop** (Recommended for macOS/Windows)
    ```bash
    # Enable Kubernetes in Docker Desktop settings
    # Settings → Kubernetes → Enable Kubernetes
    ```

    **Minikube**
    ```bash
    # Install minikube
    brew install minikube  # macOS
    # or download from https://minikube.sigs.k8s.io/

    # Start cluster
    minikube start --cpus=4 --memory=8192
    ```

    **Kind** (Kubernetes in Docker)
    ```bash
    # Install kind
    brew install kind  # macOS
    # or download from https://kind.sigs.k8s.io/

    # Create cluster
    kind create cluster --name nextsight
    ```

=== "Cloud Providers"

    **Amazon EKS**
    ```bash
    eksctl create cluster \
      --name nextsight-cluster \
      --region us-west-2 \
      --nodegroup-name standard-workers \
      --node-type t3.medium \
      --nodes 3
    ```

    **Google GKE**
    ```bash
    gcloud container clusters create nextsight-cluster \
      --zone us-central1-a \
      --num-nodes 3 \
      --machine-type n1-standard-2
    ```

    **Azure AKS**
    ```bash
    az aks create \
      --resource-group nextsight-rg \
      --name nextsight-cluster \
      --node-count 3 \
      --node-vm-size Standard_D2s_v3
    ```

## Next Steps

- [Quick Start Guide](quickstart.md) - Get familiar with the interface
- [Configuration](configuration.md) - Customize NextSight AI for your environment
- [Architecture](architecture.md) - Understand how NextSight AI works
