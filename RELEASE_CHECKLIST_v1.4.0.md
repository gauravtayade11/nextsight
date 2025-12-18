# Release Checklist v1.4.0

## Pre-Release Verification

### 1. Version Numbers
- [x] `VERSION` file updated to `1.4.0`
- [ ] `backend/app/core/config.py` - `APP_VERSION = "1.4.0"`
- [ ] `frontend/package.json` - `"version": "1.4.0"`
- [ ] `charts/nextsight/Chart.yaml` - `version: 1.4.0` and `appVersion: "1.4.0"`
- [ ] `k8s/deployment.yaml` - Image tags updated to `v1.4.0`
- [x] `CHANGELOG.md` - Release date and notes finalized
- [x] `README.md` - Version badge updated to `1.4.0`

### 2. Core Features Verification

#### New Features in v1.4.0
- [ ] **Trivy in Docker Image** - Built-in vulnerability scanning
  - [ ] Trivy binary included in backend Docker image
  - [ ] Version 0.58.0 installed and functional
  - [ ] Image scanning works without external dependencies

- [ ] **Metrics Server Status Endpoint**
  - [ ] `/api/v1/kubernetes/metrics/status` endpoint works
  - [ ] Auto-detection of metrics-server installation
  - [ ] Graceful fallback when metrics-server unavailable

- [ ] **AI-Powered Features**
  - [ ] Proactive Insights - `/api/v1/ai/insights/proactive` endpoint
  - [ ] Runbook Generation - `/api/v1/ai/runbook/generate` endpoint
  - [ ] Smart Suggestions - `/api/v1/ai/suggestions/smart` endpoint
  - [ ] All AI features work with Groq/Gemini/Claude providers

- [ ] **Enhanced Caching** - Redis integration
  - [ ] Optimization dashboard caching (60s TTL)
  - [ ] Prometheus targets caching (30s TTL)
  - [ ] Prometheus alerts caching (15s TTL)
  - [ ] AI proactive insights caching (120s TTL)

#### v1.4.0 Enhancements (feature/v1.4.0-enhancements)
- [ ] **Dashboard Actionable Insights Card** - AI-powered recommendations
- [ ] **Workload Health Indicators** - Visual health status
- [ ] **WorkloadDrawer AI Fixes Tab** - Root cause analysis
- [ ] **YAML Deploy Summary Modal** - Deployment overview
- [ ] **Top 3 Security Risks View** - Priority security findings
- [ ] **Plain English Security Explanations** - Business impact messaging

### 3. Security & Quality

#### Security Scanning
- [ ] CodeQL analysis passing
- [ ] Trivy Docker scan passing (no CRITICAL/HIGH vulnerabilities)
- [ ] Dependency review clean
- [ ] Secret detection clean (Gitleaks)
- [ ] OSSF Scorecard acceptable (if enabled)

#### Code Quality
- [ ] Backend tests passing (`make test-backend`)
- [ ] Frontend builds without errors (`make build-frontend`)
- [ ] No ESLint errors
- [ ] No TypeScript errors
- [ ] Docker images build successfully

### 4. Documentation

#### Core Documentation
- [x] `README.md` - Updated with v1.4.0 features
- [x] `CHANGELOG.md` - Complete release notes
- [ ] `docs/getting-started/installation.md` - Prerequisites updated
- [ ] `docs/features/` - All feature docs updated
- [ ] `docs/api/` - API documentation current
- [ ] GitHub Pages documentation deployed

#### Prerequisites Documentation
- [ ] Kubernetes requirements (1.24+)
- [ ] metrics-server installation (optional but recommended)
- [ ] Trivy integration (built-in)
- [ ] Prometheus integration (optional)
- [ ] Redis cache (recommended for production)
- [ ] Database requirements (PostgreSQL)

#### Screenshots & Demos
- [ ] Dashboard overview screenshot
- [ ] Kubernetes resources screenshot
- [ ] Security dashboard screenshot
- [ ] Add more feature-specific screenshots:
  - [ ] AI Insights panel
  - [ ] Workload drawer with health indicators
  - [ ] YAML deploy with summary
  - [ ] Terminal interface
  - [ ] Helm dashboard
  - [ ] Pod logs viewer

### 5. Configuration & Deployment

#### Environment Configuration
- [ ] `.env.example` complete and up-to-date
- [ ] All new env variables documented
- [ ] Production checklist in `.env.example` accurate
- [ ] Default values sensible for development

#### Docker & Kubernetes
- [ ] `docker-compose.yml` works for local development
- [ ] Backend Dockerfile builds (with Trivy)
- [ ] Frontend Dockerfile builds
- [ ] K8s manifests in `k8s/` directory valid
- [ ] Helm chart in `charts/nextsight/` installs successfully
- [ ] Helm chart values.yaml documented

#### Makefile Commands
- [ ] `make dev` - Starts development environment
- [ ] `make build` - Builds Docker images
- [ ] `make test-backend` - Runs backend tests
- [ ] `make logs` - Shows container logs
- [ ] `make down` - Stops containers
- [ ] `make k8s-deploy` - Deploys to Kubernetes
- [ ] `make helm-install` - Installs via Helm

### 6. Cross-Platform Testing

#### Environments
- [ ] Linux (Ubuntu/Debian)
- [ ] macOS (Intel/Apple Silicon)
- [ ] Windows (Docker Desktop)

#### Kubernetes Distributions
- [ ] Docker Desktop Kubernetes
- [ ] Minikube
- [ ] Kind
- [ ] K3s
- [ ] EKS/GKE/AKS (cloud providers)

### 7. Integration Testing

#### AI Providers
- [ ] Groq API integration works
- [ ] Gemini API integration works
- [ ] Claude API integration works
- [ ] Graceful fallback when API unavailable

#### Optional Integrations
- [ ] Jenkins integration (if configured)
- [ ] ArgoCD integration (if configured)
- [ ] Prometheus integration (if available)
- [ ] OAuth providers (Google, GitHub, GitLab)

#### Multi-Cluster Support
- [ ] Cluster switching works
- [ ] Multiple clusters can be configured
- [ ] Cluster status detection accurate

### 8. User Experience

#### Authentication & RBAC
- [ ] Login/logout flow works
- [ ] Default users functional (admin, developer, operator, viewer)
- [ ] Role-based permissions enforced
- [ ] JWT token refresh works
- [ ] Session timeout handled gracefully

#### UI/UX
- [ ] Dark mode works throughout
- [ ] Light mode works throughout
- [ ] Responsive design on mobile/tablet
- [ ] Loading states show properly
- [ ] Error messages are clear and helpful
- [ ] Toast notifications work
- [ ] All modals open/close correctly

#### Performance
- [ ] Dashboard loads quickly
- [ ] Resource lists paginate/filter efficiently
- [ ] Real-time logs stream smoothly
- [ ] Terminal is responsive
- [ ] No memory leaks in WebSocket connections

### 9. Git & Release Process

#### Branch Management
- [ ] All changes committed to `feature/v1.4.0-enhancements`
- [ ] Feature branch merged to `develop`
- [ ] Create release branch: `release/v1.4.0`
- [ ] All tests pass on release branch
- [ ] Merge release branch to `main`

#### GitHub Release
- [ ] Create git tag: `v1.4.0`
- [ ] Push tag to GitHub
- [ ] Create GitHub release with notes
- [ ] Attach release assets (if any)
- [ ] Update release notes with upgrade instructions

#### Post-Release
- [ ] Merge `main` back to `develop`
- [ ] Close completed milestones
- [ ] Update project board
- [ ] Announce release (if applicable)

### 10. Upgrade Path

#### From v1.3.0 to v1.4.0
- [ ] Database migrations (if any) documented
- [ ] Breaking changes documented
- [ ] Configuration changes noted
- [ ] Upgrade guide in CHANGELOG.md

#### Compatibility
- [ ] Backward compatible with v1.3.0 configurations
- [ ] Helm chart upgrades work smoothly
- [ ] No data loss during upgrade

## Critical Items (MUST COMPLETE)

1. **Version Numbers** - All files updated consistently
2. **Security Scanning** - All scans passing
3. **Core Features** - Trivy, Metrics Server, AI features working
4. **Tests** - Backend and frontend tests passing
5. **Documentation** - README and CHANGELOG complete
6. **Docker Images** - Build successfully with Trivy included

## Nice to Have (Optional)

1. Additional screenshots showcasing new features
2. Video demo of key features
3. Performance benchmarks
4. Load testing results
5. User acceptance testing feedback

## Release Commands

```bash
# 1. Ensure all changes committed
git status

# 2. Merge feature branch to develop
git checkout develop
git merge feature/v1.4.0-enhancements
git push origin develop

# 3. Create release branch
git checkout -b release/v1.4.0

# 4. Update version numbers (if not done)
# Edit files: VERSION, backend/app/core/config.py, frontend/package.json, etc.

# 5. Run final tests
make test-backend
make build

# 6. Commit final changes
git add .
git commit -m "chore: prepare v1.4.0 release"

# 7. Merge to main
git checkout main
git merge release/v1.4.0

# 8. Tag release
git tag -a v1.4.0 -m "Release v1.4.0 - NextSight AI with enhanced features"
git push origin main --tags

# 9. Merge back to develop
git checkout develop
git merge main
git push origin develop

# 10. Create GitHub release
# Go to GitHub and create release from v1.4.0 tag
```

## Post-Release Checklist

- [ ] GitHub release published
- [ ] Documentation site updated
- [ ] Docker Hub images tagged (if published)
- [ ] Helm chart repository updated (if published)
- [ ] Social media announcement (if applicable)
- [ ] Close v1.4.0 milestone
- [ ] Start v1.5.0 planning

## Sign-off

- [ ] Lead Developer reviewed
- [ ] QA tested
- [ ] Documentation reviewed
- [ ] Security scan passed
- [ ] Ready for release

---

**Release Date**: 2025-12-17
**Release Manager**: Gaurav Tayade
**Version**: 1.4.0