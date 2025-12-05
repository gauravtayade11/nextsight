"""AI Chat API routes for NexOps AI assistant with real-time data from all sections."""

import logging
from typing import Optional

import google.generativeai as genai
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.config import settings
from app.services.kubernetes_service import kubernetes_service
from app.services.security_service import get_security_service
from app.services.jenkins_service import jenkins_service
from app.services.helm_service import helm_service
from app.services.cost_service import cost_service
from app.services.timeline_service import timeline_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai")


class ChatRequest(BaseModel):
    message: str
    context: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    success: bool


# Initialize Gemini
_gemini_model = None


def get_gemini_model():
    global _gemini_model
    if _gemini_model is None:
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY not configured")
        genai.configure(api_key=settings.GEMINI_API_KEY)
        _gemini_model = genai.GenerativeModel(settings.GEMINI_MODEL)
    return _gemini_model


# Keywords to detect query types across all NexOps sections
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
    # Cost
    "cost": ["cost", "costs", "spending", "expensive", "billing", "price", "budget", "savings"],
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
    """Fetch relevant data from all NexOps services based on query types."""
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

    # ===== COST CONTEXT =====
    if "cost" in query_types:
        try:
            dashboard = await cost_service.get_cost_dashboard()
            recommendations = await cost_service.get_recommendations()

            context_parts.append(
                f"""
## Cost Analysis
- **Total Daily Cost**: ${dashboard.total_daily_cost:.2f}
- **Total Monthly Cost**: ${dashboard.total_monthly_cost:.2f}
- **CPU Cost**: ${dashboard.cpu_cost:.2f}/day
- **Memory Cost**: ${dashboard.memory_cost:.2f}/day
- **Storage Cost**: ${dashboard.storage_cost:.2f}/day

### Cost by Namespace (Top 5):
"""
                + "\n".join([f"- **{ns.namespace}**: ${ns.daily_cost:.2f}/day" for ns in dashboard.namespace_costs[:5]])
                + f"""

### Savings Recommendations:
"""
                + "\n".join(
                    [f"- [{r.priority}] {r.title}: Save ${r.potential_savings:.2f}/month" for r in recommendations[:3]]
                )
            )
        except Exception as e:
            logger.warning(f"Could not fetch cost data: {e}")

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


SYSTEM_PROMPT = """You are NexOps AI, the intelligent assistant for NexOps - a unified DevOps operations center.

You have access to REAL-TIME data from all NexOps sections:
- **Kubernetes**: Cluster health, pods, deployments, services, nodes, namespaces, resource usage
- **Security**: Security scores, vulnerabilities, RBAC analysis, network policies, compliance
- **Jenkins**: CI/CD pipelines, builds, job status
- **Helm**: Chart releases, deployments
- **Cost**: Resource costs, spending analysis, optimization recommendations
- **Timeline**: Recent activities and events
- **Incidents**: Active incidents and alerts

Guidelines:
1. **Be CONCISE** - Give direct answers with specific numbers from the data
2. **Be ACTIONABLE** - Provide kubectl commands, recommendations, or next steps
3. **Be ACCURATE** - Use only the data provided, don't make up numbers
4. **Use Markdown** - Format responses with headers, lists, and code blocks
5. **Answer Directly** - Don't ask clarifying questions if the data already has the answer

When asked about any NexOps feature, use the real-time data provided to give accurate, helpful responses."""


@router.options("/chat")
async def chat_options():
    """Handle CORS preflight for chat endpoint."""
    return {"message": "OK"}


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Send a message to the AI assistant with real-time data from all NexOps sections."""
    try:
        model = get_gemini_model()

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
            full_prompt += f"# Current NexOps Data (Real-Time)\n{data_context}\n\n"

        if request.context:
            full_prompt += f"Additional context: {request.context}\n\n"

        full_prompt += f"User Question: {request.message}\n\nAssistant (be concise, use real data):"

        response = model.generate_content(full_prompt)

        return ChatResponse(response=response.text, success=True)

    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        raise HTTPException(status_code=503, detail="AI service not configured. Please set GEMINI_API_KEY.")
    except Exception as e:
        logger.error(f"AI chat error: {e}")
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")


@router.get("/health")
async def ai_health():
    """Check if AI service is available and connected to all services."""
    try:
        if not settings.GEMINI_API_KEY:
            return {"status": "unavailable", "reason": "GEMINI_API_KEY not configured"}

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
