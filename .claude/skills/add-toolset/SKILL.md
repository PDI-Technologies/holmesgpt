# Skill: add-toolset

Add a new built-in toolset to HolmesGPT — from implementation through tests and docs.

## When to Use

Use this skill when adding a new observability platform, IT service, or data source as a built-in toolset (not an MCP server). For MCP-based integrations, use the `add-mcp-server` skill instead.

**Built-in toolset** = Python class + optional YAML, lives in `holmes/plugins/toolsets/`.

---

## Step 1: Decide: Python or YAML Toolset?

**Python toolset** (preferred for new integrations):
- Needs authentication / API calls
- Has complex config validation
- Needs a health check
- Reference: `holmes/plugins/toolsets/servicenow_tables/servicenow_tables.py`

**YAML toolset** (for simple bash/kubectl wrappers):
- Just runs shell commands
- No auth needed
- Reference: `holmes/plugins/toolsets/kubernetes.yaml`

Most new integrations are Python toolsets. The rest of this guide covers Python.

---

## Step 2: Create the Directory and Files

```
holmes/plugins/toolsets/{name}/
├── __init__.py          # Empty or re-exports
└── {name}.py            # Main toolset implementation
```

For simple toolsets, a single file works:
```
holmes/plugins/toolsets/{name}.py
```

---

## Step 3: Implement the Toolset Class

Follow the **thin API wrapper pattern** exactly. Reference: `servicenow_tables/servicenow_tables.py`.

```python
import logging
import requests
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, ConfigDict, SecretStr, model_validator

from holmes.core.tools import Tool, ToolParameter, Toolset, ToolsetTag

logger = logging.getLogger(__name__)


class MyServiceConfig(BaseModel):
    """Configuration for MyService toolset."""
    model_config = ConfigDict(extra="allow")  # Required for backwards compat

    api_url: str
    api_key: SecretStr
    timeout_seconds: int = 30
    verify_ssl: bool = True

    @model_validator(mode="after")
    def handle_deprecated_fields(self):
        """Map any renamed config fields for backwards compatibility."""
        extra = self.model_extra or {}
        deprecated = []
        # Example: if "url" in extra: self.api_url = extra["url"]; deprecated.append("url -> api_url")
        if deprecated:
            logging.warning(f"Deprecated MyService config fields: {', '.join(deprecated)}")
        return self


class MyServiceToolset(Toolset):
    """Toolset for querying MyService."""

    def __init__(self):
        super().__init__(
            name="myservice/core",
            description="Query MyService for incidents, metrics, and configuration",
            icon_url="https://example.com/logo.png",
            docs_url="https://holmesgpt.dev/data-sources/builtin-toolsets/myservice/",
            tags=[ToolsetTag.CORE],
        )
        self.config: Optional[MyServiceConfig] = None
        self._session: Optional[requests.Session] = None

    def prerequisites_callable(self, config: dict) -> Tuple[bool, str]:
        """Validate config and verify connectivity."""
        try:
            self.config = MyServiceConfig(**config)
        except Exception as e:
            return False, f"Invalid configuration: {e}"

        try:
            session = self._get_session()
            resp = session.get(
                f"{self.config.api_url}/api/health",
                timeout=self.config.timeout_seconds,
            )
            resp.raise_for_status()
            return True, "Connected to MyService successfully"
        except requests.exceptions.ConnectionError as e:
            return False, f"Cannot connect to MyService at {self.config.api_url}: {e}"
        except requests.exceptions.HTTPError as e:
            return False, f"MyService health check failed ({e.response.status_code}): {e.response.text}"
        except requests.exceptions.Timeout:
            return False, f"MyService health check timed out after {self.config.timeout_seconds}s"
        except Exception as e:
            return False, f"MyService health check error: {e}"

    def _get_session(self) -> requests.Session:
        if self._session is None:
            self._session = requests.Session()
            self._session.headers.update({
                "Authorization": f"Bearer {self.config.api_key.get_secret_value()}",
                "Content-Type": "application/json",
            })
            self._session.verify = self.config.verify_ssl
        return self._session

    def get_tools(self) -> List[Tool]:
        return [
            Tool(
                name="myservice_list_incidents",
                description="List recent incidents from MyService",
                parameters=[
                    ToolParameter(name="status", type="string", description="Filter by status: open, resolved, all", required=False),
                    ToolParameter(name="limit", type="number", description="Maximum results to return (default: 50)", required=False),
                ],
                callable=self._list_incidents,
            ),
            Tool(
                name="myservice_get_incident",
                description="Get details of a specific incident by ID",
                parameters=[
                    ToolParameter(name="incident_id", type="string", description="The incident ID", required=True),
                ],
                callable=self._get_incident,
            ),
        ]

    def _list_incidents(self, status: str = "open", limit: int = 50) -> str:
        """Always return detailed error context for LLM self-correction."""
        url = f"{self.config.api_url}/api/v1/incidents"
        params = {"status": status, "limit": limit}
        try:
            resp = self._get_session().get(url, params=params, timeout=self.config.timeout_seconds)
            resp.raise_for_status()
            data = resp.json()
            incidents = data.get("incidents", [])
            if not incidents:
                return f"No incidents found with status='{status}' (queried {url} with params {params})"
            return "\n".join(
                f"- [{i['id']}] {i['title']} (status={i['status']}, severity={i.get('severity','unknown')})"
                for i in incidents
            )
        except requests.exceptions.HTTPError as e:
            return f"Error querying {url} (params={params}): HTTP {e.response.status_code} - {e.response.text}"
        except Exception as e:
            return f"Error querying {url} (params={params}): {e}"

    def _get_incident(self, incident_id: str) -> str:
        url = f"{self.config.api_url}/api/v1/incidents/{incident_id}"
        try:
            resp = self._get_session().get(url, timeout=self.config.timeout_seconds)
            resp.raise_for_status()
            return resp.text
        except requests.exceptions.HTTPError as e:
            return f"Error fetching incident {incident_id} from {url}: HTTP {e.response.status_code} - {e.response.text}"
        except Exception as e:
            return f"Error fetching incident {incident_id} from {url}: {e}"
```

---

## Step 4: Register the Toolset

Add to `holmes/plugins/toolsets/__init__.py` in the `load_python_toolsets()` function:

```python
from holmes.plugins.toolsets.myservice.myservice import MyServiceToolset

# Inside load_python_toolsets():
toolsets.append(MyServiceToolset())
```

---

## Step 5: Critical Implementation Rules

### Server-Side Filtering is Mandatory

Never return unbounded collections. Always add filter/limit parameters:

```python
# BAD - returns everything, causes token overflow on large datasets
def _list_all_records(self) -> str:
    resp = session.get(f"{url}/records")
    return resp.text

# GOOD - server-side filtering with sensible defaults
def _list_records(self, filter: str = "", limit: int = 100) -> str:
    resp = session.get(f"{url}/records", params={"q": filter, "limit": limit})
```

When server-side filtering is impossible, use `JsonFilterMixin` from `holmes/plugins/toolsets/json_filter_mixin.py` to add `max_depth` and `jq` parameters.

### Error Messages Must Be LLM-Actionable

Every error return must include:
1. The exact URL queried
2. The parameters/filters used
3. The full API error (status code + body)
4. For empty results: what was searched and where

```python
# BAD
return "Error fetching data"

# GOOD
return f"Error querying {url} with params={params}: HTTP {status} - {body}"
```

### Use `requests`, Not Specialized Clients

```python
# BAD - specialized client hides errors, harder to debug
from opensearchpy import OpenSearch
client = OpenSearch(hosts=[url])

# GOOD - thin wrapper, full control over errors
import requests
resp = requests.get(f"{url}/_cat/indices", headers=auth_headers)
```

### Backwards Compatibility for Config Renames

When renaming a config field, use `extra="allow"` + `model_validator`:

```python
class MyConfig(BaseModel):
    model_config = ConfigDict(extra="allow")
    new_field: str = "default"

    @model_validator(mode="after")
    def handle_deprecated_fields(self):
        extra = self.model_extra or {}
        if "old_field" in extra:
            self.new_field = extra["old_field"]
            logging.warning("Deprecated config: old_field -> new_field")
        return self
```

Never add deprecated fields to the schema with `Optional[None]` — it pollutes `model_dump()`.

---

## Step 6: Write LLM Instructions

For toolsets that need guidance on when/how to use them, add instructions:

```python
def get_llm_instructions(self) -> str:
    return """
Use myservice_list_incidents to find recent incidents before investigating alerts.
Prefer filtering by status='open' unless the user asks about historical incidents.
When an incident ID is mentioned, always call myservice_get_incident for full details.
Keep instructions under 50 lines.
"""
```

For log-fetching toolsets that extend `BasePodLoggingToolset`, update `holmes/plugins/prompts/_fetch_logs.jinja2` instead.

---

## Step 7: Write Tests

### Integration Test (live, requires credentials)

Create `tests/plugins/test_myservice.py`:

```python
import os
import pytest
from holmes.plugins.toolsets.myservice.myservice import MyServiceToolset

@pytest.mark.skipif(not os.environ.get("MYSERVICE_API_URL"), reason="MYSERVICE_API_URL not set")
class TestMyServiceToolset:
    def setup_method(self):
        self.toolset = MyServiceToolset()
        ok, msg = self.toolset.prerequisites_callable({
            "api_url": os.environ["MYSERVICE_API_URL"],
            "api_key": os.environ["MYSERVICE_API_KEY"],
        })
        assert ok, f"Prerequisites failed: {msg}"

    def test_list_incidents(self):
        result = self.toolset._list_incidents(status="open", limit=5)
        assert "Error" not in result or "No incidents" in result

    def test_get_incident_invalid_id(self):
        result = self.toolset._get_incident("nonexistent-id-12345")
        assert "404" in result or "not found" in result.lower()
```

### LLM Eval Test

Use the `create-eval` skill to create an eval test that verifies Holmes can use the toolset to answer real questions.

---

## Step 8: Update Documentation

When adding a new toolset, update **all five** of these locations:

1. **`README.md`** — Add row to the Data Sources table
2. **`docs/walkthrough/why-holmesgpt.md`** — Add to categorized integration list
3. **`docs/data-sources/builtin-toolsets/index.md`** — Add grid card
4. **`docs/data-sources/builtin-toolsets/{name}.md`** — Create dedicated docs page
5. **`images/integration_logos/`** — Add logo image if available

Also add the toolset to `.nav.yml` in `docs/data-sources/builtin-toolsets/`.

### Docs Page Template

```markdown
# MyService

Brief description of what MyService is and what Holmes can do with it.

## Configuration

```yaml
custom_toolsets:
  myservice/core:
    enabled: true
    config:
      api_url: "https://your-instance.myservice.com"
      api_key: "your-api-key"
```

## Common Use Cases

```
What open incidents are affecting the payment service?
```

```
Show me the details of incident INC-12345
```
```

---

## Step 9: Verify End-to-End

```bash
# 1. Run linting (only when explicitly asked)
rm -rf .mypy_cache && pre-commit run --all-files

# 2. Run unit tests
poetry run pytest tests -m "not llm" -k "myservice"

# 3. Run integration test with real credentials
MYSERVICE_API_URL=https://... MYSERVICE_API_KEY=... \
  poetry run pytest tests/plugins/test_myservice.py -v

# 4. Test in Holmes CLI
holmes ask "List open incidents" --toolset myservice/core
```

---

## Step 10: Write a Runbook (Optional but Recommended)

Runbooks guide Holmes to follow your team's specific investigation procedures for this toolset.

Create `~/.holmes/runbooks/{name}/investigation.md`:

```markdown
# {Service} Investigation

## Goal
Determine the root cause of {service} issues and provide remediation steps.

## Workflow
1. Check {service} health: call {toolset_name}_health_check
2. List recent errors: call {toolset_name}_list_errors with time_range=last_1h
3. Get details on the top error: call {toolset_name}_get_error_details
4. Check for recent changes: look at audit logs or deployment history
5. Correlate with infrastructure: check if related services are also affected

## Synthesize Findings
Identify: Was this a code change, config change, resource exhaustion, or external dependency?

## Recommended Remediation
- Error type A: specific fix
- Error type B: specific fix
```

Register in `~/.holmes/config.yaml`:
```yaml
custom_runbook_catalogs:
  - /home/user/.holmes/runbooks/catalog.json
```

```json
{
  "catalog": [
    {
      "id": "myservice-investigation",
      "update_date": "2026-03-12",
      "description": "MyService errors and performance issues",
      "link": "myservice/investigation.md"
    }
  ]
}
```

---

## Quick Reference

| Pattern | Location |
|---|---|
| Thin wrapper reference | `holmes/plugins/toolsets/servicenow_tables/servicenow_tables.py` |
| Backwards compat reference | `holmes/plugins/toolsets/prometheus/prometheus.py` |
| JSON filter mixin | `holmes/plugins/toolsets/json_filter_mixin.py` |
| Toolset registration | `holmes/plugins/toolsets/__init__.py` |
| Log toolset base class | `holmes/plugins/toolsets/base_pod_logging_toolset.py` |
| Fetch logs prompt | `holmes/plugins/prompts/_fetch_logs.jinja2` |
| Fast model summarization | Set `fast_model` in config for large tool output compression |
| Tool approval | Set `require_approval: true` in toolset config for write operations |
