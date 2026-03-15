# Skill: add-mcp-server

Add a new MCP (Model Context Protocol) server integration to HolmesGPT.

## When to Use

Use this skill when connecting Holmes to an external service via MCP rather than building a built-in toolset. MCP is preferred when:
- The service already has an MCP server (e.g., PDI platform MCP API gateway)
- You want to avoid writing Python toolset code
- The integration is managed externally

For built-in Python toolsets, use the `add-toolset` skill instead.

---

## MCP Transport Modes

| Mode | Use When |
|---|---|
| `streamable-http` | Cloud service with HTTP MCP endpoint (PDI gateway pattern) |
| `sse` | Legacy SSE-based MCP endpoint |
| `stdio` | Local subprocess (npx, python, uv) |

The PDI platform MCP API gateway (`mcp-api.platform.pditechnologies.com`) uses `streamable-http`.

---

## Step 1: Add to Holmes Config

### In `~/.holmes/config.yaml` (local development)

```yaml
mcp_servers:
  my-service:
    description: "MyService - brief description of what it provides"
    config:
      mode: streamable-http
      url: https://mcp-api.platform.pditechnologies.com/v1/myservice-sse/mcp
      headers:
        x-api-key: "your-api-key-here"
      icon_url: https://cdn.simpleicons.org/myservice/HEX_COLOR
    llm_instructions: |
      Use this toolset to query MyService data.
      Prefer specific queries over broad searches.
      When looking up records, use the ID if available.
```

### In Helm values / Terraform (production deployment)

The PDI deployment uses a ConfigMap (`custom-toolsets-configmap`) rendered by Terraform. Update `infra/helm.tf`:

```hcl
# In the custom_toolset.yaml template string:
mcp_servers:
  my-service:
    config:
      headers:
        x-api-key: '{{ env.MCP_MYSERVICE_API_KEY }}'
      icon_url: https://cdn.simpleicons.org/myservice/HEX_COLOR
      mode: streamable-http
      url: https://mcp-api.platform.pditechnologies.com/v1/myservice-sse/mcp
    description: MyService - description
    llm_instructions: |
      Use this toolset to query MyService...
```

Add the secret to `infra/helm.tf` environment variables:

```hcl
# In the set_sensitive block:
{
  name  = "MCP_MYSERVICE_API_KEY"
  value = var.mcp_myservice_api_key
}
```

Add the variable to `infra/variables.tf`:

```hcl
variable "mcp_myservice_api_key" {
  description = "API key for MyService MCP server"
  type        = string
  sensitive   = true
  default     = ""
}
```

Add to `infra/envs/dev.tfvars`:

```hcl
mcp_myservice_api_key = ""  # Set via TF_VAR_mcp_myservice_api_key or -var flag
```

Add to `infra/secrets.tf` (Secrets Manager):

```hcl
# In the holmes_secrets map:
MCP_MYSERVICE_API_KEY = var.mcp_myservice_api_key
```

---

## Step 2: STDIO Mode (Local MCP Servers)

For local MCP servers running as subprocesses:

```yaml
mcp_servers:
  local-tool:
    description: "Local MCP tool via npx"
    config:
      mode: stdio
      command: npx
      args:
        - "-y"
        - "@example/mcp-server@latest"
      env:
        API_KEY: "{{ env.MY_API_KEY }}"
      timeout_seconds: 30
      icon_url: https://example.com/logo.png
```

For Python-based MCP servers:

```yaml
mcp_servers:
  python-tool:
    config:
      mode: stdio
      command: uv
      args:
        - run
        - --with
        - mcp-server-package
        - mcp-server-package
      env:
        SERVICE_URL: "{{ env.SERVICE_URL }}"
```

---

## Step 3: Header Templates

Headers support Jinja2 templates for dynamic values:

```yaml
config:
  headers:
    # Static header
    Content-Type: application/json
    # From environment variable
    x-api-key: "{{ env.MY_API_KEY }}"
    # From request context (pass-through from browser)
    X-User-Token: "{{ request_context.headers['X-User-Token'] }}"
```

**Important**: The `HOLMES_PASSTHROUGH_BLOCKED_HEADERS` env var controls which headers are blocked from pass-through (default: `authorization,cookie,set-cookie`). Custom headers like `X-Api-Key` pass through by default.

---

## Step 4: Write LLM Instructions

Good `llm_instructions` dramatically improve tool usage quality. Keep under 50 lines:

```yaml
llm_instructions: |
  Use this toolset to query Azure DevOps work items, pull requests,
  repositories, pipelines, and boards.

  Key guidance:
  - Prefer WIQL queries for work item searches (more powerful than text search)
  - When looking up a PR, use the PR number if mentioned by the user
  - For pipeline failures, check the build logs tool first
  - Work item IDs are integers (e.g., 12345), not strings
  - Use list_projects first if you don't know the project name
```

---

## Step 5: Test the MCP Connection

### Check tool count and status via API

```bash
# Login
cat > /tmp/login.json << 'EOF'
{"username":"admin","password":"<HOLMESGPT_ADMIN_PASSWORD>"}
EOF
curl -s -c /tmp/cookies.txt -X POST \
  https://<HOLMESGPT_APP_URL>/auth/login \
  -H "Content-Type: application/json" -d @/tmp/login.json

# Check integration status
curl -s -b /tmp/cookies.txt \
  https://<HOLMESGPT_APP_URL>/api/integrations \
  | tr '{' '\n' | grep '"name":"my-service"'
```

Expected output shows `"status":"enabled"` and a non-zero `tool_count`.

### Test via Holmes CLI

```bash
holmes ask "List available tools from my-service" \
  --config ~/.holmes/config.yaml
```

### Check pod logs for MCP errors

```bash
kubectl logs -n holmesgpt -l app.kubernetes.io/name=holmes --tail=50 \
  | grep -i "mcp\|my-service\|error"
```

Common MCP errors:
- `Connection refused` → URL is wrong or service is down
- `401 Unauthorized` → API key is missing or invalid
- `tool_count: 0` → MCP server connected but returned no tools (check server logs)
- `status: failed` → Check the `error` field in `/api/integrations` response

---

## Step 6: Deploy to Production

After testing locally, deploy to the PDI dev environment:

```bash
cd infra
terraform apply -var-file=envs/dev.tfvars \
  -var="mcp_myservice_api_key=$MCP_MYSERVICE_API_KEY" \
  -var="anthropic_api_key=$ANTHROPIC_API_KEY"
```

Verify the new MCP server appears in the deployment:

```bash
kubectl get configmap custom-toolsets-configmap -n holmesgpt -o yaml \
  | grep -A5 "my-service"
```

---

## Step 7: Update Documentation

1. **`README.md`** — Add to the Data Sources table
2. **`docs/walkthrough/why-holmesgpt.md`** — Add to integration list
3. **`docs/data-sources/builtin-toolsets/index.md`** — Add grid card
4. **`docs/data-sources/builtin-toolsets/{name}.md`** — Create docs page

### Docs Page Template for MCP Integration

```markdown
# MyService (MCP)

Brief description.

## Configuration

Add to `~/.holmes/config.yaml`:

```yaml
mcp_servers:
  my-service:
    description: "MyService integration"
    config:
      mode: streamable-http
      url: https://your-mcp-server/mcp
      headers:
        x-api-key: "your-api-key"
```

## Common Use Cases

```
List open tickets assigned to my team
```

```
Show me the details of ticket TICKET-123
```
```

---

## Current PDI MCP Servers (Reference)

The following MCP servers are already configured in the PDI deployment:

| Name | URL Pattern | Tools |
|---|---|---|
| `ado` | `/v1/ado-sse/mcp` | 72 (Azure DevOps) |
| `atlassian` | `/v1/atlassian-sse/mcp` | 44 (Jira + Confluence) |
| `salesforce` | `/v1/salesforce-sse/mcp` | 19 (CRM data) |

All use `streamable-http` mode with `x-api-key` header from `MCP_*_API_KEY` env vars.

---

## Per-Project API Key Isolation

MCP servers support per-project API keys via Secrets Manager. When a project has a `secret_arn` set on an MCP instance, `build_project_tool_executor()` in `infra/frontend/projects.py` fetches the secret and instantiates a fresh `RemoteMCPToolset` with that API key — completely isolated from the global MCP toolset.

To make a new MCP server project-scopeable:

1. Add the type name to `_MCP_TOOLSET_TYPES` in `infra/frontend/projects.py`
2. Add entries to `_MCP_DEFAULT_URLS`, `_MCP_ICONS`, `_MCP_DESCRIPTIONS`, `_MCP_LLM_INSTRUCTIONS`
3. Add to `MCP_TYPES` set in `infra/frontend/src/components/Projects.tsx`

Secret format for per-project MCP credentials:
```json
{"api_key": "your-per-project-api-key"}
```

Secret naming convention: `holmesgpt-dev/project-<instance-name>`

See the `manage-projects` skill for full details.

---

## HTTP Connector Pattern (Alternative to MCP)

For services that expose a REST API but not an MCP server, use the `http` toolset type. This lets Holmes call arbitrary HTTP endpoints as tools without writing Python code.

```yaml
# ~/.holmes/config.yaml
custom_toolsets:
  myservice/api:
    type: http
    description: "MyService REST API"
    base_url: https://api.myservice.com
    headers:
      Authorization: "Bearer {{ env.MYSERVICE_API_KEY }}"
    tools:
      - name: myservice_list_incidents
        description: "List recent incidents from MyService"
        method: GET
        path: /v1/incidents
        params:
          status: "{{ status | default('open') }}"
          limit: "{{ limit | default(20) }}"
      - name: myservice_get_incident
        description: "Get details of a specific incident"
        method: GET
        path: /v1/incidents/{{ incident_id }}
```

Use HTTP connectors when:
- The service has a well-documented REST API
- You don't need complex response transformation
- You want to avoid writing Python code

Use built-in Python toolsets when:
- You need complex response parsing or filtering
- You need a health check (`prerequisites_callable`)
- The API requires OAuth or complex auth flows
