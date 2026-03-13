Build and deploy a new version of HolmesGPT to the PDI dev environment.

Follow the deploy-to-aws skill. Execute these steps in order:

1. Verify AWS access: `aws sts get-caller-identity --profile pdi-platform-dev`

2. Build and push the Docker image:
```bash
ECR_REGISTRY="717423812395.dkr.ecr.us-east-1.amazonaws.com"
aws ecr get-login-password --region us-east-1 --profile pdi-platform-dev \
  | docker login --username AWS --password-stdin $ECR_REGISTRY
docker build -f infra/Dockerfile.frontend -t $ECR_REGISTRY/holmesgpt:latest .
docker push $ECR_REGISTRY/holmesgpt:latest
```

3. Apply Terraform (prompt user for any missing secret vars):
```bash
cd infra
terraform apply -var-file=envs/dev.tfvars \
  -var="anthropic_api_key=$ANTHROPIC_API_KEY" \
  -var="mcp_ado_api_key=${MCP_ADO_API_KEY:-}" \
  -var="mcp_atlassian_api_key=${MCP_ATLASSIAN_API_KEY:-}" \
  -var="mcp_salesforce_api_key=${MCP_SALESFORCE_API_KEY:-}"
```

This also creates/updates the DynamoDB table `holmesgpt-dev-config` (defined in `infra/dynamodb.tf`) which stores Projects and LLM instruction overrides. The table name is injected into the pod as `HOLMES_DYNAMODB_TABLE`.

4. Verify the deployment:
```bash
aws eks update-kubeconfig --name holmesgpt-dev --profile pdi-platform-dev --region us-east-1
kubectl rollout status deployment/holmes-holmes -n holmesgpt --timeout=120s
curl -s https://holmesgpt.dev.platform.pditechnologies.com/healthz
curl -s https://holmesgpt.dev.platform.pditechnologies.com/readyz
```

5. Report the final status to the user including pod state and health check results.
