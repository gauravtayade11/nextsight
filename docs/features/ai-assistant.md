# AI Assistant

NextSight AI includes an intelligent assistant powered by Google Gemini that understands your cluster in real-time.

## Overview

The AI assistant can answer questions about:

- **Kubernetes** - Pods, deployments, services, nodes
- **Security** - Vulnerabilities, RBAC, network policies
- **Cost** - Resource costs, optimization
- **Jenkins** - CI/CD pipelines, builds
- **Helm** - Chart releases

## How It Works

1. **Query Analysis** - Detects what data you're asking about
2. **Data Fetch** - Retrieves real-time data from relevant services
3. **AI Response** - Gemini generates a contextual answer

## Example Questions

### Kubernetes Questions

```
"How many pods are running?"
"Show me failed pods"
"What deployments are in the default namespace?"
"Which nodes have high CPU usage?"
```

### Security Questions

```
"What's my security score?"
"Show me critical vulnerabilities"
"Are there any privileged containers?"
"What RBAC issues do I have?"
```

### Cost Questions

```
"What are my top cost consumers?"
"Show me cost by namespace"
"How can I optimize costs?"
```

### Jenkins Questions

```
"What builds failed today?"
"Show me the latest pipeline status"
"How many jobs are in queue?"
```

## Capabilities

### Real-Time Data
The assistant fetches live data, not cached information:

```
User: "How many pods are running right now?"
AI: "Currently, there are 47 pods running across 8 namespaces:
- default: 12 pods
- kube-system: 15 pods
- monitoring: 8 pods
..."
```

### Actionable Recommendations
Get kubectl commands and YAML snippets:

```
User: "How do I scale the nginx deployment?"
AI: "To scale the nginx deployment to 5 replicas:
kubectl scale deployment nginx --replicas=5 -n default

Or edit the deployment:
spec:
  replicas: 5"
```

### Multi-Service Context
Ask about relationships across services:

```
User: "Why is my pod pending?"
AI: "The pod api-server-xyz is pending because:
- Insufficient CPU: Requested 2 cores, only 1.5 available
- Node node-3 has MemoryPressure condition

Recommendations:
1. Scale down other workloads
2. Add a new node
3. Reduce resource requests"
```

## Configuration

### Setting Up Gemini

1. Get an API key from [Google AI Studio](https://aistudio.google.com/)
2. Add to your environment:

```env
GEMINI_API_KEY=your-api-key
GEMINI_MODEL=gemini-1.5-flash
```

### Model Options

| Model | Speed | Capability |
|-------|-------|------------|
| gemini-1.5-flash | Fast | Good for most queries |
| gemini-1.5-pro | Slower | Better for complex analysis |

## API Usage

### Chat Endpoint

```bash
POST /api/v1/ai/chat
Content-Type: application/json

{
  "message": "How many pods are running?",
  "context": "optional additional context"
}
```

### Response

```json
{
  "response": "Currently there are 47 pods running...",
  "sources": ["kubernetes"],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Best Practices

1. **Be Specific** - "Show pods in kube-system" vs "show pods"
2. **Ask Follow-ups** - Build on previous answers
3. **Request Commands** - "How do I fix this?" for actionable steps
4. **Use Context** - The AI understands your current view
