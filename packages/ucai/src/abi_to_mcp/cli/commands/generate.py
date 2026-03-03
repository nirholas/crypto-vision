"""Generate command implementation."""

import asyncio
from pathlib import Path
from typing import Optional

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich import print as rprint

from abi_to_mcp.core.exceptions import ABIToMCPError
from abi_to_mcp.utils.validation import is_valid_address

console = Console()


def generate(
    source: str,
    output: Path,
    network: str,
    contract_address: Optional[str],
    name: Optional[str],
    read_only: bool,
    include_events: bool,
    simulation_default: bool,
) -> None:
    """Generate an MCP server from an ABI."""
    asyncio.run(
        _generate_async(
            source=source,
            output=output,
            network=network,
            contract_address=contract_address,
            name=name,
            read_only=read_only,
            include_events=include_events,
            simulation_default=simulation_default,
        )
    )


async def _generate_async(
    source: str,
    output: Path,
    network: str,
    contract_address: Optional[str],
    name: Optional[str],
    read_only: bool,
    include_events: bool,
    simulation_default: bool,
) -> None:
    """Async implementation."""
    try:
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            # Import here to avoid circular dependencies
            from abi_to_mcp.fetchers import create_default_registry
            from abi_to_mcp.parser import ABIParser
            from abi_to_mcp.mapper import TypeMapper, FunctionMapper, EventMapper
            from abi_to_mcp.generator import MCPGenerator

            # Step 1: Fetch
            task = progress.add_task("Fetching ABI...", total=None)
            registry = create_default_registry()

            if is_valid_address(source):
                fetch_result = await registry.fetch(source, network=network)
                contract_address = contract_address or source
            else:
                fetch_result = await registry.fetch(source)
                if not contract_address:
                    rprint("[yellow]Warning: No contract address - using placeholder[/yellow]")
                    contract_address = "0x0000000000000000000000000000000000000000"

            progress.update(task, description="✓ ABI fetched")

            # Step 2: Parse
            task = progress.add_task("Parsing ABI...", total=None)
            parser = ABIParser()
            parsed = parser.parse(fetch_result.abi)
            progress.update(task, description=f"✓ Parsed {len(parsed.functions)} functions")

            # Step 3: Map
            task = progress.add_task("Mapping to MCP...", total=None)
            type_mapper = TypeMapper()
            func_mapper = FunctionMapper(type_mapper)
            event_mapper = EventMapper(type_mapper)

            functions = [f for f in parsed.functions if not read_only or f.is_read_only]
            tools = [func_mapper.map_function(f) for f in functions]
            resources = [event_mapper.map_event(e) for e in parsed.events] if include_events else []

            progress.update(task, description=f"✓ Mapped {len(tools)} tools")

            # Step 4: Generate
            task = progress.add_task("Generating server...", total=None)

            if name is None:
                name = fetch_result.contract_name or parsed.detected_standard or "Contract"

            generator = MCPGenerator()
            server = generator.generate(
                parsed=parsed,
                tools=tools,
                resources=resources,
                contract_address=contract_address,
                network=network,
                contract_name=name,
            )

            progress.update(task, description="✓ Server generated")

            # Step 5: Write
            task = progress.add_task("Writing files...", total=None)
            output.mkdir(parents=True, exist_ok=True)

            for file in server.files:
                file_path = output / file.path
                file_path.parent.mkdir(parents=True, exist_ok=True)
                file_path.write_text(file.content)

            progress.update(task, description=f"✓ Wrote {len(server.files)} files")

        # Success
        rprint()
        rprint("[bold green]✓ MCP server generated successfully![/bold green]")
        rprint()
        rprint(f"[bold]Output:[/bold] {output}")
        rprint(f"[bold]Tools:[/bold] {len(tools)}")
        rprint(f"[bold]Resources:[/bold] {len(resources)}")
        rprint()
        rprint("[bold]Next steps:[/bold]")
        rprint(f"  cd {output}")
        rprint("  pip install -r requirements.txt")
        rprint("  python server.py")
        rprint()

    except ABIToMCPError as e:
        rprint(f"[bold red]Error:[/bold red] {e.message}")
        raise SystemExit(1) from None
    except Exception as e:
        rprint(f"[bold red]Error:[/bold red] {e}")
        raise SystemExit(1) from None
