# Kubernetes API

API endpoints for Kubernetes cluster management.

## Health

### Get Cluster Health

```http
GET /api/v1/kubernetes/health
```

**Response:**
```json
{
  "status": "healthy",
  "nodes": {
    "total": 3,
    "ready": 3
  },
  "pods": {
    "total": 47,
    "running": 45,
    "pending": 1,
    "failed": 1
  }
}
```

## Pods

### List Pods

```http
GET /api/v1/kubernetes/pods
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| namespace | string | Filter by namespace |
| label | string | Filter by label selector |

**Response:**
```json
[
  {
    "name": "nginx-abc123",
    "namespace": "default",
    "status": "Running",
    "containers": ["nginx"],
    "ready_containers": 1,
    "total_containers": 1,
    "restarts": 0,
    "age": "2d",
    "node": "node-1"
  }
]
```

### Get Pod Details

```http
GET /api/v1/kubernetes/pods/{namespace}/{name}
```

### Get Pod Logs

```http
GET /api/v1/kubernetes/pods/{namespace}/{name}/logs
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| container | string | Container name |
| tail | int | Number of lines |
| timestamps | bool | Include timestamps |

### Delete Pod

```http
DELETE /api/v1/kubernetes/pods/{namespace}/{name}
```

## Deployments

### List Deployments

```http
GET /api/v1/kubernetes/deployments
```

### Scale Deployment

```http
POST /api/v1/kubernetes/scale
```

**Request Body:**
```json
{
  "namespace": "default",
  "deployment": "nginx",
  "replicas": 5
}
```

### Restart Deployment

```http
POST /api/v1/kubernetes/restart
```

**Request Body:**
```json
{
  "namespace": "default",
  "deployment": "nginx"
}
```

## Services

### List Services

```http
GET /api/v1/kubernetes/services
```

## Nodes

### List Nodes

```http
GET /api/v1/kubernetes/nodes
```

### Get Node Details

```http
GET /api/v1/kubernetes/nodes/{name}
```

## Namespaces

### List Namespaces

```http
GET /api/v1/kubernetes/namespaces
```

## Apply Manifest

### Apply YAML

```http
POST /api/v1/kubernetes/apply
```

**Request Body:**
```json
{
  "yaml": "apiVersion: v1\nkind: Pod\n...",
  "namespace": "default",
  "dry_run": false
}
```

## WebSocket Endpoints

### Stream Logs

```
WS /api/v1/ws/pods/{namespace}/{pod}/logs
```

**Query Parameters:**
- `container` - Container name
- `tail_lines` - Initial lines (default: 100)
- `timestamps` - Include timestamps

**Messages:**
```json
{"type": "log", "content": "Log line here"}
{"type": "status", "status": "connected"}
{"type": "error", "error": "...", "code": 500}
```

### Pod Exec

```
WS /api/v1/ws/pods/{namespace}/{pod}/exec
```

**Query Parameters:**
- `container` - Container name
- `shell` - Shell path (default: /bin/sh)

**Client Messages:**
```json
{"type": "input", "data": "ls -la\n"}
{"type": "resize", "cols": 80, "rows": 24}
```

**Server Messages:**
```json
{"type": "output", "data": "..."}
{"type": "status", "status": "connected"}
```
