# Kubernetes Management

NextSight AI provides comprehensive Kubernetes cluster management with real-time monitoring and control.

### Workload Management with Health Indicators

![Kubernetes - Workload management showing pods, deployments with health indicators](../images/kubernetes-workloads.png)

*Manage all Kubernetes workloads with visual health indicators, quick actions, and real-time status updates*

## Resources

### Pods

View and manage all pods:

- **Status** - Running, Pending, Failed, Succeeded
- **Containers** - Container count and status
- **Restart Count** - Number of container restarts
- **Age** - Time since pod creation
- **Node** - Node where pod is scheduled

**Actions:**
- View logs (real-time streaming)
- Open terminal (exec into container)
- Delete pod
- View YAML

### Deployments

Manage deployments with one-click actions:

- **Replicas** - Desired vs. ready replicas
- **Image** - Container image version
- **Strategy** - RollingUpdate or Recreate

**Actions:**
- Scale up/down
- Rolling restart
- Rollback to previous version
- Edit YAML

### Services

View service endpoints and routing:

- **Type** - ClusterIP, NodePort, LoadBalancer
- **Ports** - Port mappings
- **Endpoints** - Backend pod IPs
- **External IP** - LoadBalancer IP (if applicable)

### Nodes

Monitor cluster nodes:

- **Status** - Ready, NotReady conditions
- **Resources** - CPU/Memory capacity and allocatable
- **Pods** - Running pod count
- **Labels** - Node labels and taints

## Operations

### Scaling

Scale deployments directly from the UI:

1. Navigate to **Kubernetes > Deployments**
2. Click the scale buttons (+/-)
3. Or enter a specific replica count

```bash
# Equivalent kubectl command
kubectl scale deployment <name> --replicas=<count> -n <namespace>
```

### Rolling Restart

Trigger a rolling restart without changing the spec:

1. Click **Restart** on a deployment
2. Pods are recreated one by one
3. Zero-downtime restart

```bash
# Equivalent kubectl command
kubectl rollout restart deployment <name> -n <namespace>
```

### Rollback

Rollback to a previous revision:

1. Click **Rollback** on a deployment
2. Select the target revision
3. Confirm the rollback

```bash
# Equivalent kubectl command
kubectl rollout undo deployment <name> -n <namespace>
```

## Real-time Logs

### Live Log Streaming

![Kubernetes - Real-time pod logs with WebSocket streaming and search](../images/pod-logs.png)

*Stream pod logs in real-time with WebSocket support, search functionality, and download option*

Stream pod logs in real-time:

1. Click on a pod
2. Select **Logs** tab
3. Choose container (if multiple)

Features:
- Real-time streaming via WebSocket
- Search and filter
- Download logs
- Timestamp display

## Pod Terminal

Open an interactive terminal:

1. Click on a pod
2. Select **Terminal** tab
3. Choose shell (`/bin/sh`, `/bin/bash`)

Features:
- Full PTY support
- Terminal resize
- Copy/paste support
- Session persistence

## Debug Containers

Debug distroless containers:

1. Click **Debug** on a pod
2. Select debug image (busybox, alpine, netshoot)
3. Interactive debugging session

Uses Kubernetes ephemeral containers feature.

## YAML Deploy

### Manifest Deployment with Validation

![Deploy - YAML editor with dry-run validation and deployment summary](../images/yaml-deploy.png)

*Deploy Kubernetes manifests with syntax validation, dry-run mode, and comprehensive deployment summary*

Apply Kubernetes manifests:

1. Go to **Deploy > YAML**
2. Paste or upload YAML
3. **Dry Run** to validate
4. **Apply** to deploy

Supports:
- Multi-document YAML
- Namespace override
- Validation errors display
