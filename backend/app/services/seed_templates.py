"""Seed pipeline templates into the database."""

import asyncio
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_maker
from app.models.pipeline import PipelineTemplate

logger = logging.getLogger(__name__)

PIPELINE_TEMPLATES = [
    {
        "name": "Node.js CI/CD",
        "description": "Build, test, and deploy Node.js applications with npm or yarn",
        "category": "nodejs",
        "icon": "nodejs",
        "is_featured": True,
        "default_stages": ["Checkout", "Install Dependencies", "Lint", "Test", "Build", "Deploy"],
        "yaml_template": """name: Node.js CI/CD
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - name: Install Dependencies
        run: npm ci
      - name: Lint
        run: npm run lint
      - name: Test
        run: npm test -- --coverage
      - name: Build
        run: npm run build

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to Production
        run: echo "Deploying to production..."
""",
    },
    {
        "name": "Python CI/CD",
        "description": "Build and test Python applications with pytest and coverage",
        "category": "python",
        "icon": "python",
        "is_featured": True,
        "default_stages": ["Checkout", "Setup Python", "Install Dependencies", "Lint", "Test", "Deploy"],
        "yaml_template": """name: Python CI/CD
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ['3.10', '3.11', '3.12']
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}
      - name: Install Dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
          pip install pytest pytest-cov flake8
      - name: Lint with flake8
        run: flake8 . --count --select=E9,F63,F7,F82 --show-source
      - name: Test with pytest
        run: pytest --cov=./ --cov-report=xml
      - name: Upload Coverage
        uses: codecov/codecov-action@v4
""",
    },
    {
        "name": "Docker Build & Push",
        "description": "Build Docker images and push to container registry",
        "category": "docker",
        "icon": "docker",
        "is_featured": True,
        "default_stages": ["Checkout", "Setup Docker", "Build Image", "Push to Registry"],
        "yaml_template": """name: Docker Build & Push
on:
  push:
    branches: [main]
    tags: ['v*']

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Docker Buildx
        uses: docker/setup-buildx-action@v3
      - name: Login to Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Extract Metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
      - name: Build and Push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
""",
    },
    {
        "name": "Kubernetes Deployment",
        "description": "Deploy applications to Kubernetes cluster with kubectl",
        "category": "kubernetes",
        "icon": "kubernetes",
        "is_featured": True,
        "default_stages": ["Checkout", "Setup kubectl", "Configure Cluster", "Deploy", "Verify"],
        "yaml_template": """name: Kubernetes Deployment
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup kubectl
        uses: azure/setup-kubectl@v3
        with:
          version: 'v1.28.0'
      - name: Configure Kubernetes
        run: |
          echo "${{ secrets.KUBECONFIG }}" | base64 -d > kubeconfig
          export KUBECONFIG=kubeconfig
      - name: Deploy to Kubernetes
        run: |
          kubectl apply -f k8s/namespace.yaml
          kubectl apply -f k8s/deployment.yaml
          kubectl apply -f k8s/service.yaml
          kubectl apply -f k8s/ingress.yaml
      - name: Verify Deployment
        run: |
          kubectl rollout status deployment/app -n production
          kubectl get pods -n production
""",
    },
    {
        "name": "Terraform Infrastructure",
        "description": "Plan and apply Terraform infrastructure changes",
        "category": "terraform",
        "icon": "terraform",
        "is_featured": False,
        "default_stages": ["Checkout", "Setup Terraform", "Init", "Validate", "Plan", "Apply"],
        "yaml_template": """name: Terraform Infrastructure
on:
  push:
    branches: [main]
    paths: ['terraform/**']
  pull_request:
    branches: [main]
    paths: ['terraform/**']

jobs:
  terraform:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: terraform
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: 1.6.0
      - name: Terraform Init
        run: terraform init
      - name: Terraform Validate
        run: terraform validate
      - name: Terraform Plan
        run: terraform plan -out=tfplan
      - name: Terraform Apply
        if: github.ref == 'refs/heads/main'
        run: terraform apply -auto-approve tfplan
""",
    },
    {
        "name": "Security Scanning",
        "description": "Run security scans with Trivy, Snyk, and CodeQL",
        "category": "security",
        "icon": "security",
        "is_featured": False,
        "default_stages": ["Checkout", "Trivy Scan", "Dependency Check", "CodeQL Analysis"],
        "yaml_template": """name: Security Scanning
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 0'

jobs:
  trivy-scan:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'
      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'

  codeql:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Initialize CodeQL
        uses: github/codeql-action/init@v2
        with:
          languages: javascript, python
      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v2
""",
    },
    {
        "name": "React Application",
        "description": "Build and test React applications with Vite or CRA",
        "category": "nodejs",
        "icon": "react",
        "is_featured": False,
        "default_stages": ["Checkout", "Install", "Lint", "Test", "Build", "Deploy"],
        "yaml_template": """name: React CI/CD
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - name: Install Dependencies
        run: npm ci
      - name: Lint
        run: npm run lint
      - name: Run Tests
        run: npm test -- --coverage --watchAll=false
      - name: Build
        run: npm run build
      - name: Upload Build Artifact
        uses: actions/upload-artifact@v4
        with:
          name: build
          path: dist/

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Download Build
        uses: actions/download-artifact@v4
        with:
          name: build
          path: dist
      - name: Deploy to Vercel
        run: npx vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
""",
    },
    {
        "name": "Go Application",
        "description": "Build and test Go applications with goreleaser",
        "category": "go",
        "icon": "go",
        "is_featured": False,
        "default_stages": ["Checkout", "Setup Go", "Build", "Test", "Release"],
        "yaml_template": """name: Go CI/CD
on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Go
        uses: actions/setup-go@v5
        with:
          go-version: '1.21'
      - name: Build
        run: go build -v ./...
      - name: Test
        run: go test -v -race -coverprofile=coverage.out ./...
      - name: Upload Coverage
        uses: codecov/codecov-action@v4
        with:
          file: coverage.out

  release:
    needs: build
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/')
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Setup Go
        uses: actions/setup-go@v5
        with:
          go-version: '1.21'
      - name: Run GoReleaser
        uses: goreleaser/goreleaser-action@v5
        with:
          version: latest
          args: release --clean
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
""",
    },
]


async def seed_templates(db: AsyncSession) -> int:
    """Seed pipeline templates into the database."""
    from sqlalchemy import select

    # Check if templates already exist
    result = await db.execute(select(PipelineTemplate).limit(1))
    existing = result.scalar_one_or_none()

    if existing:
        logger.info("Templates already exist, skipping seed")
        return 0

    count = 0
    for template_data in PIPELINE_TEMPLATES:
        template = PipelineTemplate(
            name=template_data["name"],
            description=template_data["description"],
            category=template_data["category"],
            icon=template_data.get("icon"),
            yaml_template=template_data["yaml_template"],
            default_stages=template_data.get("default_stages", []),
            is_featured=template_data.get("is_featured", False),
            usage_count=0,
        )
        db.add(template)
        count += 1

    await db.flush()
    logger.info(f"Seeded {count} pipeline templates")
    return count


async def run_seed():
    """Run the seed function."""
    async with async_session_maker() as session:
        try:
            count = await seed_templates(session)
            await session.commit()
            logger.info(f"Successfully seeded {count} templates")
        except Exception as e:
            await session.rollback()
            logger.error(f"Error seeding templates: {e}")
            raise


if __name__ == "__main__":
    asyncio.run(run_seed())
