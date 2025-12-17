# Kubernetes Deployment

Deploy NextSight AI to your Kubernetes cluster.

## Prerequisites

- Kubernetes 1.24+
- kubectl configured
- Cluster admin access (for RBAC setup)

## Quick Deploy

```bash
# Apply manifests
kubectl apply -f k8s/

# Check status
kubectl get pods -n nextsight

# Port forward
kubectl port-forward -n nextsight svc/nextsight-frontend 3000:80
```

## Manifests

### Namespace

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: nextsight
```

### RBAC

NextSight AI needs cluster-wide read access:

```yaml
# k8s/rbac.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: nextsight
  namespace: nextsight
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: nextsight-reader
rules:
  - apiGroups: [""]
    resources: ["pods", "services", "nodes", "namespaces", "events", "configmaps"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments", "statefulsets", "daemonsets", "replicasets"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["pods/log", "pods/exec"]
    verbs: ["get", "create"]
  - apiGroups: ["metrics.k8s.io"]
    resources: ["pods", "nodes"]
    verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: nextsight-reader
subjects:
  - kind: ServiceAccount
    name: nextsight
    namespace: nextsight
roleRef:
  kind: ClusterRole
  name: nextsight-reader
  apiGroup: rbac.authorization.k8s.io
```

### Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nextsight-backend
  namespace: nextsight
spec:
  replicas: 1
  selector:
    matchLabels:
      app: nextsight-backend
  template:
    metadata:
      labels:
        app: nextsight-backend
    spec:
      serviceAccountName: nextsight
      containers:
        - name: backend
          image: nextsight-backend:latest
          ports:
            - containerPort: 8000
          env:
            - name: K8S_IN_CLUSTER
              value: "true"
            - name: GEMINI_API_KEY
              valueFrom:
                secretKeyRef:
                  name: nextsight-secrets
                  key: gemini-api-key
```

### Service

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: nextsight-frontend
  namespace: nextsight
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 80
  selector:
    app: nextsight-frontend
```

### Ingress

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: nextsight
  namespace: nextsight
  annotations:
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
spec:
  ingressClassName: nginx
  rules:
    - host: nextsight.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: nextsight-frontend
                port:
                  number: 80
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: nextsight-backend
                port:
                  number: 8000
```

## Secrets

Create secrets for sensitive data:

```bash
kubectl create secret generic nextsight-secrets \
  --from-literal=gemini-api-key=YOUR_API_KEY \
  -n nextsight
```

## Verification

```bash
# Check pods
kubectl get pods -n nextsight

# Check logs
kubectl logs -f deployment/nextsight-backend -n nextsight

# Test connectivity
kubectl port-forward svc/nextsight-frontend 3000:80 -n nextsight
```

## Updating

```bash
# Update images
kubectl set image deployment/nextsight-backend \
  backend=nextsight-backend:v1.4.0 -n nextsight

# Or apply updated manifests
kubectl apply -f k8s/
```
