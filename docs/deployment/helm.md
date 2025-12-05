# Helm Chart Deployment

Deploy NextSight AI using the official Helm chart.

## Installation

### From Local Chart

```bash
helm install nexops ./charts/nexops \
  -n nexops --create-namespace
```

### With Custom Values

```bash
helm install nexops ./charts/nexops \
  -n nexops --create-namespace \
  -f values-production.yaml
```

### From Repository (Coming Soon)

```bash
helm repo add nexops https://gauravtayade11.github.io/nexops/charts
helm install nexops nexops/nexops -n nexops --create-namespace
```

## Configuration

### values.yaml

```yaml
# Backend configuration
backend:
  replicaCount: 1
  image:
    repository: nexops-backend
    tag: latest
    pullPolicy: IfNotPresent
  resources:
    limits:
      cpu: 1000m
      memory: 1Gi
    requests:
      cpu: 200m
      memory: 256Mi
  extraEnv:
    - name: GEMINI_API_KEY
      valueFrom:
        secretKeyRef:
          name: nexops-secrets
          key: gemini-api-key

# Frontend configuration
frontend:
  replicaCount: 1
  image:
    repository: nexops-frontend
    tag: latest
    pullPolicy: IfNotPresent
  resources:
    limits:
      cpu: 200m
      memory: 256Mi
    requests:
      cpu: 50m
      memory: 64Mi

# Ingress configuration
ingress:
  enabled: false
  className: nginx
  annotations:
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
  hosts:
    - host: nexops.local
      paths:
        - path: /
          pathType: Prefix
  tls: []

# Service account
serviceAccount:
  create: true
  name: nexops

# RBAC
rbac:
  create: true
```

## Common Configurations

### Enable Ingress

```yaml
ingress:
  enabled: true
  className: nginx
  hosts:
    - host: nexops.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: nexops-tls
      hosts:
        - nexops.example.com
```

### High Availability

```yaml
backend:
  replicaCount: 3
  resources:
    limits:
      cpu: 2000m
      memory: 2Gi

frontend:
  replicaCount: 2
```

### External Database (Future)

```yaml
database:
  enabled: false
  external:
    host: postgres.example.com
    port: 5432
    database: nexops
```

## Operations

### Upgrade

```bash
helm upgrade nexops ./charts/nexops -n nexops
```

### Rollback

```bash
helm rollback nexops 1 -n nexops
```

### Uninstall

```bash
helm uninstall nexops -n nexops
```

### View Values

```bash
helm get values nexops -n nexops
```

## Troubleshooting

### Check Release Status

```bash
helm status nexops -n nexops
```

### View Manifest

```bash
helm get manifest nexops -n nexops
```

### Debug Installation

```bash
helm install nexops ./charts/nexops \
  -n nexops --create-namespace \
  --debug --dry-run
```
