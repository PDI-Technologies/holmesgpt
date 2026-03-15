# Skill: manage-projects

Create, update, and manage HolmesGPT Projects — named groups of integration instances that scope AI triage to a specific team or environment.

## What Projects Do

A project defines which integrations Holmes uses for a given conversation. When a user selects "Logistics Cloud" in the sidebar, every chat message includes `project_id` and the backend builds a `ToolExecutor` containing only that project's configured toolsets.

```
User selects "Logistics Cloud" project
  → Chat sends project_id in request body
  → server.py calls build_project_tool_executor(project, config, dal)
  → Holmes uses only those tools for this conversation
```

Projects survive pod restarts — they are stored in DynamoDB (`holmesgpt-dev-config` table).

---

## Architecture

### Data model

```python
class ToolsetInstance(BaseModel):
    type: str           # 'grafana/dashboards' | 'aws_api' | 'ado' | 'atlassian' | 'salesforce' | ...
    name: str           # unique instance name: 'grafana-logistics', 'aws_api'
    secret_arn: str | None   # Secrets Manager ARN for per-project credentials
    mcp_url: str | None      # MCP server URL override (None = use global)
    aws_accounts: list[str] | None  # restrict AWS to these account profile names

class Project(BaseModel):
    id: str             # auto-generated hex UUID
    name: str
    description: str
    instances: list[ToolsetInstance]
    created_at: str     # ISO timestamp
```

### DynamoDB schema (single-table)

| pk | sk | data |
|----|----|------|
| `PROJECT#<id>` | `META` | JSON-serialised Project |
| `LLM_OVERRIDE` | `<toolset_name>` | LLM instructions string |

### Tool executor scoping logic (`infra/frontend/projects.py`)

| Instance type | Condition | Behaviour |
|---|---|---|
| `ado` / `atlassian` / `salesforce` | `secret_arn` set | Fetches `{"api_key": "..."}` from Secrets Manager, instantiates fresh `RemoteMCPToolset` |
| `ado` / `atlassian` / `salesforce` | no `secret_arn` | Reuses global MCP toolset |
| `aws_api` | `aws_accounts` set | Copies global AWS toolset, overrides `llm_instructions` to restrict `--profile` values |
| `aws_api` | no `aws_accounts` | Reuses global AWS toolset (all accounts) |
| `grafana/*` / `prometheus/metrics` | `secret_arn` set | Fetches creds from Secrets Manager, instantiates Python toolset |
| Any | no overrides, name in global | Reuses global toolset directly |

---

## API Endpoints

All endpoints require session cookie auth (login first).

```
GET    /api/projects              → list all projects
POST   /api/projects              → create project
GET    /api/projects/{id}         → get single project
PUT    /api/projects/{id}         → update project
DELETE /api/projects/{id}         → delete project
```

### Create a project via API

```bash
cat > /tmp/login.json << 'EOF'
{"username":"admin","password":"<HOLMESGPT_ADMIN_PASSWORD>"}
EOF
curl -s -c /tmp/cookies.txt -X POST \
  https://<HOLMESGPT_APP_URL>/auth/login \
  -H "Content-Type: application/json" -d @/tmp/login.json

cat > /tmp/new-project.json << 'EOF'
{
  "name": "Logistics Cloud",
  "description": "Logistics team - prod and dev environments",
  "instances": [
    {
      "type": "grafana/dashboards",
      "name": "grafana-logistics",
      "secret_arn": "arn:aws:secretsmanager:us-east-1:<AWS_ACCOUNT_ID>:secret:holmesgpt-dev/project-grafana-logistics"
    },
    {
      "type": "aws_api",
      "name": "aws_api",
      "secret_arn": null,
      "aws_accounts": ["logistics-prod", "logistics-dev"]
    },
    {
      "type": "ado",
      "name": "ado",
      "secret_arn": "arn:aws:secretsmanager:us-east-1:<AWS_ACCOUNT_ID>:secret:holmesgpt-dev/project-ado-logistics"
    }
  ]
}
EOF

curl -s -b /tmp/cookies.txt \
  -X POST https://<HOLMESGPT_APP_URL>/api/projects \
  -H "Content-Type: application/json" \
  -d @/tmp/new-project.json | python3 -m json.tool
```

---

## Creating Per-Project Secrets in AWS Secrets Manager

### Naming convention

```
holmesgpt-dev/project-<instance-name>
```

Examples:
- `holmesgpt-dev/project-grafana-logistics`
- `holmesgpt-dev/project-ado-logistics`

### Secret formats by toolset type

**Grafana** (Python toolset):
```json
{
  "api_url": "https://grafana-logistics.pdisoftware.com",
  "api_key": "glsa_xxxx"
}
```

**Prometheus** (Python toolset):
```json
{
  "prometheus_url": "http://prometheus-logistics.svc:9090"
}
```

**ADO / Atlassian / Salesforce** (MCP toolset):
```json
{
  "api_key": "your-per-project-api-key"
}
```

### Create a secret via CLI

```bash
aws secretsmanager create-secret \
  --name "holmesgpt-dev/project-grafana-logistics" \
  --secret-string '{"api_url":"https://grafana-logistics.pdisoftware.com","api_key":"glsa_xxxx"}' \
  --profile <AWS_PROFILE> \
  --region us-east-1
```

The Holmes IRSA role already has permission to read any secret matching `holmesgpt-dev/project-*` (configured in `infra/iam.tf`).

---

## Adding a New Toolset Type to Projects

If you add a new Python toolset (e.g. `datadog/metrics`) and want it to be project-scopeable:

1. **Add to `PYTHON_TOOLSET_FACTORIES`** in `holmes/plugins/toolsets/__init__.py`:
   ```python
   PYTHON_TOOLSET_FACTORIES["datadog/metrics"] = DatadogMetricsToolset
   ```

2. **Add optional `name` param** to the toolset class `__init__`:
   ```python
   def __init__(self, name: str = "datadog/metrics"):
       super().__init__(name=name, ...)
   ```

3. **Add to `TOOLSET_TYPES`** in `infra/frontend/src/components/Projects.tsx`:
   ```typescript
   const TOOLSET_TYPES = [
     ...
     'datadog/metrics',
   ]
   ```

If you add a new MCP server type:

1. **Add to `_MCP_TOOLSET_TYPES`** in `infra/frontend/projects.py`:
   ```python
   _MCP_TOOLSET_TYPES = {"ado", "atlassian", "salesforce", "my-new-mcp"}
   ```

2. **Add URL, icon, description, LLM instructions** to the `_MCP_DEFAULT_URLS`, `_MCP_ICONS`, `_MCP_DESCRIPTIONS`, `_MCP_LLM_INSTRUCTIONS` dicts.

3. **Add to `MCP_TYPES`** in `Projects.tsx`:
   ```typescript
   const MCP_TYPES = new Set(['ado', 'atlassian', 'salesforce', 'my-new-mcp'])
   ```

---

## Multi-Instance Python Toolsets

The `basename:suffix` pattern allows multiple instances of the same Python toolset type in a single global config (e.g. two Grafana instances):

```yaml
# infra/helm.tf toolsets config
toolsets:
  grafana/dashboards:logistics:
    enabled: true
    config:
      api_url: https://grafana-logistics.pdisoftware.com
      api_key: "{{ env.GRAFANA_LOGISTICS_API_KEY }}"
  grafana/dashboards:platform:
    enabled: true
    config:
      api_url: https://grafana-platform.pdisoftware.com
      api_key: "{{ env.GRAFANA_PLATFORM_API_KEY }}"
```

The `toolset_manager.py` detects the `:` separator and routes these through `PYTHON_TOOLSET_FACTORIES` with the full name as the instance name. Projects can then reference them by their full name (`grafana/dashboards:logistics`).

---

## Troubleshooting

See the `debug-deployment` skill → **Projects API Debugging** section for:
- Listing projects via API
- Checking DynamoDB directly
- Verifying `HOLMES_DYNAMODB_TABLE` env var
- Testing project-scoped chat
- Common error messages and fixes
