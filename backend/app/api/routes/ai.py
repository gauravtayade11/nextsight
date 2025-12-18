"""AI Chat API routes for NextSight AI assistant with real-time data from all sections."""

import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.config import settings
from app.core.cache import cache_service
from app.utils.security import sanitize_log_input
from app.services.kubernetes_service import kubernetes_service
from app.services.security_service import get_security_service
from app.services.jenkins_service import jenkins_service
from app.services.helm_service import helm_service
# from app.services.cost_service import cost_service  # Excluded from v1.4.0
from app.services.timeline_service import timeline_service
from app.services.optimization_service import optimization_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai")


class ChatRequest(BaseModel):
    message: str
    context: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    success: bool


# Initialize AI models
_gemini_model = None
_groq_client = None


def get_groq_client():
    """Initialize Groq client (free & fast)"""
    global _groq_client
    if _groq_client is None:
        if not settings.GROQ_API_KEY:
            raise ValueError("GROQ_API_KEY not configured")
        try:
            from groq import Groq
        except Exception as e:
            raise ValueError("groq package is not available. Install it with: pip install groq") from e

        _groq_client = Groq(api_key=settings.GROQ_API_KEY)
    return _groq_client


def get_gemini_model():
    """Initialize Gemini model (free tier with limits)"""
    global _gemini_model
    if _gemini_model is None:
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY not configured")
        try:
            import google.generativeai as genai  # type: ignore
        except Exception as e:
            raise ValueError("google.generativeai package is not available") from e

        genai.configure(api_key=settings.GEMINI_API_KEY)
        model_name = getattr(settings, "GEMINI_MODEL", None) or "gemini-2.0-flash"
        _gemini_model = genai.GenerativeModel(model_name)
    return _gemini_model


def generate_ai_response(prompt: str, fallback_providers: list = None) -> str:
    """
    Generate AI response with automatic fallback to alternative providers.

    Args:
        prompt: The prompt to send to the AI
        fallback_providers: List of providers to try in order. If None, uses settings.AI_PROVIDER + fallbacks

    Returns:
        str: AI-generated response

    Raises:
        ValueError: If no AI providers are configured
        Exception: If all providers fail
    """
    if fallback_providers is None:
        # Default fallback chain: Primary provider → Groq → Gemini
        primary = settings.AI_PROVIDER
        fallback_providers = [primary]
        if primary != "groq" and settings.GROQ_API_KEY:
            fallback_providers.append("groq")
        if primary != "gemini" and settings.GEMINI_API_KEY:
            fallback_providers.append("gemini")

    last_error = None

    for provider in fallback_providers:
        try:
            if provider == "groq":
                logger.info("Using Groq AI provider")
                client = get_groq_client()
                response = client.chat.completions.create(
                    model=settings.GROQ_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.7,
                    max_tokens=2048
                )
                return response.choices[0].message.content

            elif provider == "gemini":
                logger.info("Using Gemini AI provider")
                model = get_gemini_model()
                response = model.generate_content(prompt)
                return response.text

            else:
                logger.warning(f"Unknown AI provider: {provider}")
                continue

        except Exception as e:
            logger.warning(f"AI provider {provider} failed: {e}")
            last_error = e
            continue

    # If we get here, all providers failed
    if last_error:
        raise Exception(f"All AI providers failed. Last error: {last_error}")
    else:
        raise ValueError("No AI providers configured. Please set GROQ_API_KEY or GEMINI_API_KEY")


# Keywords to detect query types across all NextSight sections
QUERY_KEYWORDS = {
    # Kubernetes
    "pods": ["pod", "pods", "running pods", "pod count", "how many pods"],
    "deployments": ["deployment", "deployments", "deploy", "replicas", "rollout"],
    "services": ["service", "services", "svc", "endpoints", "loadbalancer"],
    "nodes": ["node", "nodes", "worker", "master", "control plane"],
    "namespaces": ["namespace", "namespaces", "ns"],
    "k8s_events": ["k8s event", "kubernetes event", "cluster event"],
    "k8s_health": ["cluster health", "cluster status", "kubernetes health"],
    "resources": ["resources", "cpu", "memory", "usage", "metrics", "utilization"],
    # Security
    "security": ["security", "secure", "vulnerability", "vulnerabilities", "cve", "scan"],
    "rbac": ["rbac", "role", "rolebinding", "permission", "access control", "service account"],
    "network_policy": ["network policy", "network policies", "ingress policy", "egress policy"],
    "compliance": ["compliance", "cis", "benchmark", "audit"],
    # Jenkins / CI-CD
    "jenkins": ["jenkins", "build", "builds", "pipeline", "pipelines", "ci", "cd", "cicd", "ci/cd", "job", "jobs"],
    # Helm
    "helm": ["helm", "chart", "charts", "release", "releases", "helm install", "helm upgrade"],
    # Cost - Excluded from v1.4.0
    # "cost": ["cost", "costs", "spending", "expensive", "billing", "price", "budget", "savings"],
    # Timeline / Events
    "timeline": ["timeline", "history", "activity", "recent events", "what happened"],
    # Incidents
    "incidents": ["incident", "incidents", "outage", "issue", "problem", "alert", "alerts"],
}


def detect_query_types(message: str) -> list:
    """Detect what type of data the user is asking about."""
    message_lower = message.lower()
    detected_types = []

    for query_type, keywords in QUERY_KEYWORDS.items():
        for keyword in keywords:
            if keyword in message_lower:
                if query_type not in detected_types:
                    detected_types.append(query_type)
                break

    return detected_types


async def fetch_context(query_types: list) -> str:
    """Fetch relevant data from all NextSight services based on query types."""
    context_parts = []

    # ===== KUBERNETES CONTEXT =====
    try:
        # Cluster health (always useful as baseline)
        if "k8s_health" in query_types or not query_types:
            try:
                health = await kubernetes_service.get_cluster_health()
                context_parts.append(
                    f"""
## Kubernetes Cluster Health
- **Status**: {"Healthy" if health.healthy else "Unhealthy"}
- **Nodes**: {health.ready_nodes}/{health.node_count} ready
- **Total Pods**: {health.total_pods}
- **Running Pods**: {health.running_pods}
- **Namespaces**: {health.namespaces}
- **Warnings**: {', '.join(health.warnings) if health.warnings else 'None'}
"""
                )
            except Exception as e:
                logger.warning(f"Could not fetch cluster health: {e}")

        if "pods" in query_types:
            try:
                pods = await kubernetes_service.get_pods()
                running = sum(1 for p in pods if p.status.value == "Running")
                pending = sum(1 for p in pods if p.status.value == "Pending")
                failed = sum(1 for p in pods if p.status.value == "Failed")
                succeeded = sum(1 for p in pods if p.status.value == "Succeeded")

                ns_counts = {}
                for pod in pods:
                    ns = pod.namespace
                    if ns not in ns_counts:
                        ns_counts[ns] = {"running": 0, "total": 0}
                    ns_counts[ns]["total"] += 1
                    if pod.status.value == "Running":
                        ns_counts[ns]["running"] += 1

                context_parts.append(
                    f"""
## Pod Summary
- **Total Pods**: {len(pods)}
- **Running**: {running}
- **Pending**: {pending}
- **Failed**: {failed}
- **Succeeded/Completed**: {succeeded}

### Pods by Namespace (Top 10):
"""
                    + "\n".join(
                        [
                            f"- **{ns}**: {counts['running']}/{counts['total']} running"
                            for ns, counts in sorted(ns_counts.items(), key=lambda x: x[1]["total"], reverse=True)[:10]
                        ]
                    )
                )
            except Exception as e:
                logger.warning(f"Could not fetch pods: {e}")

        if "deployments" in query_types:
            try:
                deployments = await kubernetes_service.get_deployments()
                healthy = sum(1 for d in deployments if d.ready_replicas == d.replicas and d.replicas > 0)
                unhealthy = [d for d in deployments if d.ready_replicas != d.replicas]

                context_parts.append(
                    f"""
## Deployment Summary
- **Total Deployments**: {len(deployments)}
- **Healthy**: {healthy}
- **Unhealthy/Scaling**: {len(unhealthy)}

### Deployments Needing Attention:
"""
                    + (
                        "\n".join(
                            [
                                f"- **{d.namespace}/{d.name}**: {d.ready_replicas}/{d.replicas} ready"
                                for d in unhealthy[:5]
                            ]
                        )
                        if unhealthy
                        else "All deployments are healthy!"
                    )
                )
            except Exception as e:
                logger.warning(f"Could not fetch deployments: {e}")

        if "services" in query_types:
            try:
                services = await kubernetes_service.get_services()
                svc_types = {}
                for svc in services:
                    svc_type = svc.type or "ClusterIP"
                    svc_types[svc_type] = svc_types.get(svc_type, 0) + 1

                context_parts.append(
                    f"""
## Service Summary
- **Total Services**: {len(services)}
- **By Type**: {', '.join([f'{t}: {c}' for t, c in svc_types.items()])}
"""
                )
            except Exception as e:
                logger.warning(f"Could not fetch services: {e}")

        if "nodes" in query_types:
            try:
                nodes = await kubernetes_service.get_nodes()
                ready = sum(1 for n in nodes if n.status == "Ready")

                context_parts.append(
                    f"""
## Node Summary
- **Total Nodes**: {len(nodes)}
- **Ready**: {ready}
- **Not Ready**: {len(nodes) - ready}

### Node Details:
"""
                    + "\n".join(
                        [f"- **{n.name}**: {n.status}, Roles: {', '.join(n.roles)}, K8s: {n.version}" for n in nodes]
                    )
                )
            except Exception as e:
                logger.warning(f"Could not fetch nodes: {e}")

        if "namespaces" in query_types:
            try:
                namespaces = await kubernetes_service.get_namespaces()
                context_parts.append(
                    f"""
## Namespace Summary
- **Total Namespaces**: {len(namespaces)}
- **Namespaces**: {', '.join([ns.name for ns in namespaces])}
"""
                )
            except Exception as e:
                logger.warning(f"Could not fetch namespaces: {e}")

        if "resources" in query_types:
            try:
                metrics = await kubernetes_service.get_cluster_metrics()
                if metrics:
                    context_parts.append(
                        f"""
## Cluster Resource Usage
- **CPU**: {metrics.total_cpu_usage} / {metrics.total_cpu_capacity} ({metrics.cpu_percent}%)
- **Memory**: {metrics.total_memory_usage} / {metrics.total_memory_capacity} ({metrics.memory_percent}%)
"""
                    )
            except Exception as e:
                logger.warning(f"Could not fetch metrics: {e}")

    except Exception as e:
        logger.error(f"Error fetching Kubernetes context: {e}")

    # ===== SECURITY CONTEXT =====
    if any(t in query_types for t in ["security", "rbac", "network_policy", "compliance"]):
        try:
            security_service = get_security_service()

            if "security" in query_types:
                try:
                    dashboard = await security_service.get_security_dashboard()
                    context_parts.append(
                        f"""
## Security Dashboard
- **Security Score**: {dashboard.security_score.score}/100 (Grade: {dashboard.security_score.grade})
- **Critical Issues**: {dashboard.security_score.critical_issues}
- **High Issues**: {dashboard.security_score.high_issues}
- **Medium Issues**: {dashboard.security_score.medium_issues}
- **Low Issues**: {dashboard.security_score.low_issues}
- **Total Vulnerabilities**: {dashboard.vulnerability_summary.total}
- **Images Scanned**: {dashboard.total_images_scanned}
- **Risky Namespaces**: {', '.join(dashboard.risky_namespaces[:5]) if dashboard.risky_namespaces else 'None'}

### Top Findings:
"""
                        + "\n".join([f"- [{f.severity.upper()}] {f.title}" for f in dashboard.top_findings[:5]])
                    )
                except Exception as e:
                    logger.warning(f"Could not fetch security dashboard: {e}")

            if "rbac" in query_types:
                try:
                    rbac = await security_service.analyze_rbac()
                    context_parts.append(
                        f"""
## RBAC Analysis
- **Total Service Accounts**: {rbac.total_service_accounts}
- **Risky Service Accounts**: {rbac.risky_service_accounts}
- **Cluster Admin Bindings**: {rbac.cluster_admin_bindings}
- **Wildcard Permissions**: {rbac.wildcard_permissions}

### Recommendations:
"""
                        + "\n".join([f"- {r}" for r in rbac.recommendations[:3]])
                    )
                except Exception as e:
                    logger.warning(f"Could not fetch RBAC analysis: {e}")

            if "network_policy" in query_types:
                try:
                    np = await security_service.analyze_network_policies()
                    context_parts.append(
                        f"""
## Network Policy Coverage
- **Coverage**: {np.coverage_percentage:.1f}%
- **Protected Namespaces**: {np.protected_namespaces}/{np.total_namespaces}
- **Unprotected Namespaces**: {np.unprotected_namespaces}
- **Pods Covered**: {np.covered_pods}/{np.total_pods}
"""
                    )
                except Exception as e:
                    logger.warning(f"Could not fetch network policies: {e}")

        except Exception as e:
            logger.error(f"Error fetching security context: {e}")

    # ===== JENKINS CONTEXT =====
    if "jenkins" in query_types:
        try:
            health = await jenkins_service.get_health()
            jobs = await jenkins_service.get_jobs()

            failed_jobs = [j for j in jobs if j.last_build_status == "FAILURE"]
            running_jobs = [j for j in jobs if j.last_build_status == "BUILDING"]

            context_parts.append(
                f"""
## Jenkins CI/CD
- **Status**: {"Connected" if health.connected else "Disconnected"}
- **Total Jobs**: {len(jobs)}
- **Currently Building**: {len(running_jobs)}
- **Failed Jobs**: {len(failed_jobs)}
- **Queue Length**: {health.queue_length}

### Recent Failed Jobs:
"""
                + (
                    "\n".join([f"- **{j.name}**: Build #{j.last_build_number}" for j in failed_jobs[:5]])
                    if failed_jobs
                    else "No failed jobs!"
                )
            )
        except Exception as e:
            logger.warning(f"Could not fetch Jenkins data: {e}")

    # ===== HELM CONTEXT =====
    if "helm" in query_types:
        try:
            releases = await helm_service.list_releases()
            deployed = [r for r in releases if r.status == "deployed"]
            failed = [r for r in releases if r.status == "failed"]

            context_parts.append(
                f"""
## Helm Releases
- **Total Releases**: {len(releases)}
- **Deployed**: {len(deployed)}
- **Failed**: {len(failed)}

### Recent Releases:
"""
                + "\n".join(
                    [f"- **{r.name}** ({r.namespace}): {r.chart} v{r.app_version} - {r.status}" for r in releases[:10]]
                )
            )
        except Exception as e:
            logger.warning(f"Could not fetch Helm data: {e}")

    # ===== COST CONTEXT ===== (Excluded from v1.4.0)
    # if "cost" in query_types:
    #     try:
    #         dashboard = await cost_service.get_cost_dashboard()
    #         recommendations = await cost_service.get_recommendations()
    #         context_parts.append(...)
    #     except Exception as e:
    #         logger.warning(f"Could not fetch cost data: {e}")

    # ===== TIMELINE CONTEXT =====
    if "timeline" in query_types:
        try:
            stats = await timeline_service.get_timeline_stats(hours=24)
            events = await timeline_service.get_events()

            context_parts.append(
                f"""
## Recent Activity (Last 24 Hours)
- **Total Events**: {stats.get('total_events', 0)}
- **Deployments**: {stats.get('deployments', 0)}
- **Incidents**: {stats.get('incidents', 0)}
- **Kubernetes Events**: {stats.get('k8s_events', 0)}

### Latest Events:
"""
                + "\n".join([f"- [{e.event_type}] {e.title}" for e in events[:5]])
            )
        except Exception as e:
            logger.warning(f"Could not fetch timeline data: {e}")

    return "\n".join(context_parts) if context_parts else ""


SYSTEM_PROMPT = """You are NextSight AI, the intelligent assistant for NextSight - a unified DevOps operations center.

You have access to REAL-TIME data from all NextSight sections:
- **Kubernetes**: Cluster health, pods, deployments, services, nodes, namespaces, resource usage
- **Security**: Security scores, vulnerabilities, RBAC analysis, network policies, compliance
- **Jenkins**: CI/CD pipelines, builds, job status
- **Helm**: Chart releases, deployments
- **Timeline**: Recent activities and events
- **Incidents**: Active incidents and alerts
- **Optimization**: Resource efficiency and right-sizing recommendations

Guidelines:
1. **Be CONCISE** - Give direct answers with specific numbers from the data
2. **Be ACTIONABLE** - Provide kubectl commands, recommendations, or next steps
3. **Be ACCURATE** - Use only the data provided, don't make up numbers
4. **Use Markdown** - Format responses with headers, lists, and code blocks
5. **Answer Directly** - Don't ask clarifying questions if the data already has the answer

When asked about any NextSight feature, use the real-time data provided to give accurate, helpful responses."""


@router.options("/chat")
async def chat_options():
    """Handle CORS preflight for chat endpoint."""
    return {"message": "OK"}


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Send a message to the AI assistant with real-time data from all NextSight sections."""
    try:
        # Detect what types of data are needed
        query_types = detect_query_types(request.message)

        # If no specific types detected, fetch basic overview
        if not query_types:
            query_types = ["k8s_health"]

        # Fetch relevant data from all services
        data_context = await fetch_context(query_types)

        # Build the prompt
        full_prompt = f"{SYSTEM_PROMPT}\n\n"

        if data_context:
            full_prompt += f"# Current NextSight Data (Real-Time)\n{data_context}\n\n"

        if request.context:
            full_prompt += f"Additional context: {request.context}\n\n"

        full_prompt += f"User Question: {request.message}\n\nAssistant (be concise, use real data):"

        response_text = generate_ai_response(full_prompt)

        return ChatResponse(response=response_text, success=True)

    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        raise HTTPException(status_code=503, detail="AI service not configured. Please set GROQ_API_KEY or GEMINI_API_KEY.")
    except Exception as e:
        logger.error(f"AI chat error: {e}")
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")


@router.get("/health")
async def ai_health():
    """Check if AI service is available and connected to all services."""
    try:
        if not settings.GROQ_API_KEY and not settings.GEMINI_API_KEY:
            return {"status": "unavailable", "reason": "No AI provider configured (GROQ_API_KEY or GEMINI_API_KEY required)"}

        # Check connectivity to various services
        services_status = {}

        try:
            health = await kubernetes_service.get_cluster_health()
            services_status["kubernetes"] = "connected" if health else "disconnected"
        except Exception:
            services_status["kubernetes"] = "disconnected"

        try:
            jenkins_health = await jenkins_service.get_health()
            services_status["jenkins"] = "connected" if jenkins_health.connected else "disconnected"
        except Exception:
            services_status["jenkins"] = "disconnected"

        try:
            await helm_service.list_releases()
            services_status["helm"] = "connected"
        except Exception:
            services_status["helm"] = "disconnected"

        return {"status": "available", "model": settings.GEMINI_MODEL, "services": services_status}
    except Exception as e:
        logger.error(f"AI health check error: {type(e).__name__}")
        return {"status": "error", "reason": "Internal service error"}


class OptimizationAnalysisRequest(BaseModel):
    namespace: Optional[str] = None
    focus_area: Optional[str] = None  # "cost", "performance", "reliability", or None for general


class OptimizationAnalysisResponse(BaseModel):
    analysis: str
    key_findings: list[str]
    priority_actions: list[dict]
    efficiency_improvement_percent: float  # Waste reduction percentage (primary metric)
    estimated_monthly_impact: float  # Cost impact estimate (non-billing)
    success: bool


OPTIMIZATION_PROMPT = """You are an expert Kubernetes SRE analyzing resource efficiency and reliability risks.

Analyze the following resource optimization data and provide:

1. **Executive Summary** (2-3 sentences) - Focus on efficiency and risk, not cost
2. **Key Findings** (bullet points of the most important inefficiencies)
3. **Priority Actions** (specific, actionable recommendations with expected impact)
4. **Risk Assessment** (what happens if no action is taken - performance degradation, OOM, throttling)
5. **Quick Wins** (changes that can be made immediately with low risk)

Focus on:
- Resource efficiency (CPU/Memory utilization)
- Performance risks (under-provisioned workloads)
- Reliability issues (missing limits/requests)
- Workload right-sizing

Frame findings in terms of:
- "X% CPU overallocation" rather than "Save $Y/month"
- "High risk of OOM" rather than "Wasting $Y"
- "Improve efficiency by X%" rather than "Reduce costs by X%"

Be specific with utilization percentages from the data. Provide kubectl commands or YAML snippets where helpful.
Format your response in clean Markdown."""


class HelmConfigAnalysisRequest(BaseModel):
    values_yaml: str
    chart_name: Optional[str] = None
    namespace: Optional[str] = None


class HelmConfigAnalysisResponse(BaseModel):
    analysis: str
    issues: list[dict]
    recommendations: list[dict]
    security_score: int
    production_ready: bool
    success: bool


class HelmTroubleshootRequest(BaseModel):
    release_name: str
    namespace: str
    health_data: dict
    manifest: Optional[str] = None


class HelmTroubleshootResponse(BaseModel):
    diagnosis: str
    root_causes: list[str]
    fixes: list[dict]
    severity: str
    success: bool


HELM_CONFIG_ANALYSIS_PROMPT = """You are a Kubernetes and Helm expert specializing in configuration best practices, security, and production readiness.

Analyze the provided Helm chart values.yaml configuration and identify:

1. **Security Issues** (CRITICAL)
   - Hardcoded passwords or secrets
   - Missing security contexts
   - Privileged containers
   - Host network/PID/IPC usage
   - Missing Pod Security Standards

2. **Resource Configuration** (HIGH)
   - Missing or inadequate resource limits/requests
   - CPU/memory configurations that could cause OOM or throttling
   - Storage configurations

3. **High Availability** (MEDIUM)
   - Single replica deployments in production
   - Missing pod disruption budgets
   - Lack of anti-affinity rules
   - No liveness/readiness probes

4. **Best Practices** (LOW)
   - Image pull policies
   - Service account configurations
   - Label/annotation standards
   - Configuration management

For each issue found, provide:
- **Severity**: critical, high, medium, or low
- **Issue**: Clear description of the problem
- **Impact**: What could go wrong
- **Fix**: Exact YAML snippet to fix it
- **Auto-fixable**: true/false (can we apply this automatically?)

Give a **Security Score** (0-100) and **Production Ready** assessment (yes/no).

Format your response in clean Markdown with code blocks for YAML."""


HELM_TROUBLESHOOT_PROMPT = """You are a Kubernetes troubleshooting expert specializing in Helm releases and pod failures.

Analyze the provided Helm release health data and diagnose issues. Look for:

1. **Pod Failures**
   - CrashLoopBackOff, ImagePullBackOff, etc.
   - Container crashes and restarts
   - Resource exhaustion (OOM kills)

2. **Configuration Issues**
   - Missing ConfigMaps or Secrets
   - Incorrect environment variables
   - Volume mount failures

3. **Network/Service Issues**
   - Service discovery problems
   - Readiness probe failures
   - Network policy blocks

4. **Resource Constraints**
   - Insufficient cluster resources
   - CPU throttling
   - Memory pressure

For each issue, provide:
- **Root Cause**: What's actually wrong
- **Evidence**: Specific data from logs/events that proves it
- **Fix**: Step-by-step remediation (kubectl commands or YAML changes)
- **Prevention**: How to prevent this in the future

Rate the **Severity**: critical, high, medium, or low.

Be specific and actionable. Reference exact pod names, error messages, and event reasons from the data.

Format your response in clean Markdown."""


@router.post("/helm/analyze-config", response_model=HelmConfigAnalysisResponse)
async def analyze_helm_config(request: HelmConfigAnalysisRequest):
    """Analyze Helm chart values.yaml for security issues, best practices, and production readiness."""
    try:
        context = f"""
# Helm Chart Configuration Analysis

## Chart Details
- **Chart**: {request.chart_name or 'Unknown'}
- **Target Namespace**: {request.namespace or 'default'}

## Values.yaml Configuration
```yaml
{request.values_yaml}
```

Analyze this configuration thoroughly and provide detailed feedback.
"""

        full_prompt = f"{HELM_CONFIG_ANALYSIS_PROMPT}\n\n{context}\n\nProvide your analysis:"

        analysis_text = generate_ai_response(full_prompt)

        # Parse issues and recommendations from response
        issues = []
        recommendations = []
        security_score = 75  # Default
        production_ready = True

        lines = analysis_text.split('\n')
        current_issue = None

        for line in lines:
            line_lower = line.lower()

            # Extract security score
            if 'security score' in line_lower and ':' in line:
                try:
                    score_part = line.split(':')[1].strip()
                    security_score = int(''.join(filter(str.isdigit, score_part.split()[0])))
                except:
                    pass

            # Extract production ready status
            if 'production ready' in line_lower:
                production_ready = 'yes' in line_lower or 'true' in line_lower

            # Parse issues
            if any(severity in line_lower for severity in ['critical', 'high', 'medium', 'low']) and ':' in line:
                if current_issue:
                    issues.append(current_issue)

                severity = next((s for s in ['critical', 'high', 'medium', 'low'] if s in line_lower), 'medium')
                issue_text = line.split(':', 1)[1].strip() if ':' in line else line.strip()

                current_issue = {
                    "severity": severity,
                    "issue": issue_text,
                    "category": "configuration",
                    "auto_fixable": False
                }

        if current_issue:
            issues.append(current_issue)

        # Generate recommendations from issues
        for issue in issues[:5]:
            recommendations.append({
                "title": f"Fix: {issue['issue'][:50]}...",
                "priority": issue['severity'],
                "description": issue['issue']
            })

        return HelmConfigAnalysisResponse(
            analysis=analysis_text,
            issues=issues[:10],
            recommendations=recommendations[:5],
            security_score=security_score,
            production_ready=production_ready,
            success=True
        )

    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        raise HTTPException(status_code=503, detail="AI service not configured. Please set GROQ_API_KEY or GEMINI_API_KEY.")
    except Exception as e:
        logger.error(f"Helm config analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")


@router.post("/helm/troubleshoot", response_model=HelmTroubleshootResponse)
async def troubleshoot_helm_release(request: HelmTroubleshootRequest):
    """Analyze Helm release health issues and provide troubleshooting guidance."""
    try:
        health = request.health_data

        context = f"""
# Helm Release Troubleshooting

## Release Details
- **Release**: {request.release_name}
- **Namespace**: {request.namespace}

## Health Status
- **Healthy**: {health.get('healthy', False)}
- **Total Pods**: {health.get('total_pods', 0)}
- **Ready Pods**: {health.get('ready_pods', 0)}

## Pod Details
"""

        for pod in health.get('pods', []):
            context += f"""
### Pod: {pod.get('name')}
- **Phase**: {pod.get('phase')}
- **Ready**: {pod.get('ready')}
- **Node**: {pod.get('node', 'N/A')}

**Containers**:
"""
            for container in pod.get('containers', []):
                context += f"""
- **{container.get('name')}**: State={container.get('state')}, Ready={container.get('ready')}, Restarts={container.get('restartCount')}
"""

        context += "\n## Recent Events\n"
        for event in health.get('events', []):
            context += f"""
- [{event.get('type')}] **{event.get('reason')}**: {event.get('message')} (Count: {event.get('count', 1)})
"""

        if health.get('error'):
            context += f"\n## Error\n{health.get('error')}\n"

        full_prompt = f"{HELM_TROUBLESHOOT_PROMPT}\n\n{context}\n\nProvide your diagnosis:"

        diagnosis_text = generate_ai_response(full_prompt)

        # Parse root causes and fixes
        root_causes = []
        fixes = []
        severity = "medium"

        lines = diagnosis_text.split('\n')
        in_root_causes = False
        in_fixes = False

        for line in lines:
            line_lower = line.lower()

            if 'root cause' in line_lower or 'diagnosis' in line_lower:
                in_root_causes = True
                in_fixes = False
                continue
            if 'fix' in line_lower or 'solution' in line_lower or 'remediation' in line_lower:
                in_root_causes = False
                in_fixes = True
                continue
            if 'prevention' in line_lower or 'severity' in line_lower:
                in_root_causes = False
                in_fixes = False

            if 'severity' in line_lower and ':' in line:
                severity_text = line.split(':')[1].strip().lower()
                severity = next((s for s in ['critical', 'high', 'medium', 'low'] if s in severity_text), 'medium')

            if in_root_causes and (line.startswith('-') or line.startswith('*') or line.startswith('•')):
                cause = line.lstrip('-*• ').strip()
                if cause and len(cause) > 10:
                    root_causes.append(cause)

            if in_fixes and (line.startswith('-') or line.startswith('*') or line.startswith('•') or line[0:1].isdigit()):
                fix = line.lstrip('-*•0123456789. ').strip()
                if fix and len(fix) > 10:
                    fixes.append({
                        "description": fix,
                        "type": "manual" if 'kubectl' in fix.lower() else "config",
                        "priority": "high" if len(fixes) < 2 else "medium"
                    })

        # Fallback based on health data
        if not root_causes:
            if not health.get('healthy'):
                if health.get('total_pods') == 0:
                    root_causes.append("No pods are running for this release")
                elif health.get('ready_pods') < health.get('total_pods'):
                    root_causes.append(f"Only {health.get('ready_pods')}/{health.get('total_pods')} pods are ready")

                for pod in health.get('pods', []):
                    if pod.get('phase') != 'Running':
                        root_causes.append(f"Pod {pod.get('name')} is in {pod.get('phase')} state")

        if not fixes and not health.get('healthy'):
            fixes.append({
                "description": f"Check pod logs: kubectl logs -n {request.namespace} <pod-name>",
                "type": "manual",
                "priority": "high"
            })
            fixes.append({
                "description": f"Describe pod for details: kubectl describe pod -n {request.namespace} <pod-name>",
                "type": "manual",
                "priority": "high"
            })

        return HelmTroubleshootResponse(
            diagnosis=diagnosis_text,
            root_causes=root_causes[:5],
            fixes=fixes[:6],
            severity=severity,
            success=True
        )

    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        raise HTTPException(status_code=503, detail="AI service not configured. Please set GROQ_API_KEY or GEMINI_API_KEY.")
    except Exception as e:
        logger.error(f"Helm troubleshooting error: {e}")
        raise HTTPException(status_code=500, detail=f"Troubleshooting error: {str(e)}")


@router.post("/optimization/analyze", response_model=OptimizationAnalysisResponse)
async def analyze_optimization(request: OptimizationAnalysisRequest):
    """Get AI-powered analysis of resource optimization opportunities."""
    try:
        # Check cache first (10-minute TTL for expensive AI operations)
        cache_key = f"ai:optimization:{request.namespace or 'all'}:{request.focus_area or 'general'}"
        cached_data = await cache_service.get(cache_key)
        if cached_data:
            logger.info(f"Cache hit for optimization analysis (namespace={sanitize_log_input(request.namespace or 'all')}, focus={sanitize_log_input(request.focus_area or 'general')})")
            return OptimizationAnalysisResponse(**cached_data)

        logger.info(f"Generating AI optimization analysis (namespace={sanitize_log_input(request.namespace or 'all')}, focus={sanitize_log_input(request.focus_area or 'general')})")

        # Fetch optimization data
        dashboard = await optimization_service.get_optimization_dashboard(request.namespace)

        # Build context from optimization data
        context = f"""
# Kubernetes Resource Optimization Data

## Cluster Summary
- **Total Pods**: {dashboard.summary.total_pods}
- **Analyzed Pods**: {dashboard.summary.analyzed_pods}
- **Optimal Pods**: {dashboard.summary.optimal_pods}
- **Over-Provisioned Pods**: {dashboard.summary.over_provisioned_pods}
- **Under-Provisioned Pods**: {dashboard.summary.under_provisioned_pods}
- **Idle Pods**: {dashboard.summary.idle_pods}
- **Pods Without Limits**: {dashboard.summary.no_limits_pods}
- **Pods Without Requests**: {dashboard.summary.no_requests_pods}

## Efficiency Metrics
- **Average CPU Efficiency**: {dashboard.summary.avg_cpu_efficiency:.1f}%
- **Average Memory Efficiency**: {dashboard.summary.avg_memory_efficiency:.1f}%
- **Cluster Efficiency Score**: {dashboard.summary.cluster_efficiency_score.score:.1f}% (Grade: {dashboard.summary.cluster_efficiency_score.grade})

## Resource Usage
- **Total CPU Requested**: {dashboard.summary.total_cpu_requested_millicores}m
- **Total CPU Used**: {dashboard.summary.total_cpu_used_millicores}m
- **Total Memory Requested**: {dashboard.summary.total_memory_requested_bytes / (1024**3):.2f}Gi
- **Total Memory Used**: {dashboard.summary.total_memory_used_bytes / (1024**3):.2f}Gi

## Efficiency Metrics
- **Current Resource Allocation**: {dashboard.summary.total_cpu_requested_millicores}m CPU, {dashboard.summary.total_memory_requested_bytes / (1024**3):.2f}Gi Memory
- **Actual Usage**: {dashboard.summary.total_cpu_used_millicores}m CPU, {dashboard.summary.total_memory_used_bytes / (1024**3):.2f}Gi Memory
- **Waste Percentage**: {dashboard.summary.total_savings_percentage:.1f}% (overallocated resources)
- **Estimated Cost Impact**: ~${dashboard.summary.total_potential_savings * 720:.2f}/month (non-billing estimate)

## Namespace Breakdown (Top 5)
"""
        for ns in dashboard.namespace_breakdown[:5]:
            context += f"""
### {ns.namespace}
- Pods: {ns.pod_count} ({ns.over_provisioned_pods} wasteful, {ns.under_provisioned_pods} at-risk, {ns.idle_pods} idle)
- Efficiency: CPU {ns.avg_cpu_efficiency:.1f}%, Memory {ns.avg_memory_efficiency:.1f}%
- Potential Savings: ${ns.potential_hourly_savings * 720:.2f}/month ({ns.savings_percentage:.1f}%)
"""

        context += "\n## Top Wasteful Pods (Top 3 Over-Provisioned)\n"
        for pod in dashboard.top_wasteful_pods[:3]:
            context += f"""
### {pod.namespace}/{pod.name}
- Owner: {pod.owner_kind}/{pod.owner_name}
- CPU: Using {pod.total_cpu_usage_millicores}m / Requested {pod.total_cpu_request_millicores}m ({pod.cpu_efficiency.score:.1f}% efficient)
- Memory: Using {pod.total_memory_usage_bytes / (1024**2):.1f}Mi / Requested {pod.total_memory_request_bytes / (1024**2):.1f}Mi ({pod.memory_efficiency.score:.1f}% efficient)
- Potential Savings: ${pod.potential_savings * 720:.2f}/month
- Recommendations: {', '.join(pod.recommendations)}
"""

        context += "\n## At-Risk Pods (Top 3 Under-Provisioned)\n"
        for pod in dashboard.top_underprovisioned_pods[:3]:
            context += f"""
### {pod.namespace}/{pod.name}
- Owner: {pod.owner_kind}/{pod.owner_name}
- CPU: Using {pod.total_cpu_usage_millicores}m / Requested {pod.total_cpu_request_millicores}m ({pod.cpu_efficiency.score:.1f}% - TOO HIGH)
- Memory: Using {pod.total_memory_usage_bytes / (1024**2):.1f}Mi / Requested {pod.total_memory_request_bytes / (1024**2):.1f}Mi ({pod.memory_efficiency.score:.1f}% - TOO HIGH)
- Risk: Resource throttling, OOM kills, performance degradation
"""

        context += "\n## Idle Resources (Top 3)\n"
        for pod in dashboard.idle_resources[:3]:
            context += f"""
### {pod.namespace}/{pod.name}
- Owner: {pod.owner_kind}/{pod.owner_name}
- CPU Usage: {pod.total_cpu_usage_millicores}m (Only {pod.cpu_efficiency.score:.1f}% of request)
- Memory Usage: {pod.total_memory_usage_bytes / (1024**2):.1f}Mi (Only {pod.memory_efficiency.score:.1f}% of request)
- Wasted Cost: ${pod.current_hourly_cost * 720:.2f}/month
"""

        # Add focus area context
        focus_instruction = ""
        if request.focus_area == "efficiency":
            focus_instruction = "\n\n**FOCUS**: Prioritize resource efficiency improvements. Identify over-provisioned workloads and quantify waste by utilization percentage. Frame in terms of efficiency gains, not cost savings."
        elif request.focus_area == "performance":
            focus_instruction = "\n\n**FOCUS**: Prioritize performance risks. Focus on under-provisioned pods at risk of CPU throttling or OOM kills. Quantify risk level (high/medium/low) based on current utilization vs limits."
        elif request.focus_area == "reliability":
            focus_instruction = "\n\n**FOCUS**: Prioritize reliability risks. Focus on pods without proper resource limits and requests. Explain blast radius and noisy neighbor risks."

        full_prompt = f"{OPTIMIZATION_PROMPT}\n\n{context}{focus_instruction}\n\nProvide your analysis:"

        # Generate AI response with automatic fallback
        analysis_text = generate_ai_response(full_prompt)
        key_findings = []
        priority_actions = []

        # Parse key findings from the response
        lines = analysis_text.split('\n')
        in_findings = False
        in_actions = False

        for line in lines:
            line = line.strip()
            if 'key finding' in line.lower() or 'findings' in line.lower():
                in_findings = True
                in_actions = False
                continue
            if 'priority action' in line.lower() or 'actions' in line.lower() or 'recommendation' in line.lower():
                in_findings = False
                in_actions = True
                continue
            if 'risk' in line.lower() or 'quick win' in line.lower():
                in_findings = False
                in_actions = False

            if in_findings and (line.startswith('-') or line.startswith('*') or line.startswith('•')):
                finding = line.lstrip('-*• ').strip()
                if finding and len(finding) > 10:
                    key_findings.append(finding)
            if in_actions and (line.startswith('-') or line.startswith('*') or line.startswith('•') or line[0:1].isdigit()):
                action = line.lstrip('-*•0123456789. ').strip()
                if action and len(action) > 10:
                    priority_actions.append({
                        "action": action,
                        "priority": "high" if len(priority_actions) < 3 else "medium"
                    })

        # Fallback if parsing didn't work
        if not key_findings:
            key_findings = [
                f"Cluster efficiency is {dashboard.summary.cluster_efficiency_score.score:.0f}% (Grade {dashboard.summary.cluster_efficiency_score.grade})",
                f"{dashboard.summary.over_provisioned_pods} pods over-provisioned with {dashboard.summary.total_savings_percentage:.0f}% resource waste",
                f"{dashboard.summary.under_provisioned_pods} pods under-provisioned and at risk of OOM/throttling",
                f"{dashboard.summary.idle_pods} pods idle (<20% utilization) - candidates for scale-down",
            ]

        if not priority_actions:
            priority_actions = [
                {"action": f"Right-size {dashboard.summary.over_provisioned_pods} over-provisioned pods", "priority": "high"},
                {"action": f"Increase resources for {dashboard.summary.under_provisioned_pods} under-provisioned pods", "priority": "high"},
                {"action": f"Review {dashboard.summary.idle_pods} idle pods for potential removal", "priority": "medium"},
            ]

        result = OptimizationAnalysisResponse(
            analysis=analysis_text,
            key_findings=key_findings[:6],
            priority_actions=priority_actions[:5],
            efficiency_improvement_percent=dashboard.summary.total_savings_percentage,
            estimated_monthly_impact=dashboard.summary.total_potential_savings * 720,
            success=True
        )

        # Cache result for 10 minutes (600 seconds) to avoid expensive re-computation
        await cache_service.set(cache_key, result.model_dump(), ttl=600)
        logger.info(f"Cached optimization analysis for 10 minutes")

        return result

    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        raise HTTPException(status_code=503, detail="AI service not configured. Please set GROQ_API_KEY or GEMINI_API_KEY.")
    except Exception as e:
        logger.error(f"AI optimization analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"AI analysis error: {str(e)}")


# =============================================================================
# AGENTIC FEATURES - Proactive AI Capabilities for v1.4.0
# =============================================================================


class ProactiveInsight(BaseModel):
    id: str
    severity: str  # critical, high, medium, low
    category: str  # security, performance, cost, reliability
    title: str
    description: str
    impact: str
    recommendation: str
    auto_fixable: bool
    created_at: datetime


class ProactiveInsightsResponse(BaseModel):
    insights: List[ProactiveInsight]
    cluster_health_score: int
    total_issues: int
    critical_count: int
    high_count: int
    last_analyzed: datetime
    success: bool


class RunbookGenerateRequest(BaseModel):
    incident_type: str  # pod_crash, deployment_failed, node_not_ready, oom_killed, network_issue
    resource_name: Optional[str] = None
    namespace: Optional[str] = None
    additional_context: Optional[str] = None


class RunbookStep(BaseModel):
    step_number: int
    action: str
    command: Optional[str] = None
    expected_output: Optional[str] = None
    notes: Optional[str] = None


class RunbookResponse(BaseModel):
    title: str
    severity: str
    estimated_time: str
    prerequisites: List[str]
    steps: List[RunbookStep]
    verification_steps: List[str]
    escalation_path: str
    related_docs: List[str]
    success: bool


class SmartSuggestion(BaseModel):
    id: str
    type: str  # action, insight, warning
    title: str
    description: str
    action_command: Optional[str] = None
    priority: str
    context: str


class SmartSuggestionsResponse(BaseModel):
    suggestions: List[SmartSuggestion]
    context_summary: str
    success: bool


PROACTIVE_INSIGHTS_PROMPT = """You are an expert SRE and DevOps engineer analyzing a Kubernetes cluster for potential issues.

Analyze the provided data and identify proactive insights that could prevent incidents:

1. **Critical Issues** - Things that need immediate attention
2. **Security Risks** - Potential security vulnerabilities
3. **Performance Concerns** - Resource bottlenecks or inefficiencies
4. **Reliability Gaps** - Missing redundancy, single points of failure
5. **Cost Optimization** - Wasted resources

For each insight, provide:
- Severity (critical/high/medium/low)
- Category (security/performance/cost/reliability)
- Clear title
- Description of the issue
- Business impact
- Specific recommendation
- Whether it can be auto-fixed

Be specific and actionable. Use actual resource names from the data."""


RUNBOOK_PROMPT = """You are an expert SRE creating a runbook for incident response.

Create a detailed runbook for the given incident type with:

1. **Prerequisites** - What access/tools are needed
2. **Step-by-step Instructions** - Detailed commands with explanations
3. **Expected Outputs** - What to look for at each step
4. **Verification Steps** - How to confirm the issue is resolved
5. **Escalation Path** - When and how to escalate

Include actual kubectl commands, monitoring queries, and log analysis steps.
Make it actionable for an on-call engineer at 3 AM."""


@router.get("/insights/proactive", response_model=ProactiveInsightsResponse)
async def get_proactive_insights():
    """AI-powered proactive insights that identify issues before they become incidents."""
    try:
        # Check cache first
        cache_key = "ai:proactive_insights"
        cached_data = await cache_service.get(cache_key)
        if cached_data:
            logger.debug("Cache hit for proactive insights")
            return ProactiveInsightsResponse(**cached_data)

        insights = []
        critical_count = 0
        high_count = 0

        # Gather data from all services
        try:
            # Kubernetes health
            health = await kubernetes_service.get_cluster_health()
            pods = await kubernetes_service.get_pods()
            deployments = await kubernetes_service.get_deployments()

            # Check for unhealthy pods
            failed_pods = [p for p in pods if p.status.value in ("Failed", "Unknown")]
            pending_pods = [p for p in pods if p.status.value == "Pending"]
            crashing_pods = [p for p in pods if p.restart_count and p.restart_count > 5]

            for pod in failed_pods[:3]:
                insights.append(ProactiveInsight(
                    id=f"pod-failed-{pod.namespace}-{pod.name}",
                    severity="critical",
                    category="reliability",
                    title=f"Pod {pod.name} in Failed state",
                    description=f"Pod {pod.name} in namespace {pod.namespace} is in {pod.status.value} state",
                    impact="Service degradation or outage. Users may experience errors.",
                    recommendation=f"Check pod events: kubectl describe pod {pod.name} -n {pod.namespace}",
                    auto_fixable=False,
                    created_at=datetime.now(timezone.utc)
                ))
                critical_count += 1

            for pod in crashing_pods[:3]:
                insights.append(ProactiveInsight(
                    id=f"pod-crashing-{pod.namespace}-{pod.name}",
                    severity="high",
                    category="reliability",
                    title=f"Pod {pod.name} has {pod.restart_count} restarts",
                    description=f"Pod is experiencing frequent restarts which indicates application issues",
                    impact="Intermittent service failures. Potential data loss during restarts.",
                    recommendation=f"Check logs: kubectl logs {pod.name} -n {pod.namespace} --previous",
                    auto_fixable=False,
                    created_at=datetime.now(timezone.utc)
                ))
                high_count += 1

            for pod in pending_pods[:2]:
                insights.append(ProactiveInsight(
                    id=f"pod-pending-{pod.namespace}-{pod.name}",
                    severity="high",
                    category="reliability",
                    title=f"Pod {pod.name} stuck in Pending",
                    description=f"Pod cannot be scheduled. Check node resources and constraints.",
                    impact="Workload not running. Reduced capacity.",
                    recommendation=f"Check events: kubectl describe pod {pod.name} -n {pod.namespace}",
                    auto_fixable=False,
                    created_at=datetime.now(timezone.utc)
                ))
                high_count += 1

            # Check for unhealthy deployments
            for deploy in deployments:
                if deploy.ready_replicas is not None and deploy.replicas is not None:
                    if deploy.ready_replicas < deploy.replicas:
                        insights.append(ProactiveInsight(
                            id=f"deploy-degraded-{deploy.namespace}-{deploy.name}",
                            severity="high",
                            category="reliability",
                            title=f"Deployment {deploy.name} degraded",
                            description=f"Only {deploy.ready_replicas}/{deploy.replicas} replicas ready",
                            impact="Reduced capacity. Risk of complete outage if more pods fail.",
                            recommendation=f"Scale or investigate: kubectl rollout status deployment/{deploy.name} -n {deploy.namespace}",
                            auto_fixable=False,
                            created_at=datetime.now(timezone.utc)
                        ))
                        high_count += 1

        except Exception as e:
            logger.warning(f"Could not gather K8s data for insights: {e}")

        # Security insights
        try:
            security_service = get_security_service()
            dashboard = await security_service.get_security_dashboard()

            if dashboard.security_score.critical_issues > 0:
                insights.append(ProactiveInsight(
                    id="security-critical-issues",
                    severity="critical",
                    category="security",
                    title=f"{dashboard.security_score.critical_issues} critical security issues",
                    description="Critical vulnerabilities or misconfigurations detected in the cluster",
                    impact="Potential security breach. Data exposure risk.",
                    recommendation="Review Security Dashboard and address critical findings immediately",
                    auto_fixable=False,
                    created_at=datetime.now(timezone.utc)
                ))
                critical_count += 1

            if dashboard.security_score.score < 50:
                insights.append(ProactiveInsight(
                    id="security-low-score",
                    severity="high",
                    category="security",
                    title=f"Security score is only {dashboard.security_score.score}/100",
                    description="Cluster security posture needs improvement",
                    impact="Increased attack surface and compliance risks",
                    recommendation="Focus on addressing high-severity findings first",
                    auto_fixable=False,
                    created_at=datetime.now(timezone.utc)
                ))
                high_count += 1

        except Exception as e:
            logger.warning(f"Could not gather security data for insights: {e}")

        # Efficiency insights
        try:
            opt_dashboard = await optimization_service.get_optimization_dashboard()

            if opt_dashboard.summary.total_savings_percentage > 30:
                insights.append(ProactiveInsight(
                    id="efficiency-high-waste",
                    severity="medium",
                    category="efficiency",
                    title=f"{opt_dashboard.summary.total_savings_percentage:.0f}% resource waste detected",
                    description=f"Over-provisioned resources using only {100 - opt_dashboard.summary.total_savings_percentage:.0f}% of allocated capacity",
                    impact="Reduced cluster efficiency and resource contention risk",
                    recommendation="Review Resource Efficiency recommendations for right-sizing opportunities",
                    auto_fixable=True,
                    created_at=datetime.now(timezone.utc)
                ))

            if opt_dashboard.summary.idle_pods > 5:
                insights.append(ProactiveInsight(
                    id="efficiency-idle-pods",
                    severity="low",
                    category="efficiency",
                    title=f"{opt_dashboard.summary.idle_pods} idle pods detected",
                    description="Pods consuming resources with near-zero utilization",
                    impact="Reduced cluster efficiency and potential resource contention",
                    recommendation="Review idle resources in AI Optimization Hub for scale-down candidates",
                    auto_fixable=False,
                    created_at=datetime.now(timezone.utc)
                ))

        except Exception as e:
            logger.warning(f"Could not gather optimization data for insights: {e}")

        # Calculate health score
        health_score = 100
        health_score -= critical_count * 15
        health_score -= high_count * 8
        health_score -= (len(insights) - critical_count - high_count) * 3
        health_score = max(0, min(100, health_score))

        response = ProactiveInsightsResponse(
            insights=insights[:20],
            cluster_health_score=health_score,
            total_issues=len(insights),
            critical_count=critical_count,
            high_count=high_count,
            last_analyzed=datetime.now(timezone.utc),
            success=True
        )

        # Cache for 2 minutes
        await cache_service.set(cache_key, response.model_dump(), ttl=120)

        return response

    except Exception as e:
        logger.error(f"Error generating proactive insights: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate insights: {str(e)}")


@router.post("/runbook/generate", response_model=RunbookResponse)
async def generate_runbook(request: RunbookGenerateRequest):
    """Generate an AI-powered runbook for incident response."""
    try:
        # Build context based on incident type
        context = f"""
# Incident Runbook Request

**Incident Type**: {request.incident_type}
**Resource**: {request.resource_name or 'Not specified'}
**Namespace**: {request.namespace or 'default'}
**Additional Context**: {request.additional_context or 'None'}

Generate a detailed runbook for resolving this type of incident in a Kubernetes environment.
Include specific kubectl commands, expected outputs, and troubleshooting steps.
"""

        # Add relevant data if we can fetch it
        if request.namespace and request.resource_name:
            try:
                events = await kubernetes_service.get_events(namespace=request.namespace)
                relevant_events = [e for e in events if request.resource_name in str(e)][:5]
                if relevant_events:
                    context += "\n## Recent Events\n"
                    for event in relevant_events:
                        context += f"- [{event.type}] {event.reason}: {event.message}\n"
            except Exception:
                pass

        full_prompt = f"{RUNBOOK_PROMPT}\n\n{context}\n\nGenerate the runbook:"

        runbook_text = generate_ai_response(full_prompt)

        # Parse the runbook
        steps = []
        prerequisites = []
        verification_steps = []

        lines = runbook_text.split('\n')
        current_section = None
        step_num = 0

        for line in lines:
            line = line.strip()
            line_lower = line.lower()

            if 'prerequisite' in line_lower:
                current_section = 'prereq'
                continue
            elif 'step' in line_lower and ('1' in line or 'instruction' in line_lower):
                current_section = 'steps'
                continue
            elif 'verif' in line_lower:
                current_section = 'verify'
                continue

            if current_section == 'prereq' and (line.startswith('-') or line.startswith('*')):
                prerequisites.append(line.lstrip('-* '))
            elif current_section == 'steps' and (line.startswith('-') or line.startswith('*') or line[0:1].isdigit()):
                step_num += 1
                action = line.lstrip('-*0123456789. ')
                command = None
                if 'kubectl' in action or '`' in action:
                    # Extract command from backticks or kubectl reference
                    if '`' in action:
                        parts = action.split('`')
                        if len(parts) >= 2:
                            command = parts[1]
                    elif 'kubectl' in action:
                        command = action
                steps.append(RunbookStep(
                    step_number=step_num,
                    action=action,
                    command=command,
                    expected_output=None,
                    notes=None
                ))
            elif current_section == 'verify' and (line.startswith('-') or line.startswith('*')):
                verification_steps.append(line.lstrip('-* '))

        # Fallback defaults
        if not prerequisites:
            prerequisites = [
                "kubectl CLI access to the cluster",
                "Appropriate RBAC permissions",
                "Access to logging/monitoring systems"
            ]

        if not steps:
            steps = [
                RunbookStep(
                    step_number=1,
                    action="Check pod status and events",
                    command=f"kubectl describe pod {request.resource_name or '<pod-name>'} -n {request.namespace or 'default'}",
                    expected_output="Look for Events section and container states",
                    notes=None
                ),
                RunbookStep(
                    step_number=2,
                    action="Check pod logs",
                    command=f"kubectl logs {request.resource_name or '<pod-name>'} -n {request.namespace or 'default'} --tail=100",
                    expected_output="Look for error messages or stack traces",
                    notes="Use --previous flag if pod has restarted"
                ),
                RunbookStep(
                    step_number=3,
                    action="Check resource usage",
                    command=f"kubectl top pod {request.resource_name or '<pod-name>'} -n {request.namespace or 'default'}",
                    expected_output="Compare against resource limits",
                    notes=None
                )
            ]

        if not verification_steps:
            verification_steps = [
                "Verify pod is Running: kubectl get pod <name> -n <namespace>",
                "Check application health endpoint",
                "Monitor for recurrence in the next 15 minutes"
            ]

        # Determine severity based on incident type
        severity_map = {
            "pod_crash": "high",
            "deployment_failed": "high",
            "node_not_ready": "critical",
            "oom_killed": "high",
            "network_issue": "medium"
        }
        severity = severity_map.get(request.incident_type, "medium")

        return RunbookResponse(
            title=f"Runbook: {request.incident_type.replace('_', ' ').title()}",
            severity=severity,
            estimated_time="15-30 minutes",
            prerequisites=prerequisites[:5],
            steps=steps[:10],
            verification_steps=verification_steps[:5],
            escalation_path="If unresolved after 30 minutes, escalate to platform team lead",
            related_docs=[
                "https://kubernetes.io/docs/tasks/debug/",
                "https://kubernetes.io/docs/reference/kubectl/cheatsheet/"
            ],
            success=True
        )

    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        raise HTTPException(status_code=503, detail="AI service not configured.")
    except Exception as e:
        logger.error(f"Runbook generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate runbook: {str(e)}")


@router.get("/suggestions/smart", response_model=SmartSuggestionsResponse)
async def get_smart_suggestions():
    """Get AI-powered smart suggestions based on current cluster state."""
    try:
        suggestions = []
        context_parts = []

        # Gather quick context
        try:
            health = await kubernetes_service.get_cluster_health()
            context_parts.append(f"Cluster: {health.ready_nodes}/{health.node_count} nodes ready, {health.running_pods}/{health.total_pods} pods running")

            if not health.healthy:
                suggestions.append(SmartSuggestion(
                    id="cluster-unhealthy",
                    type="warning",
                    title="Cluster Health Check Required",
                    description=f"Cluster is reporting unhealthy status with {len(health.warnings)} warnings",
                    action_command="kubectl get nodes && kubectl get pods -A | grep -v Running",
                    priority="high",
                    context="cluster_health"
                ))

            if health.running_pods < health.total_pods * 0.9:
                suggestions.append(SmartSuggestion(
                    id="pods-not-running",
                    type="action",
                    title="Investigate Non-Running Pods",
                    description=f"Only {health.running_pods}/{health.total_pods} pods are running",
                    action_command="kubectl get pods -A --field-selector=status.phase!=Running",
                    priority="high",
                    context="pod_status"
                ))

        except Exception as e:
            logger.warning(f"Could not get cluster health: {e}")

        # Check for pending operations
        try:
            deployments = await kubernetes_service.get_deployments()
            scaling_deployments = [d for d in deployments if d.ready_replicas != d.replicas]

            if scaling_deployments:
                suggestions.append(SmartSuggestion(
                    id="deployments-scaling",
                    type="insight",
                    title=f"{len(scaling_deployments)} deployments are scaling",
                    description="Some deployments haven't reached desired replica count",
                    action_command="kubectl get deployments -A | grep -v '1/1\\|2/2\\|3/3'",
                    priority="medium",
                    context="deployment_status"
                ))

        except Exception as e:
            logger.warning(f"Could not get deployments: {e}")

        # Quick efficiency check
        try:
            opt_dashboard = await optimization_service.get_optimization_dashboard()
            if opt_dashboard.summary.total_savings_percentage > 20:
                suggestions.append(SmartSuggestion(
                    id="efficiency-improvement",
                    type="insight",
                    title=f"Improve efficiency by {opt_dashboard.summary.total_savings_percentage:.0f}%",
                    description=f"Right-size {opt_dashboard.summary.over_provisioned_pods} over-provisioned workloads to reduce resource waste",
                    action_command=None,
                    priority="low",
                    context="resource_efficiency"
                ))
        except Exception:
            pass

        # Add helpful shortcuts
        suggestions.append(SmartSuggestion(
            id="quick-status",
            type="action",
            title="Quick Cluster Status",
            description="Get a quick overview of cluster health",
            action_command="kubectl get nodes && kubectl top nodes && kubectl get pods -A --sort-by='.status.startTime' | tail -20",
            priority="low",
            context="quick_commands"
        ))

        return SmartSuggestionsResponse(
            suggestions=suggestions[:10],
            context_summary=" | ".join(context_parts) if context_parts else "Cluster context unavailable",
            success=True
        )

    except Exception as e:
        logger.error(f"Error getting smart suggestions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get suggestions: {str(e)}")


# ============================================================================
# YAML Review Endpoint
# ============================================================================

class YAMLReviewRequest(BaseModel):
    yaml_content: str
    namespace: Optional[str] = None


class YAMLReviewIssue(BaseModel):
    severity: str  # critical, high, medium, low
    type: str
    message: str
    suggestion: Optional[str] = None


class YAMLReviewResponse(BaseModel):
    score: int
    issues: List[YAMLReviewIssue]
    suggestions: List[str]
    security_score: int
    best_practice_score: int
    success: bool


YAML_REVIEW_PROMPT = """You are a Kubernetes security and best practices expert. Analyze the provided Kubernetes YAML manifest(s) and identify issues.

For each issue found, categorize by:

**CRITICAL Issues** (Security vulnerabilities):
- Running as root
- No security context
- Privileged containers
- Host network/PID access
- Hardcoded secrets

**HIGH Issues** (Resource & Health):
- Missing resource limits/requests
- Missing liveness/readiness probes
- No pod disruption budget for production workloads

**MEDIUM Issues** (Best Practices):
- Using 'latest' image tag
- Missing labels (app, version, component)
- No anti-affinity rules
- Missing namespace specification

**LOW Issues** (Recommendations):
- Missing annotations
- Image pull policy not explicit
- No service account specified

For each issue provide:
- severity: critical/high/medium/low
- type: Security/Resource Management/Health Checks/Best Practice/Configuration
- message: Clear description
- suggestion: How to fix it

Also provide:
- Overall Score (0-100)
- Security Score (0-100)
- Best Practice Score (0-100)
- General recommendations for improvement

Return your analysis as JSON with this exact structure:
{
  "score": <number>,
  "security_score": <number>,
  "best_practice_score": <number>,
  "issues": [
    {"severity": "...", "type": "...", "message": "...", "suggestion": "..."}
  ],
  "suggestions": ["recommendation1", "recommendation2", ...]
}"""


@router.post("/yaml-review", response_model=YAMLReviewResponse)
async def review_yaml(request: YAMLReviewRequest):
    """Analyze Kubernetes YAML manifest for security issues, best practices, and production readiness."""
    try:
        context = f"""
# Kubernetes YAML Manifest Review

## Target Namespace
{request.namespace or 'Not specified (will use default)'}

## YAML Content
```yaml
{request.yaml_content}
```

Analyze this YAML manifest thoroughly and return your findings as JSON.
"""

        full_prompt = f"{YAML_REVIEW_PROMPT}\n\n{context}"

        response_text = generate_ai_response(full_prompt)

        # Try to parse JSON from response
        import json
        import re

        # Extract JSON from response (may be wrapped in markdown code blocks)
        json_match = re.search(r'```json\s*(.*?)\s*```', response_text, re.DOTALL)
        if json_match:
            json_str = json_match.group(1)
        else:
            # Try to find raw JSON
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                json_str = json_match.group(0)
            else:
                # Fallback to basic analysis if JSON parsing fails
                return create_fallback_yaml_review(request.yaml_content)

        try:
            result = json.loads(json_str)

            # Validate and structure the response
            issues = []
            for issue in result.get('issues', []):
                issues.append(YAMLReviewIssue(
                    severity=issue.get('severity', 'medium'),
                    type=issue.get('type', 'General'),
                    message=issue.get('message', 'Issue detected'),
                    suggestion=issue.get('suggestion')
                ))

            return YAMLReviewResponse(
                score=result.get('score', 50),
                issues=issues,
                suggestions=result.get('suggestions', []),
                security_score=result.get('security_score', 50),
                best_practice_score=result.get('best_practice_score', 50),
                success=True
            )
        except json.JSONDecodeError:
            return create_fallback_yaml_review(request.yaml_content)

    except ValueError as e:
        # AI not configured - use fallback analysis
        logger.warning(f"AI not available, using fallback: {e}")
        return create_fallback_yaml_review(request.yaml_content)
    except Exception as e:
        logger.error(f"Error reviewing YAML: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to review YAML: {str(e)}")


# ============================================================================
# Workload Analysis Endpoint
# ============================================================================

class WorkloadAnalysisRequest(BaseModel):
    workload_name: str
    workload_type: str  # deployment, statefulset, daemonset, job
    namespace: str
    spec: Optional[dict] = None


class WorkloadAnalysisFix(BaseModel):
    title: str
    description: str
    severity: str  # high, medium, low
    category: str  # performance, security, reliability, best_practice
    fix_yaml: Optional[str] = None
    kubectl_command: Optional[str] = None
    auto_fixable: bool = False


class WorkloadAnalysisResponse(BaseModel):
    workload_name: str
    workload_type: str
    health_score: int
    fixes: List[WorkloadAnalysisFix]
    summary: str
    success: bool


WORKLOAD_ANALYSIS_PROMPT = """You are a Kubernetes expert analyzing a workload for potential improvements.

Analyze the provided workload and identify issues and recommendations in these categories:

1. **Performance** - Resource limits, HPA, memory/CPU configuration
2. **Security** - Security contexts, service accounts, privileges
3. **Reliability** - Health probes, replicas, anti-affinity, PDB
4. **Best Practices** - Labels, annotations, image tags, configurations

For each issue provide:
- title: Short descriptive title
- description: Detailed explanation
- severity: high/medium/low
- category: performance/security/reliability/best_practice
- fix_yaml: YAML snippet to fix (if applicable)
- kubectl_command: kubectl command to apply fix (if applicable)
- auto_fixable: true/false

Return JSON with this structure:
{
  "health_score": <0-100>,
  "summary": "Brief summary of findings",
  "fixes": [
    {"title": "...", "description": "...", "severity": "...", "category": "...", "fix_yaml": "...", "kubectl_command": "...", "auto_fixable": false}
  ]
}"""


@router.post("/workload/analyze", response_model=WorkloadAnalysisResponse)
async def analyze_workload(request: WorkloadAnalysisRequest):
    """AI-powered workload analysis with fix recommendations."""
    try:
        # Build context with workload data
        context = f"""
# Workload Analysis Request

**Workload**: {request.workload_name}
**Type**: {request.workload_type}
**Namespace**: {request.namespace}
"""

        # Try to fetch real workload data from Kubernetes
        try:
            if request.workload_type == 'deployment':
                deployments = await kubernetes_service.get_deployments(namespace=request.namespace)
                workload = next((d for d in deployments if d.name == request.workload_name), None)
                if workload:
                    context += f"""
## Current Configuration
- Replicas: {workload.replicas}
- Ready Replicas: {workload.ready_replicas}
- Image: {workload.image}
- Created: {workload.created_at}
"""
            elif request.workload_type == 'statefulset':
                statefulsets = await kubernetes_service.get_statefulsets(namespace=request.namespace)
                workload = next((s for s in statefulsets if s.name == request.workload_name), None)
                if workload:
                    context += f"""
## Current Configuration
- Replicas: {workload.replicas}
- Ready Replicas: {workload.ready_replicas}
"""
        except Exception as e:
            logger.warning(f"Could not fetch workload details: {e}")

        if request.spec:
            import json
            context += f"""
## Workload Spec
```yaml
{json.dumps(request.spec, indent=2)}
```
"""

        context += "\nAnalyze this workload and provide recommendations in JSON format."

        full_prompt = f"{WORKLOAD_ANALYSIS_PROMPT}\n\n{context}"

        response_text = generate_ai_response(full_prompt)

        # Parse JSON response
        import json as json_lib
        import re

        json_match = re.search(r'```json\s*(.*?)\s*```', response_text, re.DOTALL)
        if json_match:
            json_str = json_match.group(1)
        else:
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                json_str = json_match.group(0)
            else:
                return create_fallback_workload_analysis(request)

        try:
            result = json_lib.loads(json_str)

            fixes = []
            for fix in result.get('fixes', []):
                fixes.append(WorkloadAnalysisFix(
                    title=fix.get('title', 'Recommendation'),
                    description=fix.get('description', ''),
                    severity=fix.get('severity', 'medium'),
                    category=fix.get('category', 'best_practice'),
                    fix_yaml=fix.get('fix_yaml'),
                    kubectl_command=fix.get('kubectl_command'),
                    auto_fixable=fix.get('auto_fixable', False)
                ))

            return WorkloadAnalysisResponse(
                workload_name=request.workload_name,
                workload_type=request.workload_type,
                health_score=result.get('health_score', 70),
                fixes=fixes,
                summary=result.get('summary', 'Analysis complete'),
                success=True
            )
        except json_lib.JSONDecodeError:
            return create_fallback_workload_analysis(request)

    except ValueError as e:
        logger.warning(f"AI not available for workload analysis: {e}")
        return create_fallback_workload_analysis(request)
    except Exception as e:
        logger.error(f"Error analyzing workload: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze workload: {str(e)}")


def create_fallback_workload_analysis(request: WorkloadAnalysisRequest) -> WorkloadAnalysisResponse:
    """Fallback workload analysis when AI is not available."""
    fixes = [
        WorkloadAnalysisFix(
            title="Add resource limits",
            description="No memory limits defined. Consider adding limits to prevent OOM issues and improve cluster stability.",
            severity="high",
            category="performance",
            fix_yaml=f"""resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 128Mi""",
            kubectl_command=f"kubectl set resources {request.workload_type}/{request.workload_name} -n {request.namespace} --limits=cpu=500m,memory=512Mi --requests=cpu=100m,memory=128Mi",
            auto_fixable=True
        ),
        WorkloadAnalysisFix(
            title="Enable HPA",
            description="This workload could benefit from horizontal pod autoscaling for better resource utilization and availability.",
            severity="medium",
            category="reliability",
            fix_yaml=f"""apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {request.workload_name}-hpa
  namespace: {request.namespace}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: {request.workload_type.title()}
    name: {request.workload_name}
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70""",
            kubectl_command=None,
            auto_fixable=False
        ),
        WorkloadAnalysisFix(
            title="Add liveness probe",
            description="No liveness probe configured. Add one for better health checking and automatic recovery.",
            severity="medium",
            category="reliability",
            fix_yaml="""livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10
  failureThreshold: 3""",
            kubectl_command=None,
            auto_fixable=False
        ),
        WorkloadAnalysisFix(
            title="Add readiness probe",
            description="No readiness probe configured. This ensures traffic is only sent to ready pods.",
            severity="medium",
            category="reliability",
            fix_yaml="""readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5""",
            kubectl_command=None,
            auto_fixable=False
        ),
        WorkloadAnalysisFix(
            title="Configure security context",
            description="Running containers without security context can pose security risks.",
            severity="high",
            category="security",
            fix_yaml="""securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop:
      - ALL""",
            kubectl_command=None,
            auto_fixable=False
        )
    ]

    return WorkloadAnalysisResponse(
        workload_name=request.workload_name,
        workload_type=request.workload_type,
        health_score=65,
        fixes=fixes,
        summary=f"Analysis of {request.workload_type} '{request.workload_name}' found {len(fixes)} potential improvements in performance, reliability, and security.",
        success=True
    )


def create_fallback_yaml_review(yaml_content: str) -> YAMLReviewResponse:
    """Fallback YAML review when AI is not available - uses basic string matching."""
    issues = []
    suggestions = []

    yaml_lower = yaml_content.lower()

    # Check for common issues
    if 'resources:' not in yaml_lower:
        issues.append(YAMLReviewIssue(
            severity='high',
            type='Resource Management',
            message='No resource limits defined',
            suggestion='Add resources.requests and resources.limits for CPU and memory'
        ))

    if 'livenessprobe' not in yaml_lower or 'readinessprobe' not in yaml_lower:
        issues.append(YAMLReviewIssue(
            severity='high',
            type='Health Checks',
            message='Missing health probes',
            suggestion='Add livenessProbe and readinessProbe for container health monitoring'
        ))

    if 'securitycontext' not in yaml_lower:
        issues.append(YAMLReviewIssue(
            severity='critical',
            type='Security',
            message='No security context defined',
            suggestion='Add securityContext with runAsNonRoot: true and allowPrivilegeEscalation: false'
        ))

    if ':latest' in yaml_content or 'image: ' in yaml_content and ':' not in yaml_content.split('image: ')[1].split('\n')[0] if 'image: ' in yaml_content else False:
        issues.append(YAMLReviewIssue(
            severity='medium',
            type='Best Practice',
            message='Using "latest" tag or no version tag specified',
            suggestion='Use specific version tags for reproducible deployments'
        ))

    if 'privileged: true' in yaml_lower:
        issues.append(YAMLReviewIssue(
            severity='critical',
            type='Security',
            message='Container running in privileged mode',
            suggestion='Remove privileged: true unless absolutely necessary'
        ))

    if 'hostnetwork: true' in yaml_lower:
        issues.append(YAMLReviewIssue(
            severity='high',
            type='Security',
            message='Using host network',
            suggestion='Avoid hostNetwork: true unless required for specific networking needs'
        ))

    # Add general suggestions
    suggestions.append('Consider using PodDisruptionBudget for high availability')
    suggestions.append('Add network policies for network segmentation')
    suggestions.append('Use HorizontalPodAutoscaler for automatic scaling')
    suggestions.append('Consider using a ServiceAccount with minimal permissions')

    # Calculate scores
    critical_count = len([i for i in issues if i.severity == 'critical'])
    high_count = len([i for i in issues if i.severity == 'high'])
    medium_count = len([i for i in issues if i.severity == 'medium'])

    security_score = max(0, 100 - critical_count * 30 - high_count * 15)
    best_practice_score = max(0, 100 - medium_count * 20 - high_count * 10)
    overall_score = int((security_score + best_practice_score) / 2)

    return YAMLReviewResponse(
        score=overall_score,
        issues=issues,
        suggestions=suggestions,
        security_score=security_score,
        best_practice_score=best_practice_score,
        success=True
    )


# ============================================================================
# Log Summary Endpoint for Monitoring Dashboard
# ============================================================================

class LogSummaryRequest(BaseModel):
    namespace: Optional[str] = None
    time_window_minutes: int = 10


class LogSummaryResponse(BaseModel):
    summary: str
    error_count: int
    time_window: str
    key_issues: List[str]
    success: bool


LOG_SUMMARY_PROMPT = """You are an expert SRE analyzing Kubernetes event logs to identify patterns and root causes.

Analyze the provided Kubernetes error and warning events and provide:

1. **Root Cause Summary** (1-2 sentences) - What's the main issue?
2. **Most Common Error Pattern** - What error is happening the most?
3. **Affected Workloads** - Which pods/deployments are impacted?
4. **Key Issues** (3-5 bullet points) - List the specific problems found

Keep the summary concise and actionable for developers troubleshooting issues.
Focus on the "why" not just the "what"."""


@router.post("/summarize-logs", response_model=LogSummaryResponse)
async def summarize_logs(request: LogSummaryRequest):
    """
    Analyze recent Kubernetes error/warning logs and generate AI-powered summary.
    Used by the Monitoring Dashboard to provide quick insights into cluster issues.
    """
    try:
        # Check cache first (2 minute TTL to reduce API calls)
        cache_key = f"ai:log_summary:{request.namespace or 'all'}:{request.time_window_minutes}"
        cached_data = await cache_service.get(cache_key)
        if cached_data:
            logger.debug(f"Cache hit for log summary: {sanitize_log_input(cache_key)}")
            return LogSummaryResponse(**cached_data)

        # Fetch recent error/warning events
        events = await kubernetes_service.get_events(
            namespace=request.namespace,
            limit=100
        )

        # Filter to only Warning/Error events from the specified time window
        from datetime import datetime, timedelta, timezone
        cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=request.time_window_minutes)

        warning_events = []
        for event in events:
            if event.type == 'Warning':
                # Try to parse event timestamp
                try:
                    if event.last_timestamp:
                        event_time = datetime.fromisoformat(event.last_timestamp.replace('Z', '+00:00'))
                        if event_time >= cutoff_time:
                            warning_events.append(event)
                except:
                    # If timestamp parsing fails, include the event anyway
                    warning_events.append(event)

        # If no errors found, return a positive message
        if not warning_events:
            response = LogSummaryResponse(
                summary="No warnings or errors detected in the last {} minutes. Your cluster is healthy!".format(request.time_window_minutes),
                error_count=0,
                time_window=f"{request.time_window_minutes} minutes",
                key_issues=[],
                success=True
            )
            # Cache the healthy response for 2 minutes
            await cache_service.set(cache_key, response.model_dump(), ttl=120)
            return response

        # Build prompt with event details
        error_messages = []
        workload_names = set()

        for event in warning_events[:20]:  # Limit to 20 most recent
            error_messages.append(f"- [{event.reason}] {event.involved_object.get('kind', 'Unknown')}/{event.involved_object.get('name', 'Unknown')}: {event.message}")
            if event.involved_object and event.involved_object.get('name'):
                workload_names.add(event.involved_object.get('name'))

        context = f"""
# Kubernetes Event Log Analysis

## Time Window
Last {request.time_window_minutes} minutes

## Namespace
{request.namespace or 'All namespaces'}

## Error Count
{len(warning_events)} warning/error events

## Recent Events
{chr(10).join(error_messages[:20])}

## Affected Workloads
{', '.join(list(workload_names)[:10])}

Analyze these events and provide a concise summary of what's happening and what needs attention.
"""

        full_prompt = f"{LOG_SUMMARY_PROMPT}\n\n{context}\n\nProvide your analysis:"

        # Generate AI response with automatic fallback
        analysis_text = generate_ai_response(full_prompt)

        # Extract key issues from response
        key_issues = []
        lines = analysis_text.split('\n')
        in_issues = False

        for line in lines:
            line = line.strip()
            if 'key issue' in line.lower() or 'issues:' in line.lower():
                in_issues = True
                continue
            if in_issues and (line.startswith('-') or line.startswith('*') or line.startswith('•') or line[0:1].isdigit()):
                issue = line.lstrip('-*•0123456789. ').strip()
                if issue and len(issue) > 10:
                    key_issues.append(issue)
                    if len(key_issues) >= 5:
                        break

        # Fallback if no issues were parsed
        if not key_issues and warning_events:
            # Group events by reason to find patterns
            reason_counts = {}
            for event in warning_events:
                reason = event.reason or 'Unknown'
                reason_counts[reason] = reason_counts.get(reason, 0) + 1

            # Add top 3 most common issues
            sorted_reasons = sorted(reason_counts.items(), key=lambda x: x[1], reverse=True)
            for reason, count in sorted_reasons[:3]:
                key_issues.append(f"{reason} occurred {count} times")

        response = LogSummaryResponse(
            summary=analysis_text,
            error_count=len(warning_events),
            time_window=f"{request.time_window_minutes} minutes",
            key_issues=key_issues[:5],
            success=True
        )

        # Cache the response for 2 minutes
        await cache_service.set(cache_key, response.model_dump(), ttl=120)

        return response

    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        raise HTTPException(status_code=503, detail="AI service not configured. Please set GROQ_API_KEY or GEMINI_API_KEY.")
    except Exception as e:
        logger.error(f"Log summary error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to summarize logs: {str(e)}")
