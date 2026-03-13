"""
Projects and LLM instructions persistence backed by DynamoDB.

Table schema (single-table design):
  pk                  | sk              | data / instructions
  PROJECT#<id>        | META            | JSON-serialised Project
  LLM_OVERRIDE        | <toolset_name>  | instructions string
"""
from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

import boto3
from boto3.dynamodb.conditions import Key
from pydantic import BaseModel, Field

TABLE_NAME = os.environ.get("HOLMES_DYNAMODB_TABLE", "")
AWS_REGION = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")


# ── Data models ────────────────────────────────────────────────────────────────


class ToolsetInstance(BaseModel):
    """One integration instance within a project."""

    type: str  # base toolset type: "grafana/dashboards", "aws_api", "salesforce", "ado", "atlassian"
    name: str  # unique instance name: "grafana-logistics", "aws_api"
    secret_arn: Optional[str] = None  # Secrets Manager ARN for per-instance credentials
    # For MCP toolsets: override the MCP server URL (leave None to use global URL)
    mcp_url: Optional[str] = None
    # For aws_api: restrict to these account profile names (None = all configured accounts)
    aws_accounts: Optional[list[str]] = None


class Project(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    name: str
    description: str = ""
    instances: list[ToolsetInstance] = []
    created_at: str = ""


# ── DynamoDB helpers ───────────────────────────────────────────────────────────


def _get_table():
    return boto3.resource("dynamodb", region_name=AWS_REGION).Table(TABLE_NAME)


# ── Projects store ─────────────────────────────────────────────────────────────


class ProjectsStore:
    def create(self, name: str, description: str, instances: list[dict]) -> Project:
        p = Project(
            name=name,
            description=description,
            instances=[ToolsetInstance(**i) for i in instances],
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        _get_table().put_item(
            Item={"pk": f"PROJECT#{p.id}", "sk": "META", "data": p.model_dump_json()}
        )
        return p

    def update(self, project_id: str, **kwargs) -> Optional[Project]:
        p = self.get(project_id)
        if not p:
            return None
        for k, v in kwargs.items():
            if k == "instances":
                v = [ToolsetInstance(**i) for i in v]
            setattr(p, k, v)
        _get_table().put_item(
            Item={"pk": f"PROJECT#{p.id}", "sk": "META", "data": p.model_dump_json()}
        )
        return p

    def delete(self, project_id: str) -> bool:
        resp = _get_table().delete_item(
            Key={"pk": f"PROJECT#{project_id}", "sk": "META"},
            ReturnValues="ALL_OLD",
        )
        return bool(resp.get("Attributes"))

    def get(self, project_id: str) -> Optional[Project]:
        resp = _get_table().get_item(Key={"pk": f"PROJECT#{project_id}", "sk": "META"})
        item = resp.get("Item")
        if not item:
            return None
        return Project.model_validate_json(item["data"])

    def list(self) -> list[Project]:
        # Scan for all PROJECT# items (small table — scan is fine)
        resp = _get_table().scan(
            FilterExpression="begins_with(pk, :prefix) AND sk = :sk",
            ExpressionAttributeValues={":prefix": "PROJECT#", ":sk": "META"},
        )
        projects = [Project.model_validate_json(item["data"]) for item in resp.get("Items", [])]
        return sorted(projects, key=lambda p: p.created_at)


_store = ProjectsStore()


def get_store() -> ProjectsStore:
    return _store


# ── LLM instructions store ─────────────────────────────────────────────────────


class LLMInstructionsStore:
    def load_all(self) -> dict[str, str]:
        """Return {toolset_name: instructions} for all stored overrides."""
        resp = _get_table().query(
            KeyConditionExpression=Key("pk").eq("LLM_OVERRIDE"),
        )
        return {item["sk"]: item["instructions"] for item in resp.get("Items", [])}

    def save(self, toolset_name: str, instructions: str) -> None:
        _get_table().put_item(
            Item={"pk": "LLM_OVERRIDE", "sk": toolset_name, "instructions": instructions}
        )

    def delete(self, toolset_name: str) -> None:
        _get_table().delete_item(Key={"pk": "LLM_OVERRIDE", "sk": toolset_name})


_llm_store = LLMInstructionsStore()


def get_llm_store() -> LLMInstructionsStore:
    return _llm_store


# ── Toolset enable/disable state store ─────────────────────────────────────────


class ToolsetStateStore:
    """Persist toolset enabled/disabled state across pod restarts."""

    def load_all(self) -> dict[str, bool]:
        """Return {toolset_name: enabled} for all stored state overrides."""
        resp = _get_table().query(
            KeyConditionExpression=Key("pk").eq("TOOLSET_STATE"),
        )
        return {item["sk"]: item["enabled"] for item in resp.get("Items", [])}

    def save(self, toolset_name: str, enabled: bool) -> None:
        _get_table().put_item(
            Item={"pk": "TOOLSET_STATE", "sk": toolset_name, "enabled": enabled}
        )

    def delete(self, toolset_name: str) -> None:
        _get_table().delete_item(Key={"pk": "TOOLSET_STATE", "sk": toolset_name})


_toolset_state_store = ToolsetStateStore()


def get_toolset_state_store() -> ToolsetStateStore:
    return _toolset_state_store


# ── Per-project tool executor ──────────────────────────────────────────────────


def _fetch_secret(secret_arn: str) -> dict:
    """Fetch and JSON-decode a Secrets Manager secret."""
    client = boto3.client("secretsmanager", region_name=AWS_REGION)
    resp = client.get_secret_value(SecretId=secret_arn)
    return json.loads(resp["SecretString"])


# MCP toolset types that can be scoped per-project via a per-project API key
_MCP_TOOLSET_TYPES = {"ado", "atlassian", "salesforce"}

# Default MCP server URLs (mirrors helm.tf configuration)
_MCP_DEFAULT_URLS = {
    "ado": "https://mcp-api.platform.pditechnologies.com/v1/ado-sse/mcp",
    "atlassian": "https://mcp-api.platform.pditechnologies.com/v1/atlassian-sse/mcp",
    "salesforce": "https://mcp-api.platform.pditechnologies.com/v1/salesforce-sse/mcp",
}

_MCP_ICONS = {
    "ado": "https://cdn.simpleicons.org/azuredevops/0078D7",
    "atlassian": "https://cdn.simpleicons.org/atlassian/0052CC",
    "salesforce": "https://cdn.simpleicons.org/salesforce/00A1E0",
}

_MCP_DESCRIPTIONS = {
    "ado": "Azure DevOps - work items, repositories, pipelines, and boards",
    "atlassian": "Atlassian - Jira issues, Confluence pages, and project boards",
    "salesforce": "Salesforce - accounts, contacts, opportunities, cases, and CRM data",
}

_MCP_LLM_INSTRUCTIONS = {
    "ado": "Use this toolset to query Azure DevOps work items, pull requests, repositories, pipelines, and boards. Prefer WIQL queries for work item searches.",
    "atlassian": "Use this toolset to search and retrieve Jira issues, Confluence pages, and Atlassian project information. Prefer JQL for Jira queries.",
    "salesforce": "Use this toolset to query Salesforce CRM data including accounts, contacts, opportunities, cases, and custom objects. Prefer SOQL queries for data retrieval.",
}


def _build_mcp_toolset(instance: ToolsetInstance, api_key: str) -> object:
    """Dynamically instantiate a RemoteMCPToolset with a per-project API key."""
    from holmes.plugins.toolsets.mcp.toolset_mcp import RemoteMCPToolset  # type: ignore

    url = instance.mcp_url or _MCP_DEFAULT_URLS.get(instance.type, "")
    if not url:
        raise ValueError(f"No URL configured for MCP toolset type '{instance.type}'")

    return RemoteMCPToolset(
        name=instance.name,
        description=_MCP_DESCRIPTIONS.get(instance.type, f"{instance.type} MCP server"),
        icon_url=_MCP_ICONS.get(instance.type),
        llm_instructions=_MCP_LLM_INSTRUCTIONS.get(instance.type, ""),
        config={
            "url": url,
            "mode": "streamable-http",
            "headers": {"x-api-key": api_key},
        },
    )


def _build_aws_toolset_with_account_filter(
    global_toolset: object, allowed_accounts: list[str]
) -> object:
    """
    Return a copy of the global AWS MCP toolset with LLM instructions restricted
    to only the allowed account profiles.

    We do this by cloning the toolset and overriding its llm_instructions to
    list only the permitted --profile values, so the LLM won't attempt to use
    accounts outside the project's scope.
    """
    import copy

    ts = copy.copy(global_toolset)

    # Build a filtered account description block
    account_lines = [
        "ALWAYS use --profile <account-name> in every AWS CLI command to target the correct account.",
        "NEVER run AWS commands without --profile.",
        "This project is scoped to the following AWS accounts only:",
        "",
    ]
    for acct in allowed_accounts:
        account_lines.append(f"  --profile {acct}")

    ts.llm_instructions = "\n".join(account_lines)
    return ts


def build_project_tool_executor(project: Project, config, dal):
    """
    Build a ToolExecutor scoped to the toolset instances defined in *project*.

    Handles three cases per instance:
    1. Python toolsets (grafana, prometheus) with secret_arn → dynamically instantiated
       with credentials from Secrets Manager.
    2. MCP toolsets (ado, atlassian, salesforce) with secret_arn → dynamically
       instantiated with per-project API key from Secrets Manager.
    3. AWS toolset (aws_api) with aws_accounts → reuses global toolset but overrides
       LLM instructions to restrict to the listed account profiles.
    4. Any instance whose name matches a global toolset and has no overrides → reused
       directly from the global executor.
    """
    from holmes.core.tools_utils.tool_executor import ToolExecutor  # type: ignore

    config.create_tool_executor(dal)  # ensure global executor is ready
    global_by_name = {ts.name: ts for ts in config._server_tool_executor.toolsets}

    project_toolsets = []
    for instance in project.instances:
        try:
            # ── MCP toolset with per-project API key ──────────────────────────
            if instance.type in _MCP_TOOLSET_TYPES and instance.secret_arn:
                creds = _fetch_secret(instance.secret_arn)
                api_key = creds.get("api_key") or creds.get("x-api-key") or ""
                if not api_key:
                    logging.warning(
                        "Secret %s for MCP toolset %s has no 'api_key' field — skipping",
                        instance.secret_arn,
                        instance.name,
                    )
                    continue
                ts = _build_mcp_toolset(instance, api_key)
                project_toolsets.append(ts)
                continue

            # ── AWS toolset with account filter ───────────────────────────────
            if instance.type == "aws_api" and instance.aws_accounts:
                global_ts = global_by_name.get(instance.name)
                if global_ts is not None:
                    ts = _build_aws_toolset_with_account_filter(global_ts, instance.aws_accounts)
                    project_toolsets.append(ts)
                else:
                    logging.warning(
                        "AWS toolset '%s' not found in global executor for project %s",
                        instance.name,
                        project.id,
                    )
                continue

            # ── Global toolset reuse (no per-project overrides) ───────────────
            if instance.name in global_by_name:
                project_toolsets.append(global_by_name[instance.name])
                continue

            # ── Dynamically instantiate Python toolset with Secrets Manager creds ──
            creds = _fetch_secret(instance.secret_arn) if instance.secret_arn else {}
            synthetic_config = {instance.name: {"enabled": True, "config": creds}}
            from holmes.plugins.toolsets import load_toolsets_from_config  # type: ignore

            new_toolsets = load_toolsets_from_config(synthetic_config, strict_check=False)
            if new_toolsets:
                ts = new_toolsets[0]
                ts.check_prerequisites()
                project_toolsets.append(ts)

        except Exception:
            logging.warning(
                "Failed to load toolset instance %s for project %s",
                instance.name,
                project.id,
                exc_info=True,
            )

    return ToolExecutor(project_toolsets)
