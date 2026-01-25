"""
XTools API Module - REST API for X/Twitter automation.

Provides a FastAPI-based REST API for all XTools functionality.
"""

from __future__ import annotations

from xtools.api.server import app, create_app

__all__ = ["app", "create_app"]
