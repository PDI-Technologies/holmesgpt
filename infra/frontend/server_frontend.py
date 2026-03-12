"""
FastAPI extension for HolmesGPT frontend: basic auth + static file serving.
This module is loaded by a custom server wrapper that imports the original server.py
and adds frontend routes.

Security: ALL routes require authentication except /auth/login, /healthz, /readyz.
This includes /api/* endpoints — no unauthenticated access.
"""
import hashlib
import hmac
import logging
import os
import secrets
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

STATIC_DIR = Path("/app/static")
SESSION_COOKIE = "holmes_session"
SESSION_MAX_AGE = 86400  # 24 hours

# In-memory session store (sufficient for single-pod deployment)
_sessions: dict[str, str] = {}


def get_credentials() -> tuple[str, str]:
    username = os.environ.get("HOLMES_UI_USERNAME", "admin")
    password = os.environ.get("HOLMES_UI_PASSWORD", "")
    return username, password


def verify_session(session_id: str | None) -> bool:
    if not session_id:
        return False
    return session_id in _sessions


def verify_api_key(request: Request) -> bool:
    """Check for API key in Authorization header (for programmatic access)."""
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        _, expected_password = get_credentials()
        if expected_password and hmac.compare_digest(token, expected_password):
            return True
    return False


class AuthMiddleware(BaseHTTPMiddleware):
    """Protect ALL routes with session cookie or API key auth."""

    # Only these paths are exempt from auth
    EXEMPT_PATHS = ("/healthz", "/readyz", "/auth/login")
    # Static asset prefixes that must be accessible for the SPA to load
    EXEMPT_PREFIXES = ("/assets/", "/favicon")

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Health/readiness probes and login page are always accessible
        if path in self.EXEMPT_PATHS:
            return await call_next(request)

        # Static assets must be accessible for the login page to render
        if any(path.startswith(prefix) for prefix in self.EXEMPT_PREFIXES):
            return await call_next(request)

        # Check session cookie (browser access)
        session_id = request.cookies.get(SESSION_COOKIE)
        if verify_session(session_id):
            return await call_next(request)

        # Check API key in Authorization header (programmatic access)
        if verify_api_key(request):
            return await call_next(request)

        # Unauthenticated: redirect browsers to login, return 401 for API calls
        if request.headers.get("accept", "").startswith("text/html"):
            return HTMLResponse(
                content='<html><head><meta http-equiv="refresh" content="0;url=/auth/login"></head></html>',
                status_code=200,
            )

        return JSONResponse({"detail": "Unauthorized"}, status_code=401)


def mount_frontend(app: FastAPI, config=None) -> None:
    """Add auth endpoints, integrations API, and static file serving to the FastAPI app."""

    _, password = get_credentials()
    if not password:
        logging.warning(
            "HOLMES_UI_PASSWORD not set - frontend auth is DISABLED. "
            "Set HOLMES_UI_PASSWORD to secure all endpoints."
        )
    else:
        # Add auth middleware - protects ALL routes
        app.add_middleware(AuthMiddleware)
        logging.info("Auth middleware enabled - all routes require authentication")

    @app.get("/auth/check")
    async def auth_check(request: Request):
        session_id = request.cookies.get(SESSION_COOKIE)
        if not password or verify_session(session_id):
            return {"authenticated": True}
        raise HTTPException(status_code=401, detail="Not authenticated")

    @app.post("/auth/login")
    async def auth_login(request: Request):
        body = await request.json()
        username = body.get("username", "")
        password_input = body.get("password", "")

        expected_username, expected_password = get_credentials()

        if not expected_password:
            # Auth disabled - allow any login
            session_id = secrets.token_urlsafe(32)
            _sessions[session_id] = username
            response = JSONResponse({"ok": True})
            response.set_cookie(
                SESSION_COOKIE, session_id,
                max_age=SESSION_MAX_AGE, httponly=True, samesite="lax",
            )
            return response

        # Constant-time comparison to prevent timing attacks
        username_match = hmac.compare_digest(username, expected_username)
        password_match = hmac.compare_digest(
            hashlib.sha256(password_input.encode()).hexdigest(),
            hashlib.sha256(expected_password.encode()).hexdigest(),
        )

        if username_match and password_match:
            session_id = secrets.token_urlsafe(32)
            _sessions[session_id] = username
            response = JSONResponse({"ok": True})
            response.set_cookie(
                SESSION_COOKIE, session_id,
                max_age=SESSION_MAX_AGE, httponly=True, samesite="lax",
            )
            return response

        raise HTTPException(status_code=401, detail="Invalid credentials")

    @app.post("/auth/logout")
    async def auth_logout(request: Request):
        session_id = request.cookies.get(SESSION_COOKIE)
        if session_id and session_id in _sessions:
            del _sessions[session_id]
        response = JSONResponse({"ok": True})
        response.delete_cookie(SESSION_COOKIE)
        return response

    @app.get("/auth/login")
    async def auth_login_page():
        """Serve the SPA for the login page."""
        index = STATIC_DIR / "index.html"
        if index.exists():
            return FileResponse(index, media_type="text/html")
        return HTMLResponse("<h1>Frontend not built</h1>", status_code=404)

    def _ensure_tool_executor():
        """Lazily initialize the tool executor if not yet created."""
        if config is None:
            return False
        if config._server_tool_executor is None:
            try:
                config.create_tool_executor(config.dal)
            except Exception:
                logging.warning("Failed to initialize tool executor")
                return False
        return True

    def _get_config_schema(toolset) -> list:
        """Extract config field schema from a toolset's config class."""
        schema_fields = []
        seen_names = set()

        # Try to get schema from the toolset's config_classes
        config_classes = getattr(toolset.__class__, "config_classes", [])

        # If there are multiple config classes, prefer the first one (primary config)
        # and only add unique fields from subsequent classes
        for config_cls in config_classes[:1]:  # Only use the primary config class
            if not hasattr(config_cls, "model_fields"):
                continue
            for field_name, field_info in config_cls.model_fields.items():
                if field_name.startswith("_") or field_name in seen_names:
                    continue
                seen_names.add(field_name)

                field_type = "str"
                annotation = field_info.annotation
                if annotation is not None:
                    type_name = getattr(annotation, "__name__", str(annotation))
                    if "bool" in str(type_name).lower():
                        field_type = "bool"
                    elif "int" in str(type_name).lower():
                        field_type = "int"
                    elif "float" in str(type_name).lower():
                        field_type = "float"
                    elif "dict" in str(type_name).lower():
                        field_type = "dict"
                    elif "list" in str(type_name).lower():
                        field_type = "list"

                required = field_info.is_required()
                default = field_info.default if field_info.default is not None else None
                # Skip PydanticUndefined
                if default is not None and "PydanticUndefined" in str(type(default)):
                    default = None

                description = field_info.description or ""
                sensitive = any(kw in field_name.lower() for kw in ("key", "password", "secret", "token"))

                schema_fields.append({
                    "name": field_name,
                    "type": field_type,
                    "required": required,
                    "default": default if isinstance(default, (str, int, float, bool, type(None))) else str(default) if default is not None else None,
                    "description": description,
                    "sensitive": sensitive,
                })

        return schema_fields

    def _serialize_toolset(toolset) -> dict:
        """Serialize a toolset to a JSON-safe dict."""
        # Extract config fields for the UI
        config_fields = {}
        if toolset.config and hasattr(toolset.config, "model_dump"):
            try:
                config_fields = toolset.config.model_dump(exclude_none=True)
                # Remove internal/private fields
                for key in list(config_fields.keys()):
                    if key.startswith("_"):
                        del config_fields[key]
                # Convert non-serializable values to strings
                for key, val in config_fields.items():
                    if not isinstance(val, (str, int, float, bool, list, dict, type(None))):
                        config_fields[key] = str(val)
            except Exception:
                config_fields = {}
        elif isinstance(toolset.config, dict):
            config_fields = toolset.config

        return {
            "name": toolset.name,
            "description": toolset.description or "",
            "status": toolset.status.value if hasattr(toolset.status, "value") else str(toolset.status),
            "type": toolset.type.value if toolset.type and hasattr(toolset.type, "value") else "built-in",
            "error": toolset.error,
            "icon_url": getattr(toolset, "icon_url", None),
            "docs_url": getattr(toolset, "docs_url", None),
            "tool_count": len(toolset.tools) if toolset.tools else 0,
            "enabled": toolset.enabled,
            "config": config_fields,
            "config_schema": _get_config_schema(toolset),
        }

    @app.get("/api/integrations")
    async def get_integrations():
        """Return all toolsets with their status for the Integrations UI page."""
        if not _ensure_tool_executor():
            return JSONResponse({"integrations": []})

        integrations = [_serialize_toolset(t) for t in config._server_tool_executor.toolsets]
        return JSONResponse({"integrations": integrations})

    @app.put("/api/integrations/{name:path}/toggle")
    async def toggle_integration(name: str, request: Request):
        """Enable or disable a toolset and hot-reload."""
        if not _ensure_tool_executor():
            raise HTTPException(status_code=503, detail="Tool executor not available")

        body = await request.json()
        enabled = body.get("enabled")
        if enabled is None:
            raise HTTPException(status_code=400, detail="'enabled' field required")

        # Update the toolsets config dict (this is what ToolsetManager reads)
        if config.toolsets is None:
            config.toolsets = {}
        if name not in config.toolsets:
            config.toolsets[name] = {}
        config.toolsets[name]["enabled"] = enabled

        # Hot-reload: force re-creation of tool executor with updated config
        try:
            config._toolset_manager = None
            config._server_tool_executor = None
            config.create_tool_executor(config.dal)
        except Exception as e:
            logging.error(f"Failed to reload toolsets after toggle: {e}")
            raise HTTPException(status_code=500, detail=f"Reload failed: {str(e)}")

        # Find the updated toolset
        for t in config._server_tool_executor.toolsets:
            if t.name == name:
                return JSONResponse(_serialize_toolset(t))

        return JSONResponse({"ok": True, "name": name, "enabled": enabled})

    @app.put("/api/integrations/{name:path}/config")
    async def update_integration_config(name: str, request: Request):
        """Update a toolset's configuration and hot-reload."""
        if not _ensure_tool_executor():
            raise HTTPException(status_code=503, detail="Tool executor not available")

        body = await request.json()
        new_config = body.get("config", {})
        enabled = body.get("enabled")

        if config.toolsets is None:
            config.toolsets = {}
        if name not in config.toolsets:
            config.toolsets[name] = {}

        # Merge config fields
        if "config" not in config.toolsets[name]:
            config.toolsets[name]["config"] = {}
        config.toolsets[name]["config"].update(new_config)

        if enabled is not None:
            config.toolsets[name]["enabled"] = enabled

        # Hot-reload
        try:
            config._toolset_manager = None
            config._server_tool_executor = None
            config.create_tool_executor(config.dal)
        except Exception as e:
            logging.error(f"Failed to reload toolsets after config update: {e}")
            raise HTTPException(status_code=500, detail=f"Reload failed: {str(e)}")

        # Find the updated toolset
        for t in config._server_tool_executor.toolsets:
            if t.name == name:
                return JSONResponse(_serialize_toolset(t))

        return JSONResponse({"ok": True, "name": name})

    @app.get("/api/aws/accounts")
    async def get_aws_accounts():
        """Return configured AWS accounts for the multi-account MCP setup."""
        import json as _json
        raw = os.environ.get("AWS_MCP_ACCOUNTS", "[]")
        try:
            accounts = _json.loads(raw)
        except Exception:
            accounts = []
        return JSONResponse({
            "accounts": accounts,
            "irsa_role": os.environ.get("AWS_MCP_IRSA_ROLE", ""),
        })

    # ── LLM Instructions helpers ──────────────────────────────────────────────

    def _is_mcp_toolset(name: str) -> bool:
        """Return True if the named toolset is an MCP server."""
        if config is None:
            return False
        if config.mcp_servers and name in config.mcp_servers:
            return True
        if config._server_tool_executor:
            for t in config._server_tool_executor.toolsets:
                if t.name == name:
                    ts_type = t.type.value if t.type and hasattr(t.type, "value") else ""
                    return ts_type == "mcp"
        return False

    def _is_instructions_overridden(name: str) -> bool:
        """Return True if a user override exists for this toolset's llm_instructions."""
        if config is None:
            return False
        if config.mcp_servers and name in config.mcp_servers:
            return "llm_instructions" in config.mcp_servers[name]
        if config.toolsets and name in config.toolsets:
            return "llm_instructions" in config.toolsets[name]
        return False

    # ── LLM Instructions endpoints ────────────────────────────────────────────

    @app.get("/api/llm-instructions")
    async def get_llm_instructions():
        """Return current llm_instructions for every loaded toolset."""
        if not _ensure_tool_executor():
            return JSONResponse({"integrations": []})
        result = []
        for toolset in config._server_tool_executor.toolsets:
            result.append({
                "name": toolset.name,
                "description": toolset.description or "",
                "type": toolset.type.value if toolset.type and hasattr(toolset.type, "value") else "built-in",
                "icon_url": getattr(toolset, "icon_url", None),
                "enabled": toolset.enabled,
                "instructions": toolset.llm_instructions or "",
                "has_default": bool(toolset.llm_instructions),
                "is_overridden": _is_instructions_overridden(toolset.name),
            })
        return JSONResponse({"integrations": result})

    @app.put("/api/llm-instructions/{name:path}")
    async def update_llm_instructions(name: str, request: Request):
        """Override llm_instructions for one toolset and hot-reload."""
        if not _ensure_tool_executor():
            raise HTTPException(status_code=503, detail="Tool executor not available")
        body = await request.json()
        instructions: str = body.get("instructions", "")
        if _is_mcp_toolset(name):
            if config.mcp_servers is None:
                config.mcp_servers = {}
            config.mcp_servers.setdefault(name, {})["llm_instructions"] = instructions
        else:
            if config.toolsets is None:
                config.toolsets = {}
            config.toolsets.setdefault(name, {})["llm_instructions"] = instructions
        try:
            config._toolset_manager = None
            config._server_tool_executor = None
            config.create_tool_executor(config.dal)
        except Exception as e:
            logging.error(f"Failed to reload toolsets after llm_instructions update: {e}")
            raise HTTPException(status_code=500, detail=f"Reload failed: {str(e)}")
        for toolset in config._server_tool_executor.toolsets:
            if toolset.name == name:
                return JSONResponse({
                    "name": toolset.name,
                    "instructions": toolset.llm_instructions or "",
                    "is_overridden": True,
                })
        return JSONResponse({"ok": True, "name": name})

    @app.delete("/api/llm-instructions/{name:path}")
    async def reset_llm_instructions(name: str):
        """Remove a user override, restoring the toolset's default llm_instructions."""
        if not _ensure_tool_executor():
            raise HTTPException(status_code=503, detail="Tool executor not available")
        if _is_mcp_toolset(name):
            if config.mcp_servers and name in config.mcp_servers:
                config.mcp_servers[name].pop("llm_instructions", None)
        else:
            if config.toolsets and name in config.toolsets:
                config.toolsets[name].pop("llm_instructions", None)
        try:
            config._toolset_manager = None
            config._server_tool_executor = None
            config.create_tool_executor(config.dal)
        except Exception as e:
            logging.error(f"Failed to reload toolsets after llm_instructions reset: {e}")
            raise HTTPException(status_code=500, detail=f"Reload failed: {str(e)}")
        for toolset in config._server_tool_executor.toolsets:
            if toolset.name == name:
                return JSONResponse({
                    "name": toolset.name,
                    "instructions": toolset.llm_instructions or "",
                    "is_overridden": False,
                })
        return JSONResponse({"ok": True, "name": name})

    # Static file serving - must be registered last (catch-all)
    @app.get("/{path:path}")
    async def serve_frontend(path: str):
        """Serve React SPA static files with fallback to index.html."""
        if not STATIC_DIR.exists():
            raise HTTPException(status_code=404, detail="Frontend not built")

        # Try to serve the exact file
        file_path = STATIC_DIR / path
        if file_path.is_file() and STATIC_DIR in file_path.resolve().parents:
            return FileResponse(file_path)

        # Fallback to index.html for client-side routing
        index = STATIC_DIR / "index.html"
        if index.exists():
            return FileResponse(index, media_type="text/html")

        raise HTTPException(status_code=404, detail="Not found")
