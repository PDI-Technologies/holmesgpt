Build and deploy a new version of HolmesGPT to the PDI dev environment.

Follow the deploy-to-aws skill. Execute these steps in order:

1. Verify AWS access: `aws sts get-caller-identity --profile <AWS_PROFILE>`

2. Build and push the Docker image:
```bash
ECR_REGISTRY="<AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com"
aws ecr get-login-password --region us-east-1 --profile <AWS_PROFILE> \
  | docker login --username AWS --password-stdin $ECR_REGISTRY
docker build -f infra/Dockerfile.frontend -t $ECR_REGISTRY/holmesgpt:latest .
docker push $ECR_REGISTRY/holmesgpt:latest
```

3. Apply OpenTofu (use `~/.local/bin/tofu`, NOT `terraform`).

   **Key sourcing rules** — each key has one authoritative source:
   - `ANTHROPIC_API_KEY` → k8s secret (Secrets Manager copy may be stale)
   - `MCP_ATLASSIAN_API_KEY`, `MCP_ADO_API_KEY`, `MCP_SALESFORCE_API_KEY` → **Secrets Manager** (`holmesgpt-dev/mcp-api-keys`), NOT k8s secret
     - The k8s secret for these is populated BY tofu FROM Secrets Manager, so reading them from k8s creates a destructive loop that zeros them out on every deploy.

```bash
cd infra

# ANTHROPIC: read from k8s (authoritative — Secrets Manager copy may be empty)
ANTHROPIC_API_KEY=$(kubectl get secret holmes-api-keys -n holmesgpt -o jsonpath='{.data.ANTHROPIC_API_KEY}' | base64 -d)

# MCP KEYS: read from Secrets Manager (authoritative — k8s is populated FROM here)
# On Windows use PowerShell to parse JSON; on Linux/Mac use jq or python3
SM_MCP=$(aws secretsmanager get-secret-value \
  --secret-id "holmesgpt-dev/mcp-api-keys" \
  --region us-east-1 \
  --profile <AWS_PROFILE> \
  --query SecretString \
  --output text)

# Windows (Git Bash):
MCP_ADO=$(powershell -Command "\$sm = '$SM_MCP'; (\$sm | ConvertFrom-Json).MCP_ADO_API_KEY")
MCP_ATLASSIAN=$(powershell -Command "\$sm = '$SM_MCP'; (\$sm | ConvertFrom-Json).MCP_ATLASSIAN_API_KEY")
MCP_SALESFORCE=$(powershell -Command "\$sm = '$SM_MCP'; (\$sm | ConvertFrom-Json).MCP_SALESFORCE_API_KEY")

# Linux/Mac alternative:
# MCP_ADO=$(echo "$SM_MCP" | python3 -c "import sys,json; print(json.load(sys.stdin)['MCP_ADO_API_KEY'])")
# MCP_ATLASSIAN=$(echo "$SM_MCP" | python3 -c "import sys,json; print(json.load(sys.stdin)['MCP_ATLASSIAN_API_KEY'])")
# MCP_SALESFORCE=$(echo "$SM_MCP" | python3 -c "import sys,json; print(json.load(sys.stdin)['MCP_SALESFORCE_API_KEY'])")

~/.local/bin/tofu apply -var-file=envs/dev.tfvars \
  -var="anthropic_api_key=$ANTHROPIC_API_KEY" \
  -var="mcp_ado_api_key=$MCP_ADO" \
  -var="mcp_atlassian_api_key=$MCP_ATLASSIAN" \
  -var="mcp_salesforce_api_key=$MCP_SALESFORCE" \
  -auto-approve
```

This also creates/updates the DynamoDB table `holmesgpt-dev-config` (defined in `infra/dynamodb.tf`) which stores Projects and LLM instruction overrides. The table name is injected into the pod as `HOLMES_DYNAMODB_TABLE`.

4. Verify the deployment:
```bash
aws eks update-kubeconfig --name holmesgpt-dev --profile <AWS_PROFILE> --region us-east-1
kubectl rollout status deployment/holmes-holmes -n holmesgpt --timeout=120s
curl -s https://<HOLMESGPT_APP_URL>/healthz
curl -s https://<HOLMESGPT_APP_URL>/readyz
```

5. Report the final status to the user including pod state and health check results.
