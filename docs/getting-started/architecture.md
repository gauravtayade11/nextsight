# Architecture

NextSight AI follows a modern microservices architecture designed for scalability and reliability.

![Architecture Overview](../images/architecture.svg)

## System Overview

```mermaid
graph TB
    subgraph Client["Client Layer"]
        Browser[("Web Browser")]
    end

    subgraph Frontend["Frontend - React"]
        UI[React App<br/>TypeScript + Vite]
        XTerm[xterm.js<br/>Terminal]
        TailwindCSS[Tailwind CSS<br/>Styling]
    end

    subgraph Backend["Backend - FastAPI"]
        API[REST API<br/>FastAPI]
        WS[WebSocket<br/>Server]
        Auth[JWT<br/>Authentication]
    end

    subgraph Services["Core Services"]
        K8S[Kubernetes<br/>Service]
        SEC[Security<br/>Service]
        AI[AI<br/>Service]
    end

    subgraph Cache["Cache Layer"]
        Redis[(Redis)]
    end

    subgraph External["External Services"]
        Gemini[Google Gemini<br/>AI Model]
        Trivy[Trivy<br/>Scanner]
    end

    subgraph Kubernetes["Kubernetes Cluster"]
        KAPI[K8s API Server]
        Pods[Pods]
        Deployments[Deployments]
        Nodes[Nodes]
    end

    Browser --> UI
    UI --> API
    UI --> WS
    XTerm --> WS

    API --> Auth
    API --> K8S
    API --> SEC
    API --> AI

    WS --> K8S

    K8S --> KAPI
    SEC --> Trivy
    AI --> Gemini

    K8S --> Redis
    SEC --> Redis

    KAPI --> Pods
    KAPI --> Deployments
    KAPI --> Nodes
```

## Component Details

### Frontend

| Component | Technology | Purpose |
|-----------|------------|---------|
| **React App** | React 18, TypeScript | User interface |
| **Vite** | Build tool | Fast development & builds |
| **Tailwind CSS** | Styling | Glass-morphism design |
| **xterm.js** | Terminal emulator | Pod exec & logs |
| **Framer Motion** | Animations | Smooth transitions |

### Backend

| Component | Technology | Purpose |
|-----------|------------|---------|
| **FastAPI** | Python 3.11 | REST API framework |
| **WebSockets** | asyncio | Real-time streaming |
| **kubernetes-client** | Python SDK | Cluster communication |
| **JWT** | PyJWT | Authentication |

### Services

| Service | Responsibility |
|---------|----------------|
| **Kubernetes Service** | Pod, deployment, service, node operations |
| **Security Service** | Vulnerability scanning, RBAC analysis |
| **AI Service** | Gemini integration, query processing |

## Data Flow

### API Request Flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant F as Frontend
    participant A as API
    participant S as Service
    participant K as K8s API

    B->>F: User Action
    F->>A: HTTP Request
    A->>A: JWT Validation
    A->>S: Process Request
    S->>K: Kubernetes API Call
    K-->>S: Response
    S-->>A: Processed Data
    A-->>F: JSON Response
    F-->>B: Update UI
```

### WebSocket Flow (Terminal/Logs)

```mermaid
sequenceDiagram
    participant B as Browser
    participant X as xterm.js
    participant W as WebSocket
    participant K as K8s API

    B->>X: Open Terminal
    X->>W: Connect WebSocket
    W->>K: Pod Exec Stream

    loop Interactive Session
        X->>W: Input (keystrokes)
        W->>K: stdin
        K-->>W: stdout/stderr
        W-->>X: Output
        X-->>B: Render
    end
```

## Deployment Architecture

### Docker Compose

```mermaid
graph LR
    subgraph Docker["Docker Compose"]
        FE[frontend<br/>:3000]
        BE[backend<br/>:8000]
        RD[(redis<br/>:6379)]
    end

    FE --> BE
    BE --> RD
    BE --> K8S[(K8s Cluster)]
```

### Kubernetes Deployment

```mermaid
graph TB
    subgraph Ingress["Ingress Controller"]
        ING[NGINX Ingress]
    end

    subgraph Namespace["nextsight namespace"]
        subgraph Frontend
            FE1[frontend-1]
            FE2[frontend-2]
        end

        subgraph Backend
            BE1[backend-1]
            BE2[backend-2]
        end

        SVC_FE[frontend-svc]
        SVC_BE[backend-svc]

        RD[(Redis)]
        CM[ConfigMap]
        SEC[Secrets]
    end

    ING --> SVC_FE
    ING --> SVC_BE
    SVC_FE --> FE1
    SVC_FE --> FE2
    SVC_BE --> BE1
    SVC_BE --> BE2
    BE1 --> RD
    BE2 --> RD
```

## Security Architecture

```mermaid
graph TB
    subgraph Security["Security Layers"]
        JWT[JWT Auth]
        RBAC[K8s RBAC]
        TLS[TLS/HTTPS]
        VAL[Input Validation]
    end

    subgraph Scanning["Security Scanning"]
        TRIVY[Trivy Scanner]
        RBAC_A[RBAC Analyzer]
        NET[Network Policy<br/>Analyzer]
    end

    subgraph AI["AI Security"]
        REM[AI Remediation]
        REC[Recommendations]
    end

    JWT --> RBAC
    RBAC --> TRIVY
    TRIVY --> REM
    RBAC_A --> REC
    NET --> REC
```

## Technology Stack Summary

### Languages & Frameworks

- **Python 3.11** - Backend services
- **TypeScript** - Frontend application
- **React 18** - UI components
- **FastAPI** - REST API

### Infrastructure

- **Docker** - Containerization
- **Kubernetes** - Orchestration
- **Helm** - Package management
- **Redis** - Caching

### External Integrations

- **Google Gemini** - AI assistant
- **Trivy** - Vulnerability scanning
- **GitHub Actions** - CI/CD

## Scalability Considerations

| Component | Scaling Strategy |
|-----------|-----------------|
| Frontend | Horizontal (replicas) |
| Backend | Horizontal (replicas) |
| Redis | Single instance / Sentinel |
| API Calls | Rate limiting |
| WebSockets | Sticky sessions |
