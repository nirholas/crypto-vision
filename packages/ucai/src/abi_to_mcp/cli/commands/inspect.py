"""Inspect command - Show ABI details."""

import asyncio
from rich.console import Console
from rich.table import Table
from rich import print as rprint

from abi_to_mcp.core.exceptions import ABIToMCPError
from abi_to_mcp.utils.validation import is_valid_address

console = Console()


def inspect(source: str, network: str) -> None:
    """Inspect an ABI and show details."""
    asyncio.run(_inspect_async(source, network))


async def _inspect_async(source: str, network: str) -> None:
    """Async implementation."""
    try:
        from abi_to_mcp.fetchers import create_default_registry
        from abi_to_mcp.parser import ABIParser

        rprint(f"\n[bold]Inspecting:[/bold] {source}\n")

        # Fetch
        registry = create_default_registry()
        if is_valid_address(source):
            fetch_result = await registry.fetch(source, network=network)
        else:
            fetch_result = await registry.fetch(source)

        rprint(f"[blue]Source:[/blue] {fetch_result.source}")
        if fetch_result.contract_name:
            rprint(f"[blue]Name:[/blue] {fetch_result.contract_name}")
        rprint()

        # Parse
        parser = ABIParser()
        parsed = parser.parse(fetch_result.abi)

        if parsed.detected_standard:
            rprint(f"[green]Standard:[/green] {parsed.detected_standard}")
            rprint()

        # Functions
        func_table = Table(title="Functions")
        func_table.add_column("Name", style="cyan")
        func_table.add_column("Type", style="magenta")
        func_table.add_column("Inputs")

        for func in parsed.functions:
            func_type = "read" if func.is_read_only else ("payable" if func.is_payable else "write")
            inputs = ", ".join(inp.type for inp in func.inputs) or "-"
            func_table.add_row(func.name, func_type, inputs)

        console.print(func_table)
        rprint()

        # Events
        if parsed.events:
            event_table = Table(title="Events")
            event_table.add_column("Name", style="cyan")
            event_table.add_column("Parameters")

            for event in parsed.events:
                params = ", ".join(f"{p.name}:{p.type}" for p in event.inputs)
                event_table.add_row(event.name, params or "-")

            console.print(event_table)
            rprint()

        # Summary
        read_funcs = sum(1 for f in parsed.functions if f.is_read_only)
        write_funcs = len(parsed.functions) - read_funcs

        rprint("[bold]Summary:[/bold]")
        rprint(f"  Functions: {len(parsed.functions)} ({read_funcs} read, {write_funcs} write)")
        rprint(f"  Events: {len(parsed.events)}")
        rprint(f"  Errors: {len(parsed.errors)}")
        rprint()

    except ABIToMCPError as e:
        rprint(f"[bold red]Error:[/bold red] {e.message}")
        raise SystemExit(1) from None
    except Exception as e:
        rprint(f"[bold red]Error:[/bold red] {e}")
        raise SystemExit(1) from None
