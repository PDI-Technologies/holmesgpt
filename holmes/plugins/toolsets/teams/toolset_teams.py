"""Microsoft Teams toolset for sending messages and reading channel activity."""

import json
import logging
from typing import Any, ClassVar, Optional, Tuple, Type

import requests
from pydantic import Field

from holmes.core.tools import (
    CallablePrerequisite,
    ClassVar as ToolsClassVar,
    StructuredToolResult,
    StructuredToolResultStatus,
    Tool,
    ToolInvokeContext,
    ToolParameter,
    Toolset,
    ToolsetTag,
)
from holmes.plugins.toolsets.utils import toolset_name_for_one_liner
from holmes.utils.pydantic_utils import ToolsetConfig

GRAPH_API_BASE = "https://graph.microsoft.com/v1.0"
TEAMS_TOKEN_URL = "https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"


class TeamsConfig(ToolsetConfig):
    """Configuration for Microsoft Teams API access."""

    tenant_id: str = Field(
        title="Tenant ID",
        description="Azure AD tenant ID (Directory ID). Found in Azure Portal → Azure Active Directory → Overview",
        examples=["xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"],
    )
    client_id: str = Field(
        title="Client ID",
        description="Azure AD application (client) ID. Register an app in Azure Portal → App registrations",
        examples=["xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"],
    )
    client_secret: str = Field(
        title="Client Secret",
        description="Azure AD application client secret. Create one in App registrations → Certificates & secrets",
        examples=["your-client-secret-value"],
    )
    default_team_id: Optional[str] = Field(
        default=None,
        title="Default Team ID",
        description="Default Microsoft Teams team ID to use when not specified in tool calls",
        examples=["xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"],
    )
    default_channel_id: Optional[str] = Field(
        default=None,
        title="Default Channel ID",
        description="Default channel ID within the default team to use when not specified in tool calls",
        examples=["19:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@thread.tacv2"],
    )


class TeamsToolset(Toolset):
    """Microsoft Teams toolset for reading channel messages and team information."""

    config_classes: ToolsClassVar[list[Type[TeamsConfig]]] = [TeamsConfig]

    teams_config: Optional[TeamsConfig] = None
    _access_token: Optional[str] = None

    def __init__(self):
        super().__init__(
            name="teams",
            description="Read-only access to Microsoft Teams channels, messages, and team information via Microsoft Graph API",
            docs_url="https://learn.microsoft.com/en-us/graph/api/resources/teams-api-overview",
            icon_url="https://upload.wikimedia.org/wikipedia/commons/c/c9/Microsoft_Office_Teams_%282018%E2%80%93present%29.svg",
            prerequisites=[CallablePrerequisite(callable=self.prerequisites_callable)],
            tools=[
                ListTeamsChannels(toolset=self),
                GetTeamsChannelMessages(toolset=self),
                ListTeams(toolset=self),
                GetTeamsChannelMessage(toolset=self),
            ],
            tags=[ToolsetTag.CORE],
        )

    def prerequisites_callable(self, config: dict[str, Any]) -> Tuple[bool, str]:
        if not config:
            return False, "Missing Teams configuration. Provide tenant_id, client_id, and client_secret."
        try:
            self.teams_config = TeamsConfig(**config)
            return self._health_check()
        except Exception as e:
            return False, f"Failed to configure Teams toolset: {e}"

    def _get_access_token(self) -> str:
        assert self.teams_config is not None
        token_url = TEAMS_TOKEN_URL.format(tenant_id=self.teams_config.tenant_id)
        resp = requests.post(
            token_url,
            data={
                "grant_type": "client_credentials",
                "client_id": self.teams_config.client_id,
                "client_secret": self.teams_config.client_secret,
                "scope": "https://graph.microsoft.com/.default",
            },
            timeout=30,
        )
        resp.raise_for_status()
        token_data = resp.json()
        return token_data["access_token"]

    def _health_check(self) -> Tuple[bool, str]:
        try:
            token = self._get_access_token()
            self._access_token = token
            # Verify token works by listing joined teams
            resp = requests.get(
                f"{GRAPH_API_BASE}/teams",
                headers=self._headers(),
                timeout=10,
            )
            if resp.status_code in (200, 400):
                # 400 can happen if no teams are joined but auth is valid
                return True, ""
            if resp.status_code == 403:
                return False, "Teams API returned 403 Forbidden. Ensure the app has Team.ReadBasic.All and ChannelMessage.Read.All permissions."
            return False, f"Teams API returned {resp.status_code}: {resp.text[:200]}"
        except Exception as e:
            return False, f"Teams health check failed: {e}"

    def _headers(self) -> dict:
        if not self._access_token:
            self._access_token = self._get_access_token()
        return {
            "Authorization": f"Bearer {self._access_token}",
            "Content-Type": "application/json",
        }

    def get(self, path: str, params: Optional[dict] = None) -> dict:
        assert self.teams_config is not None
        url = f"{GRAPH_API_BASE}{path}"
        resp = requests.get(url, headers=self._headers(), params=params or {}, timeout=30)
        if resp.status_code == 401:
            # Token may have expired, refresh and retry
            self._access_token = self._get_access_token()
            resp = requests.get(url, headers=self._headers(), params=params or {}, timeout=30)
        resp.raise_for_status()
        return resp.json()


class BaseTeamsTool(Tool):
    toolset: "TeamsToolset"


class ListTeams(BaseTeamsTool):
    def __init__(self, toolset: "TeamsToolset"):
        super().__init__(
            name="list_teams",
            description="[teams toolset] List Microsoft Teams that the application has access to",
            parameters={
                "limit": ToolParameter(
                    description="Maximum number of teams to return (default: 25)",
                    type="integer",
                    required=False,
                ),
            },
            toolset=toolset,
        )

    def get_parameterized_one_liner(self, params: dict) -> str:
        return f"{toolset_name_for_one_liner(self.toolset.name)}: List teams"

    def _invoke(self, params: dict, context: ToolInvokeContext) -> StructuredToolResult:
        if not self.toolset.teams_config:
            return StructuredToolResult(status=StructuredToolResultStatus.ERROR, error="Teams not configured", params=params)
        try:
            limit = params.get("limit", 25)
            data = self.toolset.get("/teams", params={"$top": limit})
            return StructuredToolResult(
                status=StructuredToolResultStatus.SUCCESS,
                data=json.dumps(data, indent=2),
                params=params,
                url="https://teams.microsoft.com",
            )
        except Exception as e:
            logging.exception("Failed to list Teams")
            return StructuredToolResult(status=StructuredToolResultStatus.ERROR, error=str(e), params=params)


class ListTeamsChannels(BaseTeamsTool):
    def __init__(self, toolset: "TeamsToolset"):
        super().__init__(
            name="list_teams_channels",
            description="[teams toolset] List channels in a Microsoft Teams team",
            parameters={
                "team_id": ToolParameter(
                    description="The Microsoft Teams team ID. Uses default_team_id from config if not provided.",
                    type="string",
                    required=False,
                ),
            },
            toolset=toolset,
        )

    def get_parameterized_one_liner(self, params: dict) -> str:
        team_id = params.get("team_id", "default")
        return f"{toolset_name_for_one_liner(self.toolset.name)}: List channels (team={team_id})"

    def _invoke(self, params: dict, context: ToolInvokeContext) -> StructuredToolResult:
        if not self.toolset.teams_config:
            return StructuredToolResult(status=StructuredToolResultStatus.ERROR, error="Teams not configured", params=params)
        team_id = params.get("team_id") or self.toolset.teams_config.default_team_id
        if not team_id:
            return StructuredToolResult(
                status=StructuredToolResultStatus.ERROR,
                error="team_id is required (or set default_team_id in config)",
                params=params,
            )
        try:
            data = self.toolset.get(f"/teams/{team_id}/channels")
            return StructuredToolResult(
                status=StructuredToolResultStatus.SUCCESS,
                data=json.dumps(data, indent=2),
                params=params,
                url=f"https://teams.microsoft.com/_#/teamDashboard/{team_id}",
            )
        except Exception as e:
            logging.exception("Failed to list Teams channels")
            return StructuredToolResult(status=StructuredToolResultStatus.ERROR, error=str(e), params=params)


class GetTeamsChannelMessages(BaseTeamsTool):
    def __init__(self, toolset: "TeamsToolset"):
        super().__init__(
            name="get_teams_channel_messages",
            description="[teams toolset] Get recent messages from a Microsoft Teams channel",
            parameters={
                "team_id": ToolParameter(
                    description="The Microsoft Teams team ID. Uses default_team_id from config if not provided.",
                    type="string",
                    required=False,
                ),
                "channel_id": ToolParameter(
                    description="The channel ID within the team. Uses default_channel_id from config if not provided.",
                    type="string",
                    required=False,
                ),
                "limit": ToolParameter(
                    description="Maximum number of messages to return (default: 20)",
                    type="integer",
                    required=False,
                ),
            },
            toolset=toolset,
        )

    def get_parameterized_one_liner(self, params: dict) -> str:
        channel_id = params.get("channel_id", "default")
        return f"{toolset_name_for_one_liner(self.toolset.name)}: Get channel messages (channel={channel_id})"

    def _invoke(self, params: dict, context: ToolInvokeContext) -> StructuredToolResult:
        if not self.toolset.teams_config:
            return StructuredToolResult(status=StructuredToolResultStatus.ERROR, error="Teams not configured", params=params)
        team_id = params.get("team_id") or self.toolset.teams_config.default_team_id
        channel_id = params.get("channel_id") or self.toolset.teams_config.default_channel_id
        if not team_id:
            return StructuredToolResult(
                status=StructuredToolResultStatus.ERROR,
                error="team_id is required (or set default_team_id in config)",
                params=params,
            )
        if not channel_id:
            return StructuredToolResult(
                status=StructuredToolResultStatus.ERROR,
                error="channel_id is required (or set default_channel_id in config)",
                params=params,
            )
        try:
            limit = params.get("limit", 20)
            data = self.toolset.get(
                f"/teams/{team_id}/channels/{channel_id}/messages",
                params={"$top": limit},
            )
            return StructuredToolResult(
                status=StructuredToolResultStatus.SUCCESS,
                data=json.dumps(data, indent=2),
                params=params,
            )
        except Exception as e:
            logging.exception("Failed to get Teams channel messages")
            return StructuredToolResult(status=StructuredToolResultStatus.ERROR, error=str(e), params=params)


class GetTeamsChannelMessage(BaseTeamsTool):
    def __init__(self, toolset: "TeamsToolset"):
        super().__init__(
            name="get_teams_channel_message",
            description="[teams toolset] Get a specific message and its replies from a Microsoft Teams channel",
            parameters={
                "team_id": ToolParameter(
                    description="The Microsoft Teams team ID. Uses default_team_id from config if not provided.",
                    type="string",
                    required=False,
                ),
                "channel_id": ToolParameter(
                    description="The channel ID within the team. Uses default_channel_id from config if not provided.",
                    type="string",
                    required=False,
                ),
                "message_id": ToolParameter(
                    description="The message ID to retrieve",
                    type="string",
                    required=True,
                ),
            },
            toolset=toolset,
        )

    def get_parameterized_one_liner(self, params: dict) -> str:
        return f"{toolset_name_for_one_liner(self.toolset.name)}: Get message {params.get('message_id', '')}"

    def _invoke(self, params: dict, context: ToolInvokeContext) -> StructuredToolResult:
        if not self.toolset.teams_config:
            return StructuredToolResult(status=StructuredToolResultStatus.ERROR, error="Teams not configured", params=params)
        team_id = params.get("team_id") or self.toolset.teams_config.default_team_id
        channel_id = params.get("channel_id") or self.toolset.teams_config.default_channel_id
        message_id = params.get("message_id", "")
        if not team_id:
            return StructuredToolResult(
                status=StructuredToolResultStatus.ERROR,
                error="team_id is required (or set default_team_id in config)",
                params=params,
            )
        if not channel_id:
            return StructuredToolResult(
                status=StructuredToolResultStatus.ERROR,
                error="channel_id is required (or set default_channel_id in config)",
                params=params,
            )
        if not message_id:
            return StructuredToolResult(status=StructuredToolResultStatus.ERROR, error="message_id is required", params=params)
        try:
            # Get message and its replies
            message_data = self.toolset.get(f"/teams/{team_id}/channels/{channel_id}/messages/{message_id}")
            replies_data = self.toolset.get(f"/teams/{team_id}/channels/{channel_id}/messages/{message_id}/replies")
            result = {
                "message": message_data,
                "replies": replies_data,
            }
            return StructuredToolResult(
                status=StructuredToolResultStatus.SUCCESS,
                data=json.dumps(result, indent=2),
                params=params,
            )
        except requests.HTTPError as e:
            if e.response is not None and e.response.status_code == 404:
                return StructuredToolResult(status=StructuredToolResultStatus.ERROR, error=f"Message {message_id} not found", params=params)
            return StructuredToolResult(status=StructuredToolResultStatus.ERROR, error=str(e), params=params)
        except Exception as e:
            logging.exception("Failed to get Teams channel message")
            return StructuredToolResult(status=StructuredToolResultStatus.ERROR, error=str(e), params=params)
