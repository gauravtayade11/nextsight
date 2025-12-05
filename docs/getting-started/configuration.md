# Configuration

Configure NextSight AI for your environment.

## Environment Variables

Create a `.env` file in the backend directory:

```env
# Application
APP_NAME=NextSight AI
DEBUG=false

# Kubernetes (for local development)
K8S_CONFIG_PATH=~/.kube/config
K8S_IN_CLUSTER=false

# AI Provider
AI_PROVIDER=gemini
GEMINI_API_KEY=your-api-key
GEMINI_MODEL=gemini-1.5-flash

# Jenkins (optional)
JENKINS_URL=http://jenkins.example.com
JENKINS_USER=admin
JENKINS_TOKEN=your-token

# Security
SECRET_KEY=your-secret-key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

## Kubernetes Configuration

### Local Development

```env
K8S_CONFIG_PATH=~/.kube/config
K8S_IN_CLUSTER=false
```

### In-Cluster Deployment

```env
K8S_IN_CLUSTER=true
```

The service account must have appropriate RBAC permissions. See [RBAC Setup](../deployment/kubernetes.md#rbac).

## AI Provider Setup

### Google Gemini (Recommended)

1. Get an API key from [Google AI Studio](https://aistudio.google.com/)
2. Set the environment variables:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your-api-key
GEMINI_MODEL=gemini-1.5-flash
```

Available models:
- `gemini-1.5-flash` - Fast, efficient (recommended)
- `gemini-1.5-pro` - More capable, slower

## Security Settings

### JWT Configuration

```env
SECRET_KEY=your-super-secret-key-change-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

!!! danger "Production Security"
    Always change the `SECRET_KEY` in production environments!

### CORS Settings

By default, NextSight AI allows requests from localhost. For production:

```env
CORS_ORIGINS=https://nexops.example.com
```

## Jenkins Integration

To enable Jenkins CI/CD integration:

```env
JENKINS_URL=http://jenkins.example.com
JENKINS_USER=admin
JENKINS_TOKEN=your-api-token
```

## Helm Chart Values

When deploying with Helm, use `values.yaml`:

```yaml
backend:
  replicaCount: 1
  extraEnv:
    - name: GEMINI_API_KEY
      valueFrom:
        secretKeyRef:
          name: nexops-secrets
          key: gemini-api-key

frontend:
  replicaCount: 1

ingress:
  enabled: true
  hosts:
    - host: nexops.example.com
      paths:
        - path: /
          pathType: Prefix
```

See [Helm Chart documentation](../deployment/helm.md) for all options.
