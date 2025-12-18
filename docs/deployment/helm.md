# Helm Chart Deployment

Deploy NextSight AI using the official Helm chart.

## Installation

### From Local Chart

```bash
helm install nextsight ./charts/nextsight \
  -n nextsight --create-namespace
```

### With Custom Values

```bash
helm install nextsight ./charts/nextsight \
  -n nextsight --create-namespace \
  -f values-production.yaml
```

### From Repository (Coming Soon)

```bash
helm repo add nextsight https://gauravtayade11.github.io/nextsight/charts
helm install nextsight nextsight/nextsight -n nextsight --create-namespace
```

## Configuration

### values.yaml

```yaml
# Backend configuration
backend:
  replicaCount: 1
  image:
    repository: nextsight-backend
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
          name: nextsight-secrets
          key: gemini-api-key

# Frontend configuration
frontend:
  replicaCount: 1
  image:
    repository: nextsight-frontend
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
    - host: nextsight.local
      paths:
        - path: /
          pathType: Prefix
  tls: []

# Service account
serviceAccount:
  create: true
  name: nextsight

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
    - host: nextsight.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: nextsight-tls
      hosts:
        - nextsight.example.com
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
    database: nextsight
```

## Operations

### Upgrade

```bash
helm upgrade nextsight ./charts/nextsight -n nextsight
```

### Rollback

```bash
helm rollback nextsight 1 -n nextsight
```

### Uninstall

```bash
helm uninstall nextsight -n nextsight
```

### View Values

```bash
helm get values nextsight -n nextsight
```

## Troubleshooting

### Check Release Status

```bash
helm status nextsight -n nextsight
```

### View Manifest

```bash
helm get manifest nextsight -n nextsight
```

### Debug Installation

```bash
helm install nextsight ./charts/nextsight \
  -n nextsight --create-namespace \
  --debug --dry-run
```
