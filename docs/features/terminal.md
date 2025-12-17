# Pod Terminal

NextSight AI provides interactive terminal access to your pods directly from the browser.

### Interactive Shell Access

![Terminal - Interactive xterm.js terminal with pod exec and debug containers](../images/terminal.png)

*Full terminal emulation with PTY support, WebSocket-based communication, and multi-container support*

## Pod Exec

Execute commands inside running containers:

### Opening a Terminal

1. Navigate to **Kubernetes > Pods**
2. Click on a pod
3. Select **Terminal** tab
4. Choose container (if multiple)
5. Select shell (`/bin/sh`, `/bin/bash`)

### Features

- **Full PTY Support** - Colors, cursor movement, tab completion
- **Terminal Resize** - Automatically adjusts to window size
- **Copy/Paste** - Use Ctrl+C/Ctrl+V (or Cmd on Mac)
- **Session Persistence** - Survives page navigation

### Supported Shells

| Shell | Path |
|-------|------|
| sh | /bin/sh |
| bash | /bin/bash |
| ash | /bin/ash |
| zsh | /bin/zsh |

## Debug Containers

For distroless or minimal containers without a shell:

### What Are Debug Containers?

Kubernetes ephemeral containers let you attach a debug container to a running pod without restarting it.

### Opening Debug Session

1. Click **Debug** on a pod
2. Select debug image
3. Optionally target a specific container

### Available Debug Images

| Image | Use Case |
|-------|----------|
| busybox:latest | Basic debugging |
| alpine:latest | Package management |
| nicolaka/netshoot:latest | Network debugging |
| ubuntu:latest | Full toolset |

### Example: Network Debugging

```bash
# Inside netshoot container
dig kubernetes.default.svc.cluster.local
curl http://service-name:8080/health
netstat -tlnp
tcpdump -i eth0
```

## Log Viewer

Real-time log streaming:

### Features

- **WebSocket Streaming** - Live updates
- **Search** - Filter by text
- **Timestamps** - Optional timestamp display
- **Tail Lines** - Configure initial lines (100-1000)
- **Download** - Export logs to file

### Pod Events

For pending/failed pods, view Kubernetes events:

- Scheduling failures
- Image pull errors
- Resource constraints
- Node issues

## kubectl Terminal

Execute kubectl commands directly:

1. Go to **Tools > kubectl Terminal**
2. Enter commands
3. View output

### Safety Features

Dangerous commands are blocked:

- `kubectl delete namespace`
- `kubectl delete --all`
- Custom blocklist

### Common Commands

```bash
kubectl get pods -A
kubectl describe pod <name>
kubectl logs <pod> -f
kubectl top pods
```

## Shell Terminal

Full bash access with pre-installed tools:

- **kubectl** - Kubernetes CLI
- **helm** - Helm package manager
- **curl** - HTTP requests
- **jq** - JSON processing

### Blocked Commands

For security, these are blocked:

- `rm -rf /`
- `sudo`
- `chmod 777`
- Custom patterns

## WebSocket Protocol

### Message Types

**Client → Server:**
```json
{"type": "input", "data": "ls -la\n"}
{"type": "resize", "cols": 80, "rows": 24}
```

**Server → Client:**
```json
{"type": "output", "data": "..."}
{"type": "status", "status": "connected"}
{"type": "error", "error": "...", "code": 500}
```

## Security

### Input Validation

All inputs are validated:

- Kubernetes name format (RFC 1123)
- Shell whitelist
- Debug image whitelist

### RBAC Requirements

Users need these permissions:

```yaml
- apiGroups: [""]
  resources: ["pods/exec"]
  verbs: ["create"]
- apiGroups: [""]
  resources: ["pods/log"]
  verbs: ["get"]
```
