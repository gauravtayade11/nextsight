# AI Assistant

NextSight AI includes an intelligent assistant powered by your choice of AI provider (Groq, Gemini, or Claude) that understands your cluster in real-time.

!!! tip "Groq Recommended"
    We recommend Groq for blazing fast responses with a generous free tier (14,400 requests/day). Gemini and Claude are also supported for different use cases.

### Intelligent Cluster Assistant

![AI Assistant - Natural language chat interface with real-time cluster insights](../images/ai-assistant.png)

*Ask questions in plain English and get intelligent answers powered by Groq, Gemini, or Claude with real-time cluster data*

## Overview

The AI assistant can answer questions about:

- **Kubernetes** - Pods, deployments, services, nodes
- **Security** - Vulnerabilities, RBAC, network policies
- **Jenkins** - CI/CD pipelines, builds
- **Helm** - Chart releases

## How It Works

1. **Query Analysis** - Detects what data you're asking about
2. **Data Fetch** - Retrieves real-time data from relevant services
3. **AI Response** - Your configured AI provider generates a contextual answer

## Supported AI Providers

| Provider | Speed | Cost | Best For |
|----------|-------|------|----------|
| **Groq** (Llama 3.3) | ⚡⚡⚡ Ultra-fast | Free (14.4K req/day) | General use (recommended) |
| **Gemini** 2.0 | ⚡⚡ Fast | Free (limited) | Multimodal analysis |
| **Claude** Sonnet 4 | ⚡⚡ Fast | Paid | Highest quality responses |

See [Configuration Guide](../getting-started/configuration.md#ai-provider-setup) for setup instructions.

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
