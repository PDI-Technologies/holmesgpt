"""Microsoft Outlook / Microsoft Graph API toolset for reading emails and calendar events."""

import json
import logging
from typing import Any, Optional, Tuple, Type

import requests
from pydantic import Field

from holmes.core.tools import (
    CallablePrerequisite,
)
from holmes.core.tools import ClassVar as ToolsClassVar
from holmes.core.tools import (
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
OUTLOOK_TOKEN_URL = "https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"


class OutlookConfig(ToolsetConfig):
    """Configuration for Microsoft Outlook / Graph API access."""

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
    mailbox: str = Field(
        title="Mailbox",
        description="Email address of the mailbox to access (e.g. alerts@yourcompany.com). The app must have Mail.Read permission.",
        examples=["alerts@yourcompany.com"],
    )
    default_folder: str = Field(
        default="inbox",
        title="Default Mail Folder",
        description="Default mail folder to read from (inbox, sentitems, drafts, deleteditems, or a folder ID)",
        examples=["inbox"],
    )


class OutlookToolset(Toolset):
    """Microsoft Outlook toolset for reading emails and calendar events via Microsoft Graph API."""

    config_classes: ToolsClassVar[list[Type[OutlookConfig]]] = [OutlookConfig]

    outlook_config: Optional[OutlookConfig] = None
    _access_token: Optional[str] = None

    def __init__(self):
        super().__init__(
            name="outlook",
            description="Read-only access to Microsoft Outlook emails and calendar events via Microsoft Graph API",
            docs_url="https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview",
            icon_url="https://upload.wikimedia.org/wikipedia/commons/d/df/Microsoft_Office_Outlook_%282018%E2%80%93present%29.svg",
            prerequisites=[CallablePrerequisite(callable=self.prerequisites_callable)],
            tools=[
                ListOutlookEmails(toolset=self),
                GetOutlookEmail(toolset=self),
                SearchOutlookEmails(toolset=self),
                ListOutlookCalendarEvents(toolset=self),
                ListOutlookMailFolders(toolset=self),
            ],
            tags=[ToolsetTag.CORE],
        )

    def prerequisites_callable(self, config: dict[str, Any]) -> Tuple[bool, str]:
        if not config:
            return (
                False,
                "Missing Outlook configuration. Provide tenant_id, client_id, client_secret, and mailbox.",
            )
        try:
            self.outlook_config = OutlookConfig(**config)
            return self._health_check()
        except Exception as e:
            return False, f"Failed to configure Outlook toolset: {e}"

    def _get_access_token(self) -> str:
        assert self.outlook_config is not None
        token_url = OUTLOOK_TOKEN_URL.format(tenant_id=self.outlook_config.tenant_id)
        resp = requests.post(
            token_url,
            data={
                "grant_type": "client_credentials",
                "client_id": self.outlook_config.client_id,
                "client_secret": self.outlook_config.client_secret,
                "scope": "https://graph.microsoft.com/.default",
            },
            timeout=30,
        )
        resp.raise_for_status()
        token_data = resp.json()
        return token_data["access_token"]

    def _health_check(self) -> Tuple[bool, str]:
        assert self.outlook_config is not None
        try:
            token = self._get_access_token()
            self._access_token = token
            # Verify token works by accessing the mailbox
            resp = requests.get(
                f"{GRAPH_API_BASE}/users/{self.outlook_config.mailbox}/mailFolders/inbox",
                headers=self._headers(),
                timeout=10,
            )
            if resp.status_code == 200:
                return True, ""
            if resp.status_code == 403:
                return (
                    False,
                    "Outlook API returned 403 Forbidden. Ensure the app has Mail.Read application permission in Azure AD.",
                )
            if resp.status_code == 404:
                return (
                    False,
                    f"Mailbox '{self.outlook_config.mailbox}' not found. Verify the email address is correct.",
                )
            return False, f"Outlook API returned {resp.status_code}: {resp.text[:200]}"
        except Exception as e:
            return False, f"Outlook health check failed: {e}"

    def _headers(self) -> dict:
        if not self._access_token:
            self._access_token = self._get_access_token()
        return {
            "Authorization": f"Bearer {self._access_token}",
            "Content-Type": "application/json",
        }

    def get(self, path: str, params: Optional[dict] = None) -> dict:
        assert self.outlook_config is not None
        url = f"{GRAPH_API_BASE}{path}"
        resp = requests.get(
            url, headers=self._headers(), params=params or {}, timeout=30
        )
        if resp.status_code == 401:
            # Token may have expired, refresh and retry
            self._access_token = self._get_access_token()
            resp = requests.get(
                url, headers=self._headers(), params=params or {}, timeout=30
            )
        resp.raise_for_status()
        return resp.json()


class BaseOutlookTool(Tool):
    toolset: "OutlookToolset"


class ListOutlookMailFolders(BaseOutlookTool):
    def __init__(self, toolset: "OutlookToolset"):
        super().__init__(
            name="list_outlook_mail_folders",
            description="[outlook toolset] List mail folders in the configured Outlook mailbox",
            parameters={},
            toolset=toolset,
        )

    def get_parameterized_one_liner(self, params: dict) -> str:
        return f"{toolset_name_for_one_liner(self.toolset.name)}: List mail folders"

    def _invoke(self, params: dict, context: ToolInvokeContext) -> StructuredToolResult:
        if not self.toolset.outlook_config:
            return StructuredToolResult(
                status=StructuredToolResultStatus.ERROR,
                error="Outlook not configured",
                params=params,
            )
        try:
            mailbox = self.toolset.outlook_config.mailbox
            data = self.toolset.get(f"/users/{mailbox}/mailFolders")
            return StructuredToolResult(
                status=StructuredToolResultStatus.SUCCESS,
                data=json.dumps(data, indent=2),
                params=params,
                url=f"https://outlook.office.com/mail/{mailbox}",
            )
        except Exception as e:
            logging.exception("Failed to list Outlook mail folders")
            return StructuredToolResult(
                status=StructuredToolResultStatus.ERROR, error=str(e), params=params
            )


class ListOutlookEmails(BaseOutlookTool):
    def __init__(self, toolset: "OutlookToolset"):
        super().__init__(
            name="list_outlook_emails",
            description="[outlook toolset] List emails from the configured Outlook mailbox",
            parameters={
                "folder": ToolParameter(
                    description="Mail folder to read from: inbox, sentitems, drafts, deleteditems, or a folder ID. Defaults to config default_folder.",
                    type="string",
                    required=False,
                ),
                "limit": ToolParameter(
                    description="Maximum number of emails to return (default: 20)",
                    type="integer",
                    required=False,
                ),
                "unread_only": ToolParameter(
                    description="If true, return only unread emails",
                    type="boolean",
                    required=False,
                ),
            },
            toolset=toolset,
        )

    def get_parameterized_one_liner(self, params: dict) -> str:
        folder = params.get("folder", "inbox")
        return f"{toolset_name_for_one_liner(self.toolset.name)}: List emails (folder={folder})"

    def _invoke(self, params: dict, context: ToolInvokeContext) -> StructuredToolResult:
        if not self.toolset.outlook_config:
            return StructuredToolResult(
                status=StructuredToolResultStatus.ERROR,
                error="Outlook not configured",
                params=params,
            )
        try:
            mailbox = self.toolset.outlook_config.mailbox
            folder = params.get("folder") or self.toolset.outlook_config.default_folder
            limit = params.get("limit", 20)
            query_params: dict[str, Any] = {
                "$top": limit,
                "$orderby": "receivedDateTime desc",
                "$select": "id,subject,from,receivedDateTime,isRead,bodyPreview,hasAttachments,importance",
            }
            if params.get("unread_only"):
                query_params["$filter"] = "isRead eq false"
            data = self.toolset.get(
                f"/users/{mailbox}/mailFolders/{folder}/messages", params=query_params
            )
            return StructuredToolResult(
                status=StructuredToolResultStatus.SUCCESS,
                data=json.dumps(data, indent=2),
                params=params,
                url=f"https://outlook.office.com/mail/{mailbox}",
            )
        except Exception as e:
            logging.exception("Failed to list Outlook emails")
            return StructuredToolResult(
                status=StructuredToolResultStatus.ERROR, error=str(e), params=params
            )


class GetOutlookEmail(BaseOutlookTool):
    def __init__(self, toolset: "OutlookToolset"):
        super().__init__(
            name="get_outlook_email",
            description="[outlook toolset] Get the full content of a specific email by ID",
            parameters={
                "message_id": ToolParameter(
                    description="The email message ID (from list_outlook_emails)",
                    type="string",
                    required=True,
                ),
            },
            toolset=toolset,
        )

    def get_parameterized_one_liner(self, params: dict) -> str:
        return f"{toolset_name_for_one_liner(self.toolset.name)}: Get email {params.get('message_id', '')}"

    def _invoke(self, params: dict, context: ToolInvokeContext) -> StructuredToolResult:
        if not self.toolset.outlook_config:
            return StructuredToolResult(
                status=StructuredToolResultStatus.ERROR,
                error="Outlook not configured",
                params=params,
            )
        message_id = params.get("message_id", "")
        if not message_id:
            return StructuredToolResult(
                status=StructuredToolResultStatus.ERROR,
                error="message_id is required",
                params=params,
            )
        try:
            mailbox = self.toolset.outlook_config.mailbox
            data = self.toolset.get(
                f"/users/{mailbox}/messages/{message_id}",
                params={
                    "$select": "id,subject,from,toRecipients,ccRecipients,receivedDateTime,isRead,body,hasAttachments,importance,attachments"
                },
            )
            return StructuredToolResult(
                status=StructuredToolResultStatus.SUCCESS,
                data=json.dumps(data, indent=2),
                params=params,
            )
        except requests.HTTPError as e:
            if e.response is not None and e.response.status_code == 404:
                return StructuredToolResult(
                    status=StructuredToolResultStatus.ERROR,
                    error=f"Email {message_id} not found",
                    params=params,
                )
            return StructuredToolResult(
                status=StructuredToolResultStatus.ERROR, error=str(e), params=params
            )
        except Exception as e:
            logging.exception("Failed to get Outlook email")
            return StructuredToolResult(
                status=StructuredToolResultStatus.ERROR, error=str(e), params=params
            )


class SearchOutlookEmails(BaseOutlookTool):
    def __init__(self, toolset: "OutlookToolset"):
        super().__init__(
            name="search_outlook_emails",
            description="[outlook toolset] Search emails in the Outlook mailbox by subject, sender, or body content",
            parameters={
                "query": ToolParameter(
                    description="Search query string. Searches subject, body, and sender fields.",
                    type="string",
                    required=True,
                ),
                "folder": ToolParameter(
                    description="Mail folder to search in: inbox, sentitems, drafts, deleteditems, or a folder ID. Defaults to config default_folder.",
                    type="string",
                    required=False,
                ),
                "limit": ToolParameter(
                    description="Maximum number of results to return (default: 20)",
                    type="integer",
                    required=False,
                ),
            },
            toolset=toolset,
        )

    def get_parameterized_one_liner(self, params: dict) -> str:
        q = params.get("query", "")
        return f"{toolset_name_for_one_liner(self.toolset.name)}: Search emails (query={q})"

    def _invoke(self, params: dict, context: ToolInvokeContext) -> StructuredToolResult:
        if not self.toolset.outlook_config:
            return StructuredToolResult(
                status=StructuredToolResultStatus.ERROR,
                error="Outlook not configured",
                params=params,
            )
        query = params.get("query", "")
        if not query:
            return StructuredToolResult(
                status=StructuredToolResultStatus.ERROR,
                error="query is required",
                params=params,
            )
        try:
            mailbox = self.toolset.outlook_config.mailbox
            folder = params.get("folder") or self.toolset.outlook_config.default_folder
            limit = params.get("limit", 20)
            query_params: dict[str, Any] = {
                "$top": limit,
                "$search": f'"{query}"',
                "$select": "id,subject,from,receivedDateTime,isRead,bodyPreview,hasAttachments,importance",
            }
            data = self.toolset.get(
                f"/users/{mailbox}/mailFolders/{folder}/messages", params=query_params
            )
            return StructuredToolResult(
                status=StructuredToolResultStatus.SUCCESS,
                data=json.dumps(data, indent=2),
                params=params,
            )
        except Exception as e:
            logging.exception("Failed to search Outlook emails")
            return StructuredToolResult(
                status=StructuredToolResultStatus.ERROR, error=str(e), params=params
            )


class ListOutlookCalendarEvents(BaseOutlookTool):
    def __init__(self, toolset: "OutlookToolset"):
        super().__init__(
            name="list_outlook_calendar_events",
            description="[outlook toolset] List upcoming calendar events from the Outlook mailbox",
            parameters={
                "limit": ToolParameter(
                    description="Maximum number of events to return (default: 20)",
                    type="integer",
                    required=False,
                ),
                "start_datetime": ToolParameter(
                    description="Start of time range in ISO 8601 format (e.g. 2024-01-01T00:00:00Z). Defaults to now.",
                    type="string",
                    required=False,
                ),
                "end_datetime": ToolParameter(
                    description="End of time range in ISO 8601 format (e.g. 2024-01-31T23:59:59Z). Defaults to 7 days from now.",
                    type="string",
                    required=False,
                ),
            },
            toolset=toolset,
        )

    def get_parameterized_one_liner(self, params: dict) -> str:
        return f"{toolset_name_for_one_liner(self.toolset.name)}: List calendar events"

    def _invoke(self, params: dict, context: ToolInvokeContext) -> StructuredToolResult:
        if not self.toolset.outlook_config:
            return StructuredToolResult(
                status=StructuredToolResultStatus.ERROR,
                error="Outlook not configured",
                params=params,
            )
        try:
            import datetime

            mailbox = self.toolset.outlook_config.mailbox
            limit = params.get("limit", 20)

            now = datetime.datetime.utcnow()
            start = params.get("start_datetime") or now.strftime("%Y-%m-%dT%H:%M:%SZ")
            end = params.get("end_datetime") or (
                now + datetime.timedelta(days=7)
            ).strftime("%Y-%m-%dT%H:%M:%SZ")

            query_params: dict[str, Any] = {
                "$top": limit,
                "$orderby": "start/dateTime",
                "$select": "id,subject,organizer,start,end,location,isAllDay,isCancelled,attendees,bodyPreview",
                "startDateTime": start,
                "endDateTime": end,
            }
            data = self.toolset.get(
                f"/users/{mailbox}/calendarView", params=query_params
            )
            return StructuredToolResult(
                status=StructuredToolResultStatus.SUCCESS,
                data=json.dumps(data, indent=2),
                params=params,
                url=f"https://outlook.office.com/calendar/{mailbox}",
            )
        except Exception as e:
            logging.exception("Failed to list Outlook calendar events")
            return StructuredToolResult(
                status=StructuredToolResultStatus.ERROR, error=str(e), params=params
            )
