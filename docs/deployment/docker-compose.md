# Docker Compose Deployment

The simplest way to run NextSight AI locally or in development.

## Quick Start

```bash
git clone https://github.com/gauravtayade11/nextsight.git
cd nextsight
docker-compose up -d
```

Access at **http://localhost:3000**

## docker-compose.yml

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: nextsight-postgres
    environment:
      POSTGRES_DB: nextsight
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: nextsight-redis

  backend:
    build: ./backend
    container_name: nextsight-backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/nextsight
      - K8S_CONFIG_PATH=/home/nextsight/.kube/config
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    volumes:
      - ~/.kube:/home/nextsight/.kube:ro
    depends_on:
      - postgres
      - redis

  frontend:
    build: ./frontend
    container_name: nextsight-frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
```

## Environment Configuration

Create a `.env` file:

```env
# AI Provider
GEMINI_API_KEY=your-api-key

# Optional
DEBUG=true
```

## Common Commands

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild after changes
docker-compose up -d --build

# Remove volumes
docker-compose down -v
```

## Using Makefile

```bash
make dev     # Start development
make logs    # View logs
make down    # Stop services
make clean   # Remove containers and volumes
```

## Troubleshooting

### Port Already in Use

```bash
# Check what's using the port
lsof -i :3000
lsof -i :8000

# Use different ports (edit docker-compose.yml)
# Change ports mapping in frontend service
```

### Kubernetes Connection Issues

Ensure your kubeconfig is accessible:

```bash
# Test kubectl access
docker-compose exec nextsight-backend kubectl get nodes
```

### Logs Not Streaming

Check WebSocket connectivity:

```bash
# Test WebSocket
wscat -c ws://localhost:8000/api/v1/ws/health
```
