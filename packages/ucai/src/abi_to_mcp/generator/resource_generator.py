"""Resource generator module.

Generates MCP resource code from mapped event definitions.
"""

from jinja2 import Environment

from abi_to_mcp.core.models import MappedResource


class ResourceGenerator:
    """Generate MCP resource code from mapped events.

    This class takes MappedResource objects (produced by EventMapper) and
    generates Python code that can be used in an MCP server to provide
    event log data as resources.

    Example:
        >>> from jinja2 import Environment
        >>> env = Environment()
        >>> generator = ResourceGenerator(env)
        >>> resource = MappedResource(name="transfer", ...)
        >>> code = generator.generate_resource(resource)
        >>> print(code)  # Python function code
    """

    def __init__(self, jinja_env: Environment):
        """Initialize the ResourceGenerator.

        Args:
            jinja_env: Jinja2 environment for template rendering
        """
        self.env = jinja_env
        self._resource_template = None

    @property
    def resource_template(self):
        """Lazy-load the resource template."""
        if self._resource_template is None:
            self._resource_template = self.env.get_template("resource.py.jinja2")
        return self._resource_template

    def generate_resource(self, resource: MappedResource) -> str:
        """Generate Python code for a single MCP resource.

        Args:
            resource: The mapped resource definition

        Returns:
            Python code string for the resource function
        """
        return self.resource_template.render(
            resource=resource,
            indexed_fields=[f for f in resource.fields if f.indexed],
            data_fields=[f for f in resource.fields if not f.indexed],
        )

    def generate_all_resources(self, resources: list[MappedResource]) -> str:
        """Generate code for all resources.

        Args:
            resources: List of mapped resources

        Returns:
            Combined Python code for all resources
        """
        if not resources:
            return ""

        sections = []
        sections.append(self._generate_section_header("EVENT RESOURCES"))

        for resource in resources:
            sections.append(self.generate_resource(resource))

        return "\n\n".join(sections)

    def _generate_section_header(self, title: str) -> str:
        """Generate a section header comment."""
        return "\n".join(
            [
                "# " + "=" * 77,
                f"# {title}",
                "# " + "=" * 77,
            ]
        )

    def generate_inline_resource(self, resource: MappedResource) -> str:
        """Generate resource code without using templates (for testing).

        This method generates resource code directly without Jinja2,
        useful for testing and simple use cases.

        Args:
            resource: The mapped resource definition

        Returns:
            Python code string for the resource function
        """
        lines = []

        # Decorator
        lines.append(f'@mcp.resource("{resource.uri_template}")')

        # Function signature
        lines.append(f"async def {resource.function_name}(")
        lines.append("    from_block: int = None,")
        lines.append("    to_block: int = None")
        lines.append(") -> List[Dict[str, Any]]:")

        # Docstring
        lines.append('    """')
        lines.append(f"    {resource.description}")
        lines.append("")
        lines.append("    Args:")
        lines.append("        from_block: Starting block (default: latest - 1000)")
        lines.append("        to_block: Ending block (default: latest)")
        lines.append("")
        lines.append("    Returns:")
        lines.append(f"        List of {resource.original_name} events with transaction details")
        lines.append('    """')

        # Body
        lines.append("    if from_block is None:")
        lines.append("        from_block = max(0, w3.eth.block_number - 1000)")
        lines.append("    if to_block is None:")
        lines.append('        to_block = "latest"')
        lines.append("")
        lines.append(f"    events = contract.events.{resource.original_name}.get_logs(")
        lines.append("        fromBlock=from_block,")
        lines.append("        toBlock=to_block")
        lines.append("    )")
        lines.append("")

        # Return statement with field mapping
        lines.append("    return [")
        lines.append("        {")
        for field in resource.fields:
            lines.append(f'            "{field.name}": event.args.get("{field.original_name}"),')
        lines.append('            "block_number": event.blockNumber,')
        lines.append('            "transaction_hash": event.transactionHash.hex(),')
        lines.append('            "log_index": event.logIndex,')
        lines.append("        }")
        lines.append("        for event in events")
        lines.append("    ]")

        return "\n".join(lines)
