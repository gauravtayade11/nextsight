# Quick Start

Get up and running with NextSight AI in minutes.

## First Login

1. Open **http://localhost:3000** in your browser
2. Login with default credentials:
   - Username: `admin`
   - Password: `admin123`

## Dashboard Overview

After logging in, you'll see the main dashboard with:

- **Cluster Health** - Overall status of your Kubernetes cluster
- **Resource Metrics** - CPU and memory utilization
- **Pod Status** - Running, pending, and failed pods
- **Recent Events** - Latest cluster events

## Connecting to Your Cluster

NextSight AI automatically detects your Kubernetes configuration:

### Local Development
If you have `~/.kube/config`, NextSight AI will use it automatically.

### In-Cluster Deployment
When deployed inside Kubernetes, NextSight AI uses the service account credentials.

### Custom Configuration
Set the `K8S_CONFIG_PATH` environment variable:

```bash
K8S_CONFIG_PATH=/path/to/your/kubeconfig
```

## Key Features to Try

### 1. Kubernetes Resources
Navigate to **Kubernetes** to see:

- All pods across namespaces
- Deployments with scaling controls
- Services and endpoints
- Node status and metrics

### 2. Security Dashboard
Check your cluster's security posture:

- Security score (A-F grade)
- Vulnerability findings
- RBAC analysis
- Remediation recommendations

### 3. AI Assistant
Ask questions in natural language:

- "How many pods are running?"
- "What are the security issues?"
- "Show me high memory usage pods"

### 4. Pod Terminal
Execute commands inside pods:

1. Go to **Kubernetes > Pods**
2. Click on a pod
3. Click **Terminal** to open an interactive shell

## Next Steps

- [Configuration Guide](configuration.md) - Set up AI providers and customize settings
- [Kubernetes Features](../features/kubernetes.md) - Deep dive into K8s management
- [Security Dashboard](../features/security.md) - Understand security scanning
