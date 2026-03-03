"""Serve command implementation."""

import subprocess
import sys
from pathlib import Path

from rich.console import Console
from rich import print as rprint

console = Console()


def serve(directory: Path, port: int, transport: str = "stdio") -> None:
    """
    Run the serve command.

    Starts a generated MCP server in the specified directory.
    Supports stdio (default) and HTTP transport modes.

    Args:
        directory: Directory containing generated server
        port: Port for HTTP transport
        transport: Transport mode ("stdio" or "http")
    """
    # Find server.py
    server_path = directory / "server.py"

    if not server_path.exists():
        rprint(f"[red]Error:[/red] server.py not found in {directory}")
        rprint("Make sure you're in a generated MCP server directory.")
        raise SystemExit(1)

    # Check for requirements
    requirements_path = directory / "requirements.txt"
    if requirements_path.exists():
        rprint("[blue]ℹ[/blue] Checking dependencies...")
        # We don't auto-install, just warn
        rprint(f"  Make sure to run: pip install -r {requirements_path}")

    # Check for .env
    env_path = directory / ".env"
    if not env_path.exists():
        env_example = directory / ".env.example"
        if env_example.exists():
            rprint("[yellow]Warning:[/yellow] No .env file found.")
            rprint(f"  Copy {env_example} to .env and configure your settings.")

    rprint("")
    rprint("[bold]Starting MCP server...[/bold]")
    rprint(f"  Directory: {directory}")
    rprint(f"  Transport: {transport}")
    if transport == "http":
        rprint(f"  Port: {port}")
    rprint("")

    # Build command
    if transport == "stdio":
        cmd = [sys.executable, str(server_path)]
    elif transport == "http":
        # For HTTP transport, we need to pass additional args
        # This depends on how the generated server handles transport
        cmd = [sys.executable, str(server_path), "--transport", "http", "--port", str(port)]
    else:
        rprint(f"[red]Error:[/red] Unknown transport: {transport}")
        raise SystemExit(1)

    try:
        # Run the server
        # For stdio, we just exec and let it take over
        # For http, we run and display the URL
        if transport == "http":
            rprint(f"[green]Server running at http://localhost:{port}[/green]")
            rprint("Press Ctrl+C to stop")
            rprint("")

        process = subprocess.run(
            cmd,
            cwd=directory,
            # Don't capture output - let it flow through
        )

        if process.returncode != 0:
            raise SystemExit(process.returncode)

    except KeyboardInterrupt:
        rprint("")
        rprint("[yellow]Server stopped[/yellow]")
    except Exception as e:
        rprint(f"[red]Error:[/red] {e}")
        raise SystemExit(1) from None
