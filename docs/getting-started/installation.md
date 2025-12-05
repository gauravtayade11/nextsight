# Installation

This guide covers all the ways to install and run NextSight AI.

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Docker | 20.10+ |
| Docker Compose | 2.0+ |
| kubectl | 1.25+ |
| Kubernetes Cluster | 1.24+ |

## Docker Compose (Recommended)

The fastest way to get started is using Docker Compose:

```bash
# Clone the repository
git clone https://github.com/gauravtayade11/nexops.git
cd nexops

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
kubectl port-forward -n nexops svc/nexops-frontend 3000:80
```

## Helm Installation

For production deployments, use the Helm chart:

```bash
# Install from local chart
helm install nexops ./charts/nexops -n nexops --create-namespace

# Install with custom values
helm install nexops ./charts/nexops -n nexops --create-namespace \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=nexops.example.com

# Upgrade existing installation
helm upgrade nexops ./charts/nexops -n nexops

# Uninstall
helm uninstall nexops -n nexops
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

## Next Steps

- [Quick Start Guide](quickstart.md) - Get familiar with the interface
- [Configuration](configuration.md) - Customize NextSight AI for your environment
