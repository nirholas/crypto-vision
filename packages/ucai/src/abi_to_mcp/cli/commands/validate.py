"""Validate command implementation."""

import json
from pathlib import Path
from rich.console import Console
from rich import print as rprint

from abi_to_mcp.core.exceptions import ABIToMCPError

console = Console()


def validate(source: str, strict: bool = False) -> None:
    """
    Run the validate command.

    Performs validation checks:
    1. Valid JSON structure
    2. Valid ABI array format
    3. All entry types recognized
    4. All Solidity types recognized
    5. (Strict) No duplicate function signatures
    6. (Strict) All parameters have names

    Args:
        source: Path to ABI file
        strict: Enable strict validation checks
    """
    try:
        path = Path(source)

        if not path.exists():
            rprint(f"[red]Error:[/red] File not found: {source}")
            raise SystemExit(1)

        if not path.is_file():
            rprint(f"[red]Error:[/red] Not a file: {source}")
            raise SystemExit(1)

        rprint(f"[bold]Validating:[/bold] {source}")
        rprint("")

        errors = []
        warnings = []

        # Step 1: Valid JSON
        try:
            with open(path) as f:
                data = json.load(f)
            rprint("[green]✓[/green] Valid JSON")
        except json.JSONDecodeError as e:
            rprint(f"[red]✗[/red] Invalid JSON: {e}")
            raise SystemExit(1) from None

        # Step 2: Valid array or extract ABI
        abi = None
        if isinstance(data, list):
            abi = data
            rprint("[green]✓[/green] ABI is array format")
        elif isinstance(data, dict):
            if "abi" in data:
                abi = data["abi"]
                rprint("[green]✓[/green] ABI extracted from artifact format")
            else:
                rprint("[red]✗[/red] Object does not contain 'abi' key")
                raise SystemExit(1)
        else:
            rprint("[red]✗[/red] Expected array or object with 'abi' key")
            raise SystemExit(1)

        if not abi:
            rprint("[red]✗[/red] ABI is empty")
            raise SystemExit(1)

        rprint(f"[blue]ℹ[/blue] Found {len(abi)} entries")

        # Step 3: Validate entries
        from abi_to_mcp.parser.abi_parser import ABIParser

        parser = ABIParser()
        validation_errors = parser.validate(abi)

        if validation_errors:
            for err in validation_errors:
                errors.append(err)
                rprint(f"[red]✗[/red] {err}")
        else:
            rprint("[green]✓[/green] All entries valid")

        # Step 4: Type recognition
        from abi_to_mcp.mapper.type_mapper import TypeMapper

        type_mapper = TypeMapper()
        unknown_types = set()

        for entry in abi:
            if entry.get("type") in ("function", "event", "error", "constructor"):
                for param in entry.get("inputs", []) + entry.get("outputs", []):
                    param_type = param.get("type", "")
                    try:
                        type_mapper.parse_type(param_type, param.get("components"))
                    except Exception:
                        unknown_types.add(param_type)

        if unknown_types:
            for t in unknown_types:
                warnings.append(f"Unknown type: {t}")
                rprint(f"[yellow]![/yellow] Unknown type: {t}")
        else:
            rprint("[green]✓[/green] All types recognized")

        # Step 5: Strict checks
        if strict:
            rprint("")
            rprint("[bold]Strict checks:[/bold]")

            # Check for duplicate function signatures
            signatures = []
            duplicates = []
            for entry in abi:
                if entry.get("type") == "function":
                    name = entry.get("name", "")
                    inputs = tuple(p.get("type", "") for p in entry.get("inputs", []))
                    sig = (name, inputs)
                    if sig in signatures:
                        duplicates.append(f"{name}({','.join(inputs)})")
                    signatures.append(sig)

            if duplicates:
                for dup in duplicates:
                    warnings.append(f"Duplicate function: {dup}")
                    rprint(f"[yellow]![/yellow] Duplicate function: {dup}")
            else:
                rprint("[green]✓[/green] No duplicate functions")

            # Check for unnamed parameters
            unnamed = []
            for entry in abi:
                if entry.get("type") in ("function", "event"):
                    for i, param in enumerate(entry.get("inputs", [])):
                        if not param.get("name"):
                            unnamed.append(f"{entry.get('name', 'unknown')}.input[{i}]")

            if unnamed:
                for u in unnamed[:5]:  # Show first 5
                    warnings.append(f"Unnamed parameter: {u}")
                    rprint(f"[yellow]![/yellow] Unnamed parameter: {u}")
                if len(unnamed) > 5:
                    rprint(f"[yellow]![/yellow] ... and {len(unnamed) - 5} more")
            else:
                rprint("[green]✓[/green] All parameters named")

        # Summary
        rprint("")
        if errors:
            rprint(f"[red]Validation failed with {len(errors)} error(s)[/red]")
            raise SystemExit(1)
        elif warnings:
            rprint(f"[yellow]Validation passed with {len(warnings)} warning(s)[/yellow]")
        else:
            rprint("[green]Validation passed![/green]")

    except SystemExit:
        raise
    except Exception as e:
        rprint(f"[red]Error:[/red] {e}")
        raise SystemExit(1) from None
