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
kubectl get pods -n nexops

# Port forward
kubectl port-forward -n nexops svc/nexops-frontend 3000:80
```

## Manifests

### Namespace

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: nexops
```

### RBAC

NextSight AI needs cluster-wide read access:

```yaml
# k8s/rbac.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: nexops
  namespace: nexops
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: nexops-reader
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
  name: nexops-reader
subjects:
  - kind: ServiceAccount
    name: nexops
    namespace: nexops
roleRef:
  kind: ClusterRole
  name: nexops-reader
  apiGroup: rbac.authorization.k8s.io
```

### Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nexops-backend
  namespace: nexops
spec:
  replicas: 1
  selector:
    matchLabels:
      app: nexops-backend
  template:
    metadata:
      labels:
        app: nexops-backend
    spec:
      serviceAccountName: nexops
      containers:
        - name: backend
          image: nexops-backend:latest
          ports:
            - containerPort: 8000
          env:
            - name: K8S_IN_CLUSTER
              value: "true"
            - name: GEMINI_API_KEY
              valueFrom:
                secretKeyRef:
                  name: nexops-secrets
                  key: gemini-api-key
```

### Service

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: nexops-frontend
  namespace: nexops
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 80
  selector:
    app: nexops-frontend
```

### Ingress

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: nexops
  namespace: nexops
  annotations:
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
spec:
  ingressClassName: nginx
  rules:
    - host: nexops.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: nexops-frontend
                port:
                  number: 80
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: nexops-backend
                port:
                  number: 8000
```

## Secrets

Create secrets for sensitive data:

```bash
kubectl create secret generic nexops-secrets \
  --from-literal=gemini-api-key=YOUR_API_KEY \
  -n nexops
```

## Verification

```bash
# Check pods
kubectl get pods -n nexops

# Check logs
kubectl logs -f deployment/nexops-backend -n nexops

# Test connectivity
kubectl port-forward svc/nexops-frontend 3000:80 -n nexops
```

## Updating

```bash
# Update images
kubectl set image deployment/nexops-backend \
  backend=nexops-backend:v1.4.0 -n nexops

# Or apply updated manifests
kubectl apply -f k8s/
```
