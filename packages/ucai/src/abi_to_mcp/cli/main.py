"""Main CLI application for UCAI (abi-to-mcp).

This module defines the Typer CLI application with all commands.
"""

import typer
from typing import Optional
from pathlib import Path
from rich.console import Console
from rich.table import Table
from rich import print as rprint

from abi_to_mcp.version import __version__

# Initialize Typer app
app = typer.Typer(
    name="abi-to-mcp",
    help="UCAI - The ABI-to-MCP Server Generator",
    add_completion=False,
    no_args_is_help=True,
)

console = Console()


def version_callback(value: bool):
    """Print version and exit."""
    if value:
        rprint(f"[bold blue]UCAI[/bold blue] version [green]{__version__}[/green]")
        raise typer.Exit()


@app.callback()
def main_callback(
    version: bool = typer.Option(
        False,
        "--version",
        "-v",
        help="Show version and exit",
        callback=version_callback,
        is_eager=True,
    ),
):
    """
    UCAI - The ABI-to-MCP Server Generator.

    Generate complete, production-ready MCP servers from any smart contract ABI.
    Supports local files, Etherscan, and Sourcify as ABI sources.
    """
    pass


@app.command()
def generate(
    source: str = typer.Argument(
        ...,
        help="ABI source: file path or contract address (0x...)",
    ),
    output: Path = typer.Option(
        Path("./mcp-server"),
        "--output",
        "-o",
        help="Output directory for generated server",
    ),
    network: str = typer.Option(
        "mainnet",
        "--network",
        "-n",
        help="Network for contract lookups (mainnet, polygon, arbitrum, etc.)",
    ),
    address: Optional[str] = typer.Option(
        None,
        "--address",
        "-a",
        help="Contract address (required if source is a file)",
    ),
    name: Optional[str] = typer.Option(
        None,
        "--name",
        help="Server name (auto-detected if not provided)",
    ),
    read_only: bool = typer.Option(
        False,
        "--read-only",
        help="Only generate read operations (no write tools)",
    ),
    include_events: bool = typer.Option(
        True,
        "--events/--no-events",
        help="Include events as MCP resources",
    ),
    simulation_default: bool = typer.Option(
        True,
        "--simulate/--no-simulate",
        help="Default simulation mode for write operations",
    ),
    force: bool = typer.Option(
        False,
        "--force",
        "-f",
        help="Overwrite output directory if it exists",
    ),
):
    """
    Generate an MCP server from a smart contract ABI.

    EXAMPLES:

        # From local ABI file
        abi-to-mcp generate ./token.json -a 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48

        # From Etherscan (mainnet)
        abi-to-mcp generate 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48

        # From Etherscan (Polygon)
        abi-to-mcp generate 0x... -n polygon

        # Read-only mode
        abi-to-mcp generate ./abi.json -a 0x... --read-only

        # Custom output directory
        abi-to-mcp generate ./abi.json -a 0x... -o ./my-mcp-server
    """
    from abi_to_mcp.cli.commands import generate as cmd_generate

    cmd_generate(
        source=source,
        output=output,
        network=network,
        contract_address=address,
        name=name,
        read_only=read_only,
        include_events=include_events,
        simulation_default=simulation_default,
    )


@app.command()
def inspect(
    source: str = typer.Argument(
        ...,
        help="ABI source: file path or contract address",
    ),
    network: str = typer.Option(
        "mainnet",
        "--network",
        "-n",
        help="Network for contract lookups",
    ),
):
    """
    Inspect an ABI and show what would be generated.

    Shows detected standard, functions, events, and estimated tool count
    without generating any files.

    EXAMPLES:

        abi-to-mcp inspect ./token.json

        abi-to-mcp inspect 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
    """
    from abi_to_mcp.cli.commands import inspect as cmd_inspect

    cmd_inspect(source=source, network=network)


@app.command()
def validate(
    source: str = typer.Argument(
        ...,
        help="ABI source: file path",
    ),
    strict: bool = typer.Option(
        False,
        "--strict",
        help="Enable strict validation (check for duplicates, unnamed params)",
    ),
):
    """
    Validate an ABI without generating.

    Checks JSON structure, ABI format validity, and type recognition.

    EXAMPLES:

        abi-to-mcp validate ./token.json

        abi-to-mcp validate ./token.json --strict
    """
    from abi_to_mcp.cli.commands import validate as cmd_validate

    cmd_validate(source=source, strict=strict)


@app.command()
def serve(
    directory: Path = typer.Argument(
        Path("."),
        help="Directory containing generated server",
    ),
    port: int = typer.Option(
        8080,
        "--port",
        "-p",
        help="Port for HTTP transport",
    ),
    transport: str = typer.Option(
        "stdio",
        "--transport",
        "-t",
        help="Transport mode: stdio (default) or http",
    ),
):
    """
    Run a generated MCP server.

    EXAMPLES:

        # Run in current directory (stdio mode)
        abi-to-mcp serve

        # Run specific directory
        abi-to-mcp serve ./my-mcp-server

        # Run with HTTP transport
        abi-to-mcp serve --transport http --port 8080
    """
    from abi_to_mcp.cli.commands import serve as cmd_serve

    cmd_serve(directory=directory, port=port, transport=transport)


@app.command()
def networks():
    """
    List all supported networks.
    """
    from abi_to_mcp.core.constants import NETWORKS

    table = Table(title="Supported Networks")
    table.add_column("Network ID", style="cyan")
    table.add_column("Name", style="green")
    table.add_column("Chain ID", style="yellow")
    table.add_column("Explorer", style="blue")

    for net_id, config in NETWORKS.items():
        table.add_row(
            net_id,
            config["name"],
            str(config["chain_id"]),
            config["explorer"],
        )

    console.print(table)


def main():
    """Main entry point."""
    app()


if __name__ == "__main__":
    main()
