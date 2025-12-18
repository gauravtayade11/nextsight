FROM python:3.11-slim

WORKDIR /app

# Install system dependencies including kubectl, helm, and trivy
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    && curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" \
    && chmod +x kubectl \
    && mv kubectl /usr/local/bin/ \
    && curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash \
    && curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin v0.58.0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Make entrypoint executable
RUN chmod +x entrypoint.sh

# Create non-root user
RUN useradd -m -u 1000 nextsight && chown -R nextsight:nextsight /app
USER nextsight

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV K8S_IN_CLUSTER=true

EXPOSE 8000

ENTRYPOINT ["./entrypoint.sh"]
