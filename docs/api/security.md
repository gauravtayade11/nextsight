# Security API

API endpoints for security scanning and analysis.

## Security Score

### Get Security Score

```http
GET /api/v1/security/score
```

**Response:**
```json
{
  "score": 78,
  "grade": "C",
  "findings_count": {
    "critical": 2,
    "high": 5,
    "medium": 12,
    "low": 8
  }
}
```

## Findings

### List Security Findings

```http
GET /api/v1/security/findings
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| severity | string | Filter by severity |
| namespace | string | Filter by namespace |
| category | string | Filter by category |

**Response:**
```json
[
  {
    "id": "finding-123",
    "title": "Privileged Container",
    "severity": "high",
    "category": "workload",
    "namespace": "default",
    "resource": "pod/nginx-abc123",
    "description": "Container running in privileged mode",
    "remediation": "Set securityContext.privileged to false"
  }
]
```

### Get Finding Details

```http
GET /api/v1/security/findings/{id}
```

## Scanning

### Trigger Security Scan

```http
POST /api/v1/security/scan
```

**Request Body:**
```json
{
  "namespace": "default",
  "scan_type": "full"
}
```

**Response:**
```json
{
  "scan_id": "scan-456",
  "status": "running",
  "started_at": "2024-01-15T10:30:00Z"
}
```

### Get Scan Status

```http
GET /api/v1/security/scan/{scan_id}
```

## Vulnerabilities

### List Vulnerabilities

```http
GET /api/v1/security/vulnerabilities
```

**Response:**
```json
[
  {
    "cve_id": "CVE-2024-1234",
    "package": "openssl",
    "version": "1.1.1",
    "fixed_in": "1.1.2",
    "severity": "critical",
    "cvss": 9.8,
    "image": "nginx:1.25"
  }
]
```

### Scan Image

```http
POST /api/v1/security/scan/image
```

**Request Body:**
```json
{
  "image": "nginx:1.25"
}
```

## RBAC Analysis

### Get RBAC Analysis

```http
GET /api/v1/security/rbac
```

**Response:**
```json
{
  "service_accounts": [
    {
      "name": "default",
      "namespace": "default",
      "risk_level": "low",
      "roles": ["view"]
    }
  ],
  "high_risk_bindings": [
    {
      "name": "admin-binding",
      "subject": "user:admin",
      "role": "cluster-admin"
    }
  ]
}
```

## Network Policies

### Get Network Policy Coverage

```http
GET /api/v1/security/network-policies
```

**Response:**
```json
{
  "coverage": {
    "namespaces_with_policies": 5,
    "total_namespaces": 10,
    "percentage": 50
  },
  "unprotected_namespaces": ["default", "dev"]
}
```

## AI Remediation

### Get AI Remediation

```http
POST /api/v1/security/remediate
```

**Request Body:**
```json
{
  "finding_id": "finding-123"
}
```

**Response:**
```json
{
  "risk_assessment": "This finding poses a significant risk...",
  "remediation_steps": [
    "1. Edit the deployment YAML",
    "2. Set privileged: false",
    "3. Apply the changes"
  ],
  "yaml_example": "securityContext:\n  privileged: false",
  "best_practices": ["Use least privilege principle"]
}
```
