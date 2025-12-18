# NextSight v1.2.0 - Feature Implementation Plan

## Overview

This document outlines the implementation plan for 4 major features:
1. **Multi-Cluster Support** - Manage multiple Kubernetes clusters
2. **RBAC Integration** - Role-based access control
3. **Helm Chart Deployment UI** - Visual Helm management
4. **Cost Analysis Dashboard** - Resource cost monitoring

---

## Feature 1: Multi-Cluster Support

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │  ClusterContext (active cluster, available list) │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │  ClusterSwitcher (header dropdown)               │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    Backend                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │  ClusterService (manages multiple K8s clients)   │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │  /api/v1/clusters/* endpoints                    │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Backend Implementation

**New Files:**
- `backend/app/services/cluster_service.py` - Multi-cluster management
- `backend/app/schemas/cluster.py` - Cluster schemas
- `backend/app/api/routes/clusters.py` - Cluster endpoints

**Changes:**
- `backend/app/core/config.py` - Add cluster configuration
- `backend/app/services/kubernetes_service.py` - Accept cluster parameter
- All existing K8s routes - Add `cluster_id` query parameter

**Cluster Configuration (config.py):**
```python
CLUSTERS: List[Dict] = [
    {
        "id": "default",
        "name": "Local Cluster",
        "kubeconfig_path": "~/.kube/config",
        "context": None,  # Use default context
        "is_default": True
    }
]
```

**API Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/clusters` | GET | List all configured clusters |
| `/api/v1/clusters/{id}` | GET | Get cluster details & status |
| `/api/v1/clusters/{id}/health` | GET | Check cluster connectivity |
| `/api/v1/clusters/active` | GET | Get current active cluster |
| `/api/v1/clusters/active` | PUT | Set active cluster |

### Frontend Implementation

**New Files:**
- `frontend/src/contexts/ClusterContext.tsx` - Cluster state management
- `frontend/src/components/common/ClusterSwitcher.tsx` - Header dropdown

**Changes:**
- `frontend/src/App.tsx` - Add ClusterProvider
- `frontend/src/components/common/Layout.tsx` - Add ClusterSwitcher to header
- `frontend/src/services/api.ts` - Add cluster parameter to all K8s calls

**ClusterContext Interface:**
```typescript
interface ClusterContextType {
  clusters: Cluster[];
  activeCluster: Cluster | null;
  setActiveCluster: (clusterId: string) => void;
  refreshClusters: () => void;
  loading: boolean;
}
```

---

## Feature 2: RBAC Integration

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 Authentication Flow                      │
│                                                          │
│  Login → JWT Token → Store in localStorage → API Header  │
│                                                          │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  Authorization Flow                      │
│                                                          │
│  Request → JWT Validation → Role Check → Action Guard    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### User Roles

| Role | Permissions |
|------|-------------|
| **viewer** | Read-only access to all resources |
| **operator** | Viewer + scale, restart, view logs |
| **developer** | Operator + deploy, exec, kubectl |
| **admin** | Full access including RBAC management |

### Backend Implementation

**New Files:**
- `backend/app/services/auth_service.py` - Authentication logic
- `backend/app/schemas/auth.py` - Auth schemas
- `backend/app/api/routes/auth.py` - Auth endpoints
- `backend/app/core/security.py` - JWT utilities
- `backend/app/middleware/auth.py` - Auth middleware
- `backend/app/models/user.py` - User model (SQLite/JSON storage)

**API Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/auth/login` | POST | User login, returns JWT |
| `/api/v1/auth/logout` | POST | Invalidate token |
| `/api/v1/auth/me` | GET | Current user info |
| `/api/v1/auth/refresh` | POST | Refresh JWT token |
| `/api/v1/users` | GET | List users (admin only) |
| `/api/v1/users` | POST | Create user (admin only) |
| `/api/v1/users/{id}` | PUT | Update user (admin only) |
| `/api/v1/users/{id}` | DELETE | Delete user (admin only) |
| `/api/v1/audit` | GET | Get audit logs |

**Permission Guard Decorator:**
```python
@require_permission("deployments:scale")
async def scale_deployment(...):
    ...
```

### Frontend Implementation

**New Files:**
- `frontend/src/contexts/AuthContext.tsx` - Auth state management
- `frontend/src/components/auth/LoginPage.tsx` - Login form
- `frontend/src/components/auth/ProtectedRoute.tsx` - Route guard
- `frontend/src/components/admin/UserManagement.tsx` - User CRUD

**Changes:**
- `frontend/src/App.tsx` - Add AuthProvider, protected routes
- `frontend/src/services/api.ts` - Add auth header interceptor
- All action buttons - Check permissions before rendering

**AuthContext Interface:**
```typescript
interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  isAuthenticated: boolean;
}
```

### Audit Logging

Every user action logged with:
- Timestamp
- User ID
- Action type
- Resource affected
- Request details
- Response status

---

## Feature 3: Helm Chart Deployment UI

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Helm UI Flow                          │
│                                                          │
│  Browse Repos → Select Chart → Configure Values → Deploy │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Backend Implementation

**New Files:**
- `backend/app/services/helm_service.py` - Helm operations
- `backend/app/schemas/helm.py` - Helm schemas
- `backend/app/api/routes/helm.py` - Helm endpoints

**Helm Operations (using subprocess with helm CLI):**
```python
class HelmService:
    async def list_repos(self) -> List[HelmRepo]
    async def add_repo(self, name: str, url: str) -> bool
    async def search_charts(self, keyword: str) -> List[HelmChart]
    async def get_chart_values(self, chart: str) -> dict
    async def list_releases(self, namespace: str) -> List[HelmRelease]
    async def install(self, release: str, chart: str, values: dict) -> HelmRelease
    async def upgrade(self, release: str, chart: str, values: dict) -> HelmRelease
    async def rollback(self, release: str, revision: int) -> HelmRelease
    async def uninstall(self, release: str, namespace: str) -> bool
    async def get_release_history(self, release: str) -> List[HelmRevision]
```

**API Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/helm/repos` | GET | List configured repos |
| `/api/v1/helm/repos` | POST | Add new repo |
| `/api/v1/helm/repos/{name}` | DELETE | Remove repo |
| `/api/v1/helm/charts` | GET | Search charts |
| `/api/v1/helm/charts/{name}/values` | GET | Get default values |
| `/api/v1/helm/releases` | GET | List installed releases |
| `/api/v1/helm/releases` | POST | Install chart |
| `/api/v1/helm/releases/{name}` | GET | Get release details |
| `/api/v1/helm/releases/{name}` | PUT | Upgrade release |
| `/api/v1/helm/releases/{name}` | DELETE | Uninstall release |
| `/api/v1/helm/releases/{name}/rollback` | POST | Rollback to revision |
| `/api/v1/helm/releases/{name}/history` | GET | Get revision history |

### Frontend Implementation

**New Files:**
- `frontend/src/components/helm/HelmDashboard.tsx` - Main Helm view
- `frontend/src/components/helm/ChartBrowser.tsx` - Browse/search charts
- `frontend/src/components/helm/ReleaseList.tsx` - Installed releases
- `frontend/src/components/helm/InstallChart.tsx` - Install wizard
- `frontend/src/components/helm/ValuesEditor.tsx` - YAML values editor
- `frontend/src/components/helm/ReleaseDetail.tsx` - Release info & history

**Changes:**
- `frontend/src/App.tsx` - Add /helm routes
- `frontend/src/components/common/Layout.tsx` - Add Helm nav item
- `frontend/src/services/api.ts` - Add helmApi
- `frontend/src/types/index.ts` - Add Helm types

**UI Components:**
1. **Chart Browser** - Search, filter by repo, view chart info
2. **Values Editor** - Monaco/CodeMirror YAML editor with validation
3. **Release Manager** - List, upgrade, rollback, uninstall
4. **Install Wizard** - Step-by-step: Select chart → Configure → Review → Deploy

---

## Feature 4: Cost Analysis Dashboard

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 Cost Data Sources                        │
│                                                          │
│  K8s Metrics → Resource Usage → Cost Calculation         │
│                                                          │
│  Cloud Provider APIs (optional) → Actual Billing Data    │
│                                                          │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                 Cost Dashboard                           │
│                                                          │
│  Overview → By Namespace → By Workload → Recommendations │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Cost Calculation Model

**Resource Pricing (configurable):**
```python
DEFAULT_PRICING = {
    "cpu_per_core_hour": 0.031,      # $ per CPU core per hour
    "memory_per_gb_hour": 0.004,     # $ per GB RAM per hour
    "storage_per_gb_month": 0.10,    # $ per GB storage per month
    "network_egress_per_gb": 0.12,   # $ per GB egress
}
```

### Backend Implementation

**New Files:**
- `backend/app/services/cost_service.py` - Cost calculations
- `backend/app/schemas/cost.py` - Cost schemas
- `backend/app/api/routes/cost.py` - Cost endpoints

**Cost Service Methods:**
```python
class CostService:
    async def get_cluster_cost(self, period: str) -> ClusterCost
    async def get_namespace_costs(self, period: str) -> List[NamespaceCost]
    async def get_workload_costs(self, namespace: str) -> List[WorkloadCost]
    async def get_cost_trends(self, days: int) -> CostTrends
    async def get_recommendations(self) -> List[CostRecommendation]
    async def get_idle_resources(self) -> List[IdleResource]
```

**API Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/cost/overview` | GET | Cluster cost summary |
| `/api/v1/cost/namespaces` | GET | Cost by namespace |
| `/api/v1/cost/namespaces/{ns}/workloads` | GET | Cost by workload |
| `/api/v1/cost/trends` | GET | Historical cost data |
| `/api/v1/cost/recommendations` | GET | Optimization suggestions |
| `/api/v1/cost/idle` | GET | Idle/underutilized resources |
| `/api/v1/cost/settings` | GET/PUT | Pricing configuration |

### Frontend Implementation

**New Files:**
- `frontend/src/components/cost/CostDashboard.tsx` - Main cost view
- `frontend/src/components/cost/CostOverview.tsx` - Summary cards
- `frontend/src/components/cost/NamespaceCosts.tsx` - Namespace breakdown
- `frontend/src/components/cost/CostTrends.tsx` - Charts/graphs
- `frontend/src/components/cost/Recommendations.tsx` - Optimization tips
- `frontend/src/components/cost/CostSettings.tsx` - Pricing config

**Changes:**
- `frontend/src/App.tsx` - Add /cost routes
- `frontend/src/components/common/Layout.tsx` - Add Cost nav item
- `frontend/src/services/api.ts` - Add costApi
- `frontend/src/types/index.ts` - Add Cost types

**Dashboard Components:**
1. **Overview Cards** - Total cost, cost change %, top spenders
2. **Namespace Chart** - Pie/bar chart of costs by namespace
3. **Trend Graph** - Line chart of daily/weekly costs (using Chart.js or Recharts)
4. **Recommendations** - Actionable cards with "Apply" buttons
5. **Settings** - Configure pricing per resource type

---

## Implementation Order

### Phase 1: Multi-Cluster Support (Foundation)
1. Backend cluster service & endpoints
2. Frontend ClusterContext & switcher
3. Modify existing K8s calls to support cluster parameter

### Phase 2: RBAC Integration (Security)
1. Backend auth service & JWT
2. User storage (SQLite/JSON)
3. Permission decorators on routes
4. Frontend auth context & login
5. Protected routes & permission checks
6. Audit logging

### Phase 3: Helm Chart UI (DevOps)
1. Backend Helm service
2. API endpoints
3. Frontend chart browser
4. Install wizard & values editor
5. Release management UI

### Phase 4: Cost Dashboard (Analytics)
1. Backend cost service
2. Cost calculation logic
3. API endpoints
4. Frontend dashboard components
5. Charts integration (Recharts)

---

## File Summary

### Backend New Files (14)
```
backend/app/
├── services/
│   ├── cluster_service.py
│   ├── auth_service.py
│   ├── helm_service.py
│   └── cost_service.py
├── schemas/
│   ├── cluster.py
│   ├── auth.py
│   ├── helm.py
│   └── cost.py
├── api/routes/
│   ├── clusters.py
│   ├── auth.py
│   ├── helm.py
│   └── cost.py
├── core/
│   └── security.py
├── middleware/
│   └── auth.py
└── models/
    └── user.py
```

### Frontend New Files (18)
```
frontend/src/
├── contexts/
│   ├── ClusterContext.tsx
│   └── AuthContext.tsx
├── components/
│   ├── common/
│   │   └── ClusterSwitcher.tsx
│   ├── auth/
│   │   ├── LoginPage.tsx
│   │   └── ProtectedRoute.tsx
│   ├── admin/
│   │   └── UserManagement.tsx
│   ├── helm/
│   │   ├── HelmDashboard.tsx
│   │   ├── ChartBrowser.tsx
│   │   ├── ReleaseList.tsx
│   │   ├── InstallChart.tsx
│   │   ├── ValuesEditor.tsx
│   │   └── ReleaseDetail.tsx
│   └── cost/
│       ├── CostDashboard.tsx
│       ├── CostOverview.tsx
│       ├── NamespaceCosts.tsx
│       ├── CostTrends.tsx
│       ├── Recommendations.tsx
│       └── CostSettings.tsx
```

---

## Dependencies to Add

### Backend (requirements.txt)
```
PyJWT>=2.8.0           # JWT token handling
passlib[bcrypt]>=1.7.4 # Password hashing
python-jose>=3.3.0     # JWT with more algorithms
```

### Frontend (package.json)
```json
{
  "dependencies": {
    "recharts": "^2.10.0",        // Charts for cost dashboard
    "@monaco-editor/react": "^4.6.0"  // YAML editor for Helm values
  }
}
```

---

## Estimated Effort

| Feature | Backend | Frontend | Total |
|---------|---------|----------|-------|
| Multi-Cluster | 4 hrs | 3 hrs | 7 hrs |
| RBAC | 6 hrs | 5 hrs | 11 hrs |
| Helm UI | 5 hrs | 6 hrs | 11 hrs |
| Cost Dashboard | 4 hrs | 5 hrs | 9 hrs |
| **Total** | **19 hrs** | **19 hrs** | **38 hrs** |

---

## Questions for Clarification

1. **Multi-Cluster**: Should clusters be configured via env/config file or through UI?
2. **RBAC**: Should we use SQLite for user storage or simple JSON file?
3. **Helm**: Should we support private Helm repos with authentication?
4. **Cost**: Do you want integration with cloud provider APIs (AWS Cost Explorer, GCP Billing)?
