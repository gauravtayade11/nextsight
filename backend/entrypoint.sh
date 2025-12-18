#!/bin/bash
set -e

# If K8S_HOST_OVERRIDE is set, modify the kubeconfig for kubectl
if [ -n "$K8S_HOST_OVERRIDE" ] && [ -n "$K8S_CONFIG_PATH" ] && [ -f "$K8S_CONFIG_PATH" ]; then
    # Create a modified kubeconfig in a writable location
    MODIFIED_CONFIG="/tmp/kubeconfig"

    # Copy and modify the kubeconfig, replacing localhost/127.0.0.1 with the override
    # Also add insecure-skip-tls-verify for Docker Desktop development
    sed -e "s|server: https://127.0.0.1:|server: https://${K8S_HOST_OVERRIDE}:|g" \
        -e "s|server: https://localhost:|server: https://${K8S_HOST_OVERRIDE}:|g" \
        -e "s|certificate-authority-data:|insecure-skip-tls-verify: true\n    certificate-authority-data:|g" \
        "$K8S_CONFIG_PATH" > "$MODIFIED_CONFIG"

    # Export the modified kubeconfig path for kubectl
    export KUBECONFIG="$MODIFIED_CONFIG"
    export K8S_CONFIG_PATH="$MODIFIED_CONFIG"

    echo "Kubeconfig modified: localhost -> $K8S_HOST_OVERRIDE"
fi

# Start the application
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
