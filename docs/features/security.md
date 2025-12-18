# Security Posture Dashboard

NextSight AI provides comprehensive security scanning and analysis for your Kubernetes clusters with **built-in Trivy vulnerability scanning** - no external tools required!

!!! success "Built-in Security Scanning"
    Trivy v0.58.0 is included directly in the NextSight AI Docker image. Container vulnerability scanning works immediately without any external installation, configuration, or internet connectivity (perfect for air-gapped environments).

## Security Score

### Comprehensive Security Dashboard

![Security - Security posture dashboard with vulnerability scanning and top risks](../images/security-dashboard.png)

*Complete security overview with Top 3 risks, vulnerability scans, RBAC analysis, and AI-powered remediation*

### Grading System

Your cluster receives a security grade based on findings:

| Grade | Score Range | Status |
|-------|-------------|--------|
| A | 90-100 | Excellent |
| B | 80-89 | Good |
| C | 70-79 | Fair |
| D | 60-69 | Poor |
| F | 0-59 | Critical |

### Score Factors

- **Privileged Containers** - Containers running as privileged
- **Root Users** - Containers running as root
- **Host Mounts** - Containers with hostPath volumes
- **Security Contexts** - Missing security contexts
- **Network Policies** - Namespace network policy coverage
- **RBAC Issues** - Overly permissive roles

## Security Findings

### Categories

#### Workload Security
- Privileged containers
- Root user containers
- Host network/PID/IPC usage
- Capabilities (SYS_ADMIN, NET_RAW, etc.)

#### Image Security
- Vulnerability scanning (Trivy)
- CVE detection with severity
- CVSS scores
- Available fix versions

#### RBAC Analysis
- Cluster-admin bindings
- Wildcard permissions
- Service account risks
- Role binding analysis

#### Network Security
- Network policy coverage
- Namespace isolation
- Ingress/Egress rules

## Vulnerability Scanning

NextSight AI includes **Trivy v0.58.0** built directly into the backend Docker image for zero-configuration vulnerability scanning:

!!! info "No Installation Required"
    Unlike other platforms that require external Trivy installation, NextSight AI includes Trivy in the image. This means:

    - ✅ Zero setup - scanning works immediately
    - ✅ Air-gapped friendly - no external downloads needed
    - ✅ Consistent experience - same Trivy version everywhere
    - ✅ Faster scans - Trivy binary ready to use

### Severity Levels

| Severity | Description |
|----------|-------------|
| CRITICAL | Immediate action required |
| HIGH | Should be fixed soon |
| MEDIUM | Plan to fix |
| LOW | Consider fixing |

### Scan Results

Each vulnerability shows:
- **CVE ID** - Unique identifier
- **Package** - Affected package
- **Version** - Installed version
- **Fixed In** - Version with fix
- **CVSS Score** - Severity score

## AI-Powered Remediation

### Intelligent Security Fixes

![Security - AI-powered remediation with kubectl commands and YAML examples](../images/security-remediation.png)

*Get AI-generated security fixes with detailed risk assessment, step-by-step kubectl commands, and prevention tips*

Click **Get AI Remediation** on any finding for:

### Risk Assessment
Detailed explanation of the security risk and potential impact.

### Step-by-Step Fix
Actionable commands to remediate:

```yaml
# Example: Fix privileged container
spec:
  containers:
  - name: app
    securityContext:
      privileged: false
      runAsNonRoot: true
      readOnlyRootFilesystem: true
```

### Best Practices
Prevention tips and security hardening recommendations.

## RBAC Security

### Service Account Analysis
- Identifies high-risk service accounts
- Shows bound roles and permissions
- Detects cluster-admin usage

### Permission Audit
- Wildcard permissions (`*`)
- Cross-namespace access
- Secrets access
- Pod exec permissions

## Network Policies

### Coverage Metrics
- **Namespaces Protected** - % with network policies
- **Pods Covered** - % of pods with policies

### Recommendations
- Identify unprotected namespaces
- Suggest default deny policies
- Ingress/Egress rule templates

## Exporting Reports

Export security findings:

- **PDF Report** - Executive summary
- **CSV Export** - Detailed findings
- **JSON** - API format for integration
