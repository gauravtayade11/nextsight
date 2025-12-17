# Configuration

Configure NextSight AI for your environment.

## Environment Variables

Create a `.env` file in the backend directory based on `.env.example`:

```env
# Application
APP_NAME=NextSight AI
APP_VERSION=1.4.0
DEBUG=false

# Security (REQUIRED)
SECRET_KEY=CHANGE_ME_GENERATE_WITH_SECURE_RANDOM
ACCESS_TOKEN_EXPIRE_MINUTES=30
DEFAULT_ADMIN_PASSWORD=CHANGE_ME_IN_PRODUCTION

# Database (REQUIRED)
DATABASE_URL=postgresql+asyncpg://nexops_user:password@localhost:5432/nexops
USE_DATABASE_AUTH=true

# Redis Cache (RECOMMENDED)
REDIS_URL=redis://localhost:6379/0
REDIS_ENABLED=true

# Kubernetes
K8S_CONFIG_PATH=~/.kube/config
K8S_IN_CLUSTER=false

# AI Provider (groq recommended)
AI_PROVIDER=groq
GROQ_API_KEY=your-api-key
```

## Kubernetes Configuration

### Local Development

```env
K8S_CONFIG_PATH=~/.kube/config
K8S_IN_CLUSTER=false
```

### In-Cluster Deployment

```env
K8S_IN_CLUSTER=true
```

The service account must have appropriate RBAC permissions. See [RBAC Setup](../deployment/kubernetes.md#rbac).

## AI Provider Setup

NextSight AI supports three AI providers. Choose one based on your needs:

### Groq (Recommended - FREE & FAST)

!!! success "Recommended Choice"
    Groq offers blazing fast inference with a generous free tier (14,400 requests/day). Perfect for most use cases.

1. Get a free API key from [Groq Console](https://console.groq.com)
2. Set the environment variables:

```env
AI_PROVIDER=groq
GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=llama-3.3-70b-versatile
```

**Available models:**
- `llama-3.3-70b-versatile` - Latest, most capable (recommended)
- `mixtral-8x7b-32768` - Good for longer contexts
- `llama-3.1-70b-versatile` - Previous generation

**Free Tier:**
- 14,400 requests per day
- Ultra-fast inference (<1s)
- No credit card required

### Google Gemini (Alternative - FREE)

1. Get an API key from [Google AI Studio](https://aistudio.google.com/apikey)
2. Set the environment variables:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.0-flash
```

**Available models:**
- `gemini-2.0-flash` - Fast, multimodal (recommended)
- `gemini-1.5-flash` - Previous generation
- `gemini-1.5-pro` - More capable, slower

### Anthropic Claude (Paid)

1. Get an API key from [Anthropic Console](https://console.anthropic.com)
2. Set the environment variables:

```env
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=your-claude-api-key
CLAUDE_MODEL=claude-sonnet-4-20250514
```

**Available models:**
- `claude-sonnet-4-20250514` - Latest Sonnet (recommended)
- `claude-opus-4-20250514` - Most capable
- `claude-haiku-4-20250514` - Fastest

!!! info "AI Provider Comparison"
    | Provider | Cost | Speed | Quality | Free Tier |
    |----------|------|-------|---------|-----------|
    | **Groq** | Free | ⚡⚡⚡ | ⭐⭐⭐ | 14.4K req/day |
    | **Gemini** | Free | ⚡⚡ | ⭐⭐⭐⭐ | Limited |
    | **Claude** | Paid | ⚡⚡ | ⭐⭐⭐⭐⭐ | No |

## Database Configuration

### PostgreSQL (Required for Production)

NextSight AI uses PostgreSQL for:
- User authentication and RBAC
- Pipeline execution history
- OAuth user profiles
- Settings and configuration

```env
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/nexops
USE_DATABASE_AUTH=true
```

### Redis Cache (Recommended)

Redis provides caching for better performance:

```env
REDIS_URL=redis://localhost:6379/0
REDIS_ENABLED=true
```

**What's cached:**
- Kubernetes API responses (60s TTL)
- Prometheus metrics (30s TTL)
- AI insights (120s TTL)
- Token blacklist (for logout)

## OAuth / SSO Configuration

NextSight AI supports Single Sign-On via OAuth providers.

### Google OAuth

1. Go to [Google Cloud Console](https://console.developers.google.com)
2. Create OAuth 2.0 credentials
3. Set redirect URI: `http://localhost:3000/auth/callback/google`
4. Configure:

```env
OAUTH_ENABLED=true
OAUTH_REDIRECT_BASE=http://localhost:3000
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

### GitHub OAuth

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set callback URL: `http://localhost:3000/auth/callback/github`
4. Configure:

```env
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret
```

### GitLab OAuth

1. Go to your GitLab instance Applications settings
2. Create a new application
3. Set redirect URI: `http://localhost:3000/auth/callback/gitlab`
4. Configure:

```env
GITLAB_CLIENT_ID=your-client-id
GITLAB_CLIENT_SECRET=your-client-secret
GITLAB_URL=https://gitlab.com  # or your GitLab instance
```

## Security Settings

### JWT Configuration

```env
SECRET_KEY=your-super-secret-key-change-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=30
DEFAULT_ADMIN_PASSWORD=CHANGE_ME_IN_PRODUCTION
```

!!! danger "Production Security"
    - Always change `SECRET_KEY` to a secure random value
    - Use at least 64 characters for `SECRET_KEY`
    - Change default admin password immediately
    - Generate secure keys:
    ```bash
    python3 -c 'import secrets; print(secrets.token_hex(32))'
    ```

### CORS Settings

By default, NextSight AI allows requests from localhost. For production:

```env
CORS_ORIGINS=["https://nextsight.example.com"]
```

## Optional Integrations

### Jenkins CI/CD

To enable Jenkins integration:

```env
JENKINS_URL=http://jenkins.example.com
JENKINS_USERNAME=admin
JENKINS_TOKEN=your-api-token
```

### ArgoCD GitOps

To enable ArgoCD integration:

```env
ARGOCD_SERVER=https://argocd.example.com
ARGOCD_TOKEN=your-argocd-token
ARGOCD_INSECURE=false
```

## Helm Chart Values

For Helm deployments, you can override values:

```yaml
# values.yaml
backend:
  replicaCount: 2
  extraEnv:
    - name: AI_PROVIDER
      value: "groq"
    - name: GROQ_API_KEY
      valueFrom:
        secretKeyRef:
          name: nextsight-secrets
          key: groq-api-key

ingress:
  enabled: true
  hosts:
    - host: nextsight.example.com
      paths:
        - path: /
          pathType: Prefix
```

See [Helm Chart documentation](../deployment/helm.md) for all options.

## Production Checklist

Before deploying to production, verify:

- [ ] `SECRET_KEY` changed to secure random value
- [ ] `DEFAULT_ADMIN_PASSWORD` changed
- [ ] Database URL points to production PostgreSQL
- [ ] Redis enabled for caching
- [ ] `DEBUG=false`
- [ ] CORS origins restricted to your domain
- [ ] AI provider API key set
- [ ] OAuth providers configured (if using SSO)
- [ ] `K8S_IN_CLUSTER=true` if running in Kubernetes
- [ ] HTTPS enabled for production

## Environment Variables Reference

See [backend/.env.example](https://github.com/gauravtayade11/nextsight/blob/main/backend/.env.example) for the complete list of environment variables with detailed comments.
