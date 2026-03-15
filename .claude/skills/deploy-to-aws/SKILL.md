# Skill: deploy-to-aws

Build and deploy HolmesGPT to the PDI AWS environment (`<AWS_PROFILE>`).

## Deployment Overview

```
infra/Dockerfile.frontend  →  ECR (holmesgpt:latest)
infra/helm.tf              →  EKS (holmesgpt-dev, us-east-1)
URL: https://<HOLMESGPT_APP_URL>
Auth: admin / <HOLMESGPT_ADMIN_PASSWORD>
```

The deployment uses a **custom Docker image** (`infra/Dockerfile.frontend`) that bundles:
- The React frontend (built from `infra/frontend/`)
- The Holmes Python backend (`server.py`)
- Auth middleware (`infra/frontend/server_frontend.py`)

---

## Step 1: Prerequisites

```bash
# Verify AWS profile is configured
aws sts get-caller-identity --profile <AWS_PROFILE>

# Verify Docker is running
docker info

# Verify kubectl access
aws eks update-kubeconfig --name holmesgpt-dev --profile <AWS_PROFILE> --region us-east-1
kubectl get nodes
```

---

## Step 2: Build the Docker Image

The frontend Dockerfile is at `infra/Dockerfile.frontend` (not the root `Dockerfile`).

```bash
# Get ECR registry URL
ECR_REGISTRY="<AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com"
ECR_REPO="holmesgpt"
IMAGE_TAG="latest"  # or use git SHA: $(git rev-parse --short HEAD)

# Authenticate Docker to ECR
aws ecr get-login-password --region us-east-1 --profile <AWS_PROFILE> \
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

## Step 3: Deploy with OpenTofu

Use `~/.local/bin/tofu` — **NOT** `terraform`. Extract MCP keys from the live k8s secret and the Anthropic key from Secrets Manager so all values stay in sync:

```bash
cd infra

# Retrieve Anthropic API key from Secrets Manager (PDI AI Gateway key, format: pdi_...)
ANTHROPIC_API_KEY=$(aws secretsmanager get-secret-value \
  --secret-id holmesgpt-dev/anthropic-api-key \
  --profile <AWS_PROFILE> --region us-east-1 \
  --query SecretString --output text \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['ANTHROPIC_API_KEY'])")

# Extract MCP keys from the live k8s secret (avoids silent empty-string drift)
ADO=$(kubectl get secret holmes-api-keys -n holmesgpt -o jsonpath='{.data.MCP_ADO_API_KEY}' | base64 -d)
ATLASSIAN=$(kubectl get secret holmes-api-keys -n holmesgpt -o jsonpath='{.data.MCP_ATLASSIAN_API_KEY}' | base64 -d)
SALESFORCE=$(kubectl get secret holmes-api-keys -n holmesgpt -o jsonpath='{.data.MCP_SALESFORCE_API_KEY}' | base64 -d)

# Plan first
~/.local/bin/tofu plan -var-file=envs/dev.tfvars \
  -var="anthropic_api_key=$ANTHROPIC_API_KEY" \
  -var="mcp_ado_api_key=$ADO" \
  -var="mcp_atlassian_api_key=$ATLASSIAN" \
  -var="mcp_salesforce_api_key=$SALESFORCE"

# Apply (creates/updates DynamoDB table, IAM policies, Helm release, etc.)
~/.local/bin/tofu apply -var-file=envs/dev.tfvars \
  -var="anthropic_api_key=$ANTHROPIC_API_KEY" \
  -var="mcp_ado_api_key=$ADO" \
  -var="mcp_atlassian_api_key=$ATLASSIAN" \
  -var="mcp_salesforce_api_key=$SALESFORCE" \
  -auto-approve
```

If only the application config changed (not infrastructure), you can target just the Helm release:

```bash
~/.local/bin/tofu apply -var-file=envs/dev.tfvars \
  -var="anthropic_api_key=$ANTHROPIC_API_KEY" \
  -var="mcp_ado_api_key=$ADO" \
  -var="mcp_atlassian_api_key=$ATLASSIAN" \
  -var="mcp_salesforce_api_key=$SALESFORCE" \
  -target=helm_release.holmes -auto-approve
```

**Note**: The DynamoDB table (`holmesgpt-dev-config`) is created by `infra/dynamodb.tf`. It stores projects and LLM instruction overrides. The table name is injected into the pod as `HOLMES_DYNAMODB_TABLE` env var.

**Important**: Always extract MCP keys from the live k8s secret rather than using environment variables. If empty strings are passed as `-var` values, the `helm.tf` conditional (`local.mcp_keys["MCP_ADO_API_KEY"] != ""`) evaluates to false and the entire `mcp_servers` block renders as `{}` — removing all MCP integrations from the pod configmap.

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
curl -s https://<HOLMESGPT_APP_URL>/healthz
# Expected: {"status":"healthy"}

curl -s https://<HOLMESGPT_APP_URL>/readyz
# Expected: {"status":"ready","models":["anthropic/claude-sonnet-4-5-20250929"]}
```

### Check integrations are loaded

```bash
cat > /tmp/login.json << 'EOF'
{"username":"admin","password":"<HOLMESGPT_ADMIN_PASSWORD>"}
EOF

curl -s -c /tmp/cookies.txt \
  -X POST https://<HOLMESGPT_APP_URL>/auth/login \
  -H "Content-Type: application/json" -d @/tmp/login.json

curl -s -b /tmp/cookies.txt \
  https://<HOLMESGPT_APP_URL>/api/integrations \
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

### OpenTofu state lock

```bash
# If tofu apply hangs on "Acquiring state lock"
~/.local/bin/tofu force-unlock <LOCK_ID> -force
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
| `infra/frontend/server_frontend.py` | Auth middleware + static file serving + projects/LLM-instructions API |
| `infra/frontend/server_with_frontend.py` | Entrypoint that wraps `server.py` |
| `infra/frontend/projects.py` | DynamoDB-backed ProjectsStore, LLMInstructionsStore, build_project_tool_executor |
| `infra/helm.tf` | Helm release configuration (main app config, MCP servers, AWS multi-account) |
| `infra/dynamodb.tf` | DynamoDB table `holmesgpt-dev-config` (projects + LLM overrides) |
| `infra/iam.tf` | IRSA policies: Secrets Manager + DynamoDB + wildcard project secrets |
| `infra/envs/dev.tfvars` | Dev environment values |
| `infra/secrets.tf` | AWS Secrets Manager configuration |
| `infra/eks.tf` | EKS cluster definition |
| `infra/ecr.tf` | ECR repository |

---

## Environment Details

| Setting | Value |
|---|---|
| AWS Account | `<AWS_PROFILE>` (<AWS_ACCOUNT_ID>) |
| Region | `us-east-1` |
| EKS Cluster | `holmesgpt-dev` |
| Namespace | `holmesgpt` |
| ECR Repo | `<AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/holmesgpt` |
| LLM Model | `anthropic/claude-sonnet-4-5-20250929` |
| API Gateway | `https://ai-gateway.platform.pditechnologies.com` |
| Node Type | `t3.medium` (1-2 nodes) |
