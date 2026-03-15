"""
Custom server entrypoint that extends HolmesGPT with frontend UI and auth.
This wraps the original server.py, adding:
- Basic auth on ALL routes (session cookie + Bearer token)
- Static file serving for the React SPA
"""

# ruff: noqa: E402
import os
import sys

# Ensure the original server module can be imported
sys.path.insert(0, "/app")

from holmes.utils.cert_utils import add_custom_certificate

ADDITIONAL_CERTIFICATE: str = os.environ.get("CERTIFICATE", "")
if add_custom_certificate(ADDITIONAL_CERTIFICATE):
    print("added custom certificate")

# Import and mount frontend onto the existing app
from server_frontend import mount_frontend

# Import the original server module (runs init_logging, init_config, etc.)
import server as original_server

mount_frontend(original_server.app, original_server.config)

if __name__ == "__main__":
    original_server.main()
