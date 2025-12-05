# API Overview

NextSight AI provides a RESTful API for all operations.

## Base URL

```
http://localhost:8000/api/v1
```

## Authentication

All API endpoints require JWT authentication:

```bash
# Get token
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# Use token
curl http://localhost:8000/api/v1/kubernetes/pods \
  -H "Authorization: Bearer <token>"
```

## Response Format

All responses follow this format:

```json
{
  "data": {...},
  "error": null,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Error Response

```json
{
  "detail": "Error message",
  "status_code": 400
}
```

## Common HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Internal Server Error |

## Endpoints Overview

### Kubernetes
- `GET /kubernetes/health` - Cluster health
- `GET /kubernetes/pods` - List pods
- `GET /kubernetes/deployments` - List deployments
- `POST /kubernetes/scale` - Scale deployment

### Security
- `GET /security/score` - Security score
- `GET /security/findings` - Security findings
- `GET /security/scan` - Trigger scan

### AI
- `POST /ai/chat` - Chat with AI
- `GET /ai/health` - AI service health

### WebSocket
- `WS /ws/pods/{ns}/{pod}/logs` - Stream logs
- `WS /ws/pods/{ns}/{pod}/exec` - Pod exec

## Rate Limiting

API requests are rate limited:

- **Default**: 100 requests/minute
- **AI Endpoints**: 20 requests/minute

## OpenAPI Documentation

Interactive API docs available at:

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`
