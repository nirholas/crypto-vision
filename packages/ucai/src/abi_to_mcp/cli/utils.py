"""CLI utilities and helpers."""

import sys
from typing import Optional
from rich.console import Console

console = Console()


def handle_error(error: Exception, verbose: bool = False) -> None:
    """
    Handle CLI errors with consistent formatting.

    Args:
        error: Exception to handle
        verbose: Show full traceback
    """
    console.print(f"\n[bold red]Error:[/bold red] {error}")

    if verbose:
        import traceback

        console.print("\n[dim]Traceback:[/dim]")
        console.print(traceback.format_exc())

    sys.exit(1)


def confirm(message: str, default: bool = False) -> bool:
    """
    Ask for user confirmation.

    Args:
        message: Confirmation message
        default: Default value

    Returns:
        True if confirmed
    """
    default_str = "Y/n" if default else "y/N"
    response = console.input(f"{message} [{default_str}]: ").strip().lower()

    if not response:
        return default

    return response in ("y", "yes")
