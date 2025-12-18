---
title: API Reference
description: NextSight AI REST API documentation - endpoints, authentication, and examples
---

# API Reference

NextSight AI exposes a comprehensive REST API for programmatic access to all features.

## Base URL

```
http://localhost:8000/api/v1
```

## Authentication

All API endpoints require authentication using JWT tokens:

```bash
curl -H "Authorization: Bearer <token>" \
     http://localhost:8000/api/v1/kubernetes/pods
```

## API Categories

<div class="grid" markdown>

<div class="card" markdown>
### :material-kubernetes: Kubernetes API
Manage pods, deployments, services, and nodes programmatically.

[:octicons-arrow-right-24: Kubernetes API](kubernetes.md)
</div>

<div class="card" markdown>
### :material-shield-check: Security API
Access security scans, findings, and remediation suggestions.

[:octicons-arrow-right-24: Security API](security.md)
</div>

<div class="card" markdown>
### :material-robot: AI API
Interact with the AI assistant and get intelligent insights.

[:octicons-arrow-right-24: AI API](ai.md)
</div>

</div>

## Quick Reference

### Common Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/kubernetes/pods` | GET | List all pods |
| `/kubernetes/deployments` | GET | List deployments |
| `/security/scan` | POST | Trigger security scan |
| `/ai/chat` | POST | Send AI query |

### Response Format

All responses follow a consistent JSON structure:

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully",
  "timestamp": "2024-12-05T10:30:00Z"
}
```

### Error Handling

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found",
    "details": { ... }
  },
  "timestamp": "2024-12-05T10:30:00Z"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Internal Server Error |

## Rate Limiting

API requests are rate-limited to prevent abuse:

- **Standard tier**: 100 requests/minute
- **Authenticated**: 1000 requests/minute

## WebSocket Endpoints

For real-time features, NextSight AI provides WebSocket endpoints:

| Endpoint | Purpose |
|----------|---------|
| `/ws/logs/{pod}` | Real-time log streaming |
| `/ws/exec/{pod}` | Pod terminal session |
| `/ws/events` | Cluster event stream |

## SDK & Libraries

!!! info "Coming Soon"

    Official SDKs for Python, JavaScript, and Go are in development.
