# Skill: deploy-to-aws

Build and deploy HolmesGPT to the PDI AWS environment (`pdi-platform-dev`).

## Deployment Overview

```
infra/Dockerfile.frontend  →  ECR (holmesgpt:latest)
infra/helm.tf              →  EKS (holmesgpt-dev, us-east-1)
URL: https://holmesgpt.dev.platform.pditechnologies.com
Auth: admin / HolmesGPT@Dev2026!
```

The deployment uses a **custom Docker image** (`infra/Dockerfile.frontend`) that bundles:
- The React frontend (built from `infra/frontend/`)
- The Holmes Python backend (`server.py`)
- Auth middleware (`infra/frontend/server_frontend.py`)

---

## Step 1: Prerequisites

```bash
# Verify AWS profile is configured
aws sts get-caller-identity --profile pdi-platform-dev

# Verify Docker is running
docker info

# Verify kubectl access
aws eks update-kubeconfig --name holmesgpt-dev --profile pdi-platform-dev --region us-east-1
kubectl get nodes
```

---

## Step 2: Build the Docker Image

The frontend Dockerfile is at `infra/Dockerfile.frontend` (not the root `Dockerfile`).

```bash
# Get ECR registry URL
ECR_REGISTRY="717423812395.dkr.ecr.us-east-1.amazonaws.com"
ECR_REPO="holmesgpt"
IMAGE_TAG="latest"  # or use git SHA: $(git rev-parse --short HEAD)

# Authenticate Docker to ECR
aws ecr get-login-password --region us-east-1 --profile pdi-platform-dev \
  | docker login --username AWS --password-stdin $ECR_REGISTRY

# Build the image (run from repo root)
docker build \
  -f infra/Dockerfile.frontend \
  -t $ECR_REGISTRY/$ECR_REPO:$IMAGE_TAG \
  .

# Push to ECR
docker push $ECR_REGISTRY/$ECR_REPO:$IMAGE_TAG
```

For multi-architecture builds (ARM64 + AMD64):

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f infra/Dockerfile.frontend \
  -t $ECR_REGISTRY/$ECR_REPO:$IMAGE_TAG \
  --push \
  .
```

---

## Step 3: Deploy with Terraform

```bash
cd infra

# Required: set sensitive vars via environment
export TF_VAR_anthropic_api_key="your-anthropic-api-key"
export TF_VAR_mcp_ado_api_key="your-ado-api-key"
export TF_VAR_mcp_atlassian_api_key="your-atlassian-api-key"
export TF_VAR_mcp_salesforce_api_key="your-salesforce-api-key"

# Plan first
terraform plan -var-file=envs/dev.tfvars

# Apply
terraform apply -var-file=envs/dev.tfvars
```

If only the application config changed (not infrastructure), you can target just the Helm release:

```bash
terraform apply -var-file=envs/dev.tfvars -target=helm_release.holmes
```

---

## Step 4: Verify the Deployment

```bash
# Check pod status
kubectl get pods -n holmesgpt

# Wait for rollout
kubectl rollout status deployment/holmes-holmes -n holmesgpt --timeout=120s

# Check pod logs for startup errors
kubectl logs -n holmesgpt -l app.kubernetes.io/name=holmes --tail=30
```

Expected healthy output:
```
INFO     Application startup complete.
INFO     Uvicorn running on http://0.0.0.0:5050
```

### Verify the live URL

```bash
# Health check (no auth required)
curl -s https://holmesgpt.dev.platform.pditechnologies.com/healthz
# Expected: {"status":"healthy"}

curl -s https://holmesgpt.dev.platform.pditechnologies.com/readyz
# Expected: {"status":"ready","models":["anthropic/claude-sonnet-4-5-20250929"]}
```

### Check integrations are loaded

```bash
cat > /tmp/login.json << 'EOF'
{"username":"admin","password":"HolmesGPT@Dev2026!"}
EOF

curl -s -c /tmp/cookies.txt \
  -X POST https://holmesgpt.dev.platform.pditechnologies.com/auth/login \
  -H "Content-Type: application/json" -d @/tmp/login.json

curl -s -b /tmp/cookies.txt \
  https://holmesgpt.dev.platform.pditechnologies.com/api/integrations \
  | tr '{' '\n' | grep '"status"' | grep -v "disabled" | head -20
```

---

## Step 5: Force Pod Restart (Config-Only Changes)

If you updated the ConfigMap or Secrets without changing the image:

```bash
kubectl rollout restart deployment/holmes-holmes -n holmesgpt
kubectl rollout status deployment/holmes-holmes -n holmesgpt --timeout=120s
```

---

## Troubleshooting

### Pod stuck in `ImagePullBackOff`

```bash
kubectl describe pod -n holmesgpt -l app.kubernetes.io/name=holmes | grep -A10 "Events:"
```

Usually means ECR auth expired or wrong image tag. Re-run the ECR login and push steps.

### Pod `CrashLoopBackOff`

```bash
kubectl logs -n holmesgpt -l app.kubernetes.io/name=holmes --previous
```

Common causes:
- Missing required environment variable (check `ANTHROPIC_API_KEY`)
- Python import error in new code
- Port conflict (check if port 5050 is already in use)

### Terraform state lock

```bash
# If terraform apply hangs on "Acquiring state lock"
terraform force-unlock <LOCK_ID> -force
```

### Frontend not loading (404 on `/`)

The React build must be present at `/app/static/index.html` inside the container. Verify the build step ran:

```bash
kubectl exec -n holmesgpt deployment/holmes-holmes -- ls /app/static/
```

If empty, the `npm run build` step in `Dockerfile.frontend` failed. Check Docker build output.

---

## Key Files Reference

| File | Purpose |
|---|---|
| `infra/Dockerfile.frontend` | Multi-stage Docker build (React + Holmes + auth) |
| `infra/frontend/` | React SPA source code |
| `infra/frontend/server_frontend.py` | Auth middleware + static file serving |
| `infra/frontend/server_with_frontend.py` | Entrypoint that wraps `server.py` |
| `infra/helm.tf` | Helm release configuration (main app config) |
| `infra/envs/dev.tfvars` | Dev environment values |
| `infra/secrets.tf` | AWS Secrets Manager configuration |
| `infra/eks.tf` | EKS cluster definition |
| `infra/ecr.tf` | ECR repository |

---

## Environment Details

| Setting | Value |
|---|---|
| AWS Account | `pdi-platform-dev` (717423812395) |
| Region | `us-east-1` |
| EKS Cluster | `holmesgpt-dev` |
| Namespace | `holmesgpt` |
| ECR Repo | `717423812395.dkr.ecr.us-east-1.amazonaws.com/holmesgpt` |
| LLM Model | `anthropic/claude-sonnet-4-5-20250929` |
| API Gateway | `https://ai-gateway.platform.pditechnologies.com` |
| Node Type | `t3.medium` (1-2 nodes) |
