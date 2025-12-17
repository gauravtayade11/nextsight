# Development Setup

Set up your local development environment for NextSight AI.

## Prerequisites

- Python 3.11+
- Node.js 18+
- Docker & Docker Compose
- kubectl configured

## Clone Repository

```bash
git clone https://github.com/gauravtayade11/nextsight.git
cd nextsight
```

## Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or: venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env with your settings

# Run development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

Access at **http://localhost:5173**

## Running with Docker

```bash
# Development mode
make dev

# Or manually
docker-compose up -d --build
```

## Project Structure

```
nextsight/
├── backend/                 # FastAPI Backend
│   ├── app/
│   │   ├── api/routes/     # REST API endpoints
│   │   ├── core/           # Configuration & settings
│   │   ├── schemas/        # Pydantic models
│   │   └── services/       # Business logic
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/               # React Frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # API client
│   │   └── types/          # TypeScript types
│   ├── Dockerfile
│   └── package.json
├── k8s/                    # Kubernetes Manifests
├── charts/                 # Helm Charts
├── docs/                   # Documentation
└── docker-compose.yml
```

## Running Tests

### Backend Tests

```bash
cd backend
pytest
pytest --cov=app  # With coverage
```

### Frontend Tests

```bash
cd frontend
npm run test
npm run lint
```

## Building for Production

```bash
# Build images
make build-prod

# Or manually
docker build -t nextsight-backend:latest ./backend
docker build -t nextsight-frontend:latest ./frontend
```

## Environment Variables

### Backend

| Variable | Description | Default |
|----------|-------------|---------|
| DEBUG | Enable debug mode | false |
| K8S_CONFIG_PATH | Kubeconfig path | ~/.kube/config |
| K8S_IN_CLUSTER | Running in cluster | false |
| GEMINI_API_KEY | Gemini API key | - |

### Frontend

| Variable | Description | Default |
|----------|-------------|---------|
| VITE_API_URL | Backend API URL | http://localhost:8000 |

## IDE Setup

### VS Code

Recommended extensions:
- Python
- Pylance
- ESLint
- Prettier
- Tailwind CSS IntelliSense

### PyCharm

Enable:
- FastAPI support
- Black formatter
- isort
