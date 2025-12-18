# AI API

API endpoints for the AI assistant.

## Chat

### Send Message

```http
POST /api/v1/ai/chat
```

**Request Body:**
```json
{
  "message": "How many pods are running?",
  "context": "optional additional context"
}
```

**Response:**
```json
{
  "response": "Currently there are 47 pods running across 8 namespaces...",
  "sources": ["kubernetes"],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Example Queries

#### Kubernetes
```json
{"message": "Show me all failed pods"}
{"message": "What's the CPU usage across nodes?"}
{"message": "List deployments in production namespace"}
```

#### Security
```json
{"message": "What's my security score?"}
{"message": "Show critical vulnerabilities"}
{"message": "Are there privileged containers?"}
```

## Health

### Check AI Service Health

```http
GET /api/v1/ai/health
```

**Response:**
```json
{
  "status": "available",
  "model": "gemini-1.5-flash",
  "services": {
    "kubernetes": "connected",
    "security": "connected",
    "jenkins": "disconnected",
    "helm": "connected"
  }
}
```

## Query Types

The AI automatically detects and fetches data for:

| Type | Keywords |
|------|----------|
| pods | pod, pods, running pods |
| deployments | deployment, replicas, rollout |
| services | service, svc, endpoints |
| nodes | node, worker, master |
| security | security, vulnerability, CVE |
| jenkins | build, pipeline, job |
| helm | chart, release, helm |

## Rate Limiting

AI endpoints have stricter rate limits:

- **20 requests per minute** per user
- **429 Too Many Requests** when exceeded

## Error Responses

### Model Not Available

```json
{
  "detail": "AI model not available",
  "status_code": 503
}
```

### Invalid Request

```json
{
  "detail": "Message cannot be empty",
  "status_code": 400
}
```

## Best Practices

1. **Be Specific** - Include namespace or resource names
2. **Ask for Actions** - Request kubectl commands
3. **Use Context** - Provide additional context when helpful
4. **Follow Up** - Ask clarifying questions
