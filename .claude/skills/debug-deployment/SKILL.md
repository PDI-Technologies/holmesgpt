# Skill: debug-deployment

Diagnose and fix issues with the live HolmesGPT deployment at `<HOLMESGPT_APP_URL>`.

## Quick Health Check

```bash
# No auth required
curl -s https://<HOLMESGPT_APP_URL>/healthz
curl -s https://<HOLMESGPT_APP_URL>/readyz
```

Expected: `{"status":"healthy"}` and `{"status":"ready","models":["anthropic/claude-sonnet-4-5-20250929"]}`

If either returns an error, the pod is down — skip to "Pod Issues" below.

---

## Authenticate for API Access

The UI uses session cookie auth (not HTTP Basic Auth). Always use a file for the password to avoid shell escaping issues with special characters:

```bash
cat > /tmp/login.json << 'EOF'
{"username":"admin","password":"<HOLMESGPT_ADMIN_PASSWORD>"}
EOF

curl -s -c /tmp/cookies.txt \
  -X POST https://<HOLMESGPT_APP_URL>/auth/login \
  -H "Content-Type: application/json" \
  -d @/tmp/login.json
# Expected: {"ok":true}
```

For programmatic access, use Bearer token (password as token):

```bash
curl -s -H "Authorization: Bearer <HOLMESGPT_ADMIN_PASSWORD>" \
  https://<HOLMESGPT_APP_URL>/api/integrations
```

---

## Check Integration Status

```bash
curl -s -b /tmp/cookies.txt \
  https://<HOLMESGPT_APP_URL>/api/integrations \
  | tr '{' '\n' | grep '"status"' | grep -v "disabled" \
  | grep -oE '"name":"[^"]+"|"status":"[^"]+"|"error":"[^"]+"' \
  | paste - - -
```

### Interpreting Results

| Status | Meaning | Action |
|---|---|---|
| `enabled` | Working correctly | None |
| `disabled` | Not configured or explicitly off | Configure if needed |
| `failed` | Enabled but broken | See error message, fix config |

### Common `failed` Errors

**`Unable to auto-detect prometheus`**
```yaml
# Fix: add prometheus_url to toolset config in infra/helm.tf
toolsets:
  prometheus/metrics:
    enabled: true
    config:
      prometheus_url: http://prometheus-server.monitoring.svc:9090
```

**`Missing config for api_key, app_key`** (Datadog)
```yaml
# Fix: either add credentials or disable the toolset
toolsets:
  datadog/logs:
    enabled: false
```

**`Data access layer is disabled`** (Robusta)
This is expected — Robusta platform is not connected. Disable to suppress the error:
```yaml
toolsets:
  robusta:
    enabled: false
```

**MCP server `tool_count: 0`**
The MCP server connected but returned no tools. Check:
1. Is the API key valid? (`MCP_ADO_API_KEY`, `MCP_ATLASSIAN_API_KEY`, `MCP_SALESFORCE_API_KEY`)
2. Is the MCP server URL reachable from the pod?

---

## Projects API Debugging

### List all projects

```bash
curl -s -b /tmp/cookies.txt \
  https://<HOLMESGPT_APP_URL>/api/projects \
  | python3 -c "import sys,json; [print(p['name'], '-', len(p['instances']), 'instances') for p in json.load(sys.stdin)['projects']]"
```

### Check DynamoDB table directly

```bash
aws dynamodb scan \
  --table-name holmesgpt-dev-config \
  --profile <AWS_PROFILE> \
  --region us-east-1 \
  --filter-expression "begins_with(pk, :p)" \
  --expression-attribute-values '{":p":{"S":"PROJECT#"}}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{d[\"Count\"]} projects in DynamoDB')"
```

### Verify HOLMES_DYNAMODB_TABLE env var is set in pod

```bash
kubectl exec -n holmesgpt deployment/holmes-holmes -- \
  env | grep HOLMES_DYNAMODB_TABLE
# Expected: HOLMES_DYNAMODB_TABLE=holmesgpt-dev-config
```

### Test project-scoped chat

```bash
# Get a project ID first
PROJECT_ID=$(curl -s -b /tmp/cookies.txt \
  https://<HOLMESGPT_APP_URL>/api/projects \
  | python3 -c "import sys,json; p=json.load(sys.stdin)['projects']; print(p[0]['id'] if p else '')")

cat > /tmp/chat-project.json << EOF
{"ask": "What tools do you have available?", "project_id": "$PROJECT_ID"}
EOF

curl -s -b /tmp/cookies.txt \
  -X POST https://<HOLMESGPT_APP_URL>/api/chat \
  -H "Content-Type: application/json" \
  -d @/tmp/chat-project.json \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('analysis','')[:500])"
```

### Common project errors

**`Project not found`** — project_id in request doesn't exist in DynamoDB. Check the project was saved correctly.

**`Failed to build project executor`** — check pod logs for the specific toolset that failed:
```bash
kubectl logs -n holmesgpt -l app.kubernetes.io/name=holmes --tail=100 \
  | grep -i "project\|toolset\|secret"
```

**`Secret has no api_key field`** — MCP toolset secret in Secrets Manager must contain `{"api_key": "..."}`.

**AWS accounts not filtering** — verify `aws_accounts` field is set on the instance and the account names match exactly what's in `logistics_accounts` Terraform variable.

---

## Pod Issues

### Get kubeconfig

```bash
aws eks update-kubeconfig \
  --name holmesgpt-dev \
  --profile <AWS_PROFILE> \
  --region us-east-1
```

### Check pod status

```bash
kubectl get pods -n holmesgpt -o wide
kubectl describe pod -n holmesgpt -l app.kubernetes.io/name=holmes
```

### Read pod logs

```bash
# Current logs
kubectl logs -n holmesgpt -l app.kubernetes.io/name=holmes --tail=100

# Previous container (if pod restarted)
kubectl logs -n holmesgpt -l app.kubernetes.io/name=holmes --previous --tail=50

# Follow logs in real time
kubectl logs -n holmesgpt -l app.kubernetes.io/name=holmes -f
```

### Common Pod Errors

**`CrashLoopBackOff`**
```bash
kubectl logs -n holmesgpt -l app.kubernetes.io/name=holmes --previous
```
Look for:
- `ModuleNotFoundError` → Python dependency missing, rebuild image
- `KeyError` / `ValidationError` → Bad config in ConfigMap or Secret
- `ANTHROPIC_API_KEY not set` → Secret not mounted correctly

**`ImagePullBackOff`**
```bash
kubectl describe pod -n holmesgpt -l app.kubernetes.io/name=holmes | grep -A5 "Events:"
```
Fix: Re-authenticate Docker to ECR and re-push the image.

**`OOMKilled`**
The pod ran out of memory. Check resource limits:
```bash
kubectl describe pod -n holmesgpt -l app.kubernetes.io/name=holmes | grep -A5 "Limits:"
```
Fix: Increase memory limit in `infra/helm.tf` or reduce tool output size.

---

## Config Issues

### View current ConfigMap

```bash
kubectl get configmap custom-toolsets-configmap -n holmesgpt -o yaml
```

### View current Secrets (names only, not values)

```bash
kubectl get secret holmes-api-keys -n holmesgpt -o yaml | grep -v "data:"
kubectl get secret holmes-api-keys -n holmesgpt -o jsonpath='{.data}' | tr ',' '\n' | grep -oE '"[^"]+":'
```

### Verify a specific secret value is set

```bash
kubectl get secret holmes-api-keys -n holmesgpt \
  -o jsonpath='{.data.ANTHROPIC_API_KEY}' | base64 -d | wc -c
# Should be > 0 if set
```

### Hot-reload toolset config without redeployment

The `/api/integrations/{name}/config` endpoint supports live config updates:

```bash
curl -s -b /tmp/cookies.txt \
  -X PUT https://<HOLMESGPT_APP_URL>/api/integrations/prometheus%2Fmetrics/config \
  -H "Content-Type: application/json" \
  -d '{"config": {"prometheus_url": "http://prometheus:9090"}, "enabled": true}'
```

Note: Hot-reload changes are in-memory only and lost on pod restart. Persist changes via Terraform.

### Toggle an integration on/off

```bash
curl -s -b /tmp/cookies.txt \
  -X PUT https://<HOLMESGPT_APP_URL>/api/integrations/datadog%2Flogs/toggle \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

---

## MCP Server Debugging

### Check MCP server connectivity from the pod

```bash
kubectl exec -n holmesgpt deployment/holmes-holmes -- \
  wget -q -O- --header="x-api-key: $MCP_ADO_API_KEY" \
  https://mcp-api.platform.pditechnologies.com/v1/ado-sse/mcp 2>&1 | head -5
```

### Check MCP errors in logs

```bash
kubectl logs -n holmesgpt -l app.kubernetes.io/name=holmes --tail=200 \
  | grep -i "mcp\|session\|protocol\|reconnect"
```

Normal MCP log output (not errors):
```
INFO  Received session ID: abc123
INFO  Negotiated protocol version: 2025-11-25
INFO  GET stream disconnected, reconnecting in 1000ms...
```

The "reconnecting" messages are normal — MCP uses long-polling SSE streams that periodically reconnect.

---

## Network / DNS Issues

### Test DNS resolution from the pod

```bash
kubectl exec -n holmesgpt deployment/holmes-holmes -- \
  wget -q -O- http://kubernetes.default.svc.cluster.local/healthz 2>&1
```

### Test external connectivity

```bash
kubectl exec -n holmesgpt deployment/holmes-holmes -- \
  wget -q -O- https://ai-gateway.platform.pditechnologies.com/health 2>&1
```

---

## Force Restart

```bash
kubectl rollout restart deployment/holmes-holmes -n holmesgpt
kubectl rollout status deployment/holmes-holmes -n holmesgpt --timeout=120s
```

---

## Full Redeploy

If config changes aren't taking effect, do a full Terraform apply:

```bash
cd infra
terraform apply -var-file=envs/dev.tfvars \
  -var="anthropic_api_key=$ANTHROPIC_API_KEY" \
  -var="mcp_ado_api_key=$MCP_ADO_API_KEY" \
  -var="mcp_atlassian_api_key=$MCP_ATLASSIAN_API_KEY" \
  -var="mcp_salesforce_api_key=$MCP_SALESFORCE_API_KEY"
```
