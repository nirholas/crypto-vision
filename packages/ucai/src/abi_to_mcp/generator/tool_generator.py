"""Tool generator module.

Generates MCP tool code from mapped function definitions.
"""

from jinja2 import Environment

from abi_to_mcp.core.models import MappedTool


class ToolGenerator:
    """Generate MCP tool code from mapped functions.

    This class takes MappedTool objects (produced by FunctionMapper) and
    generates Python code that can be used in an MCP server.

    Example:
        >>> from jinja2 import Environment
        >>> env = Environment()
        >>> generator = ToolGenerator(env)
        >>> tool = MappedTool(name="balance_of", ...)
        >>> code = generator.generate_tool(tool)
        >>> print(code)  # Python function code
    """

    def __init__(self, jinja_env: Environment):
        """Initialize the ToolGenerator.

        Args:
            jinja_env: Jinja2 environment for template rendering
        """
        self.env = jinja_env
        self._tool_template = None

    @property
    def tool_template(self):
        """Lazy-load the tool template."""
        if self._tool_template is None:
            self._tool_template = self.env.get_template("tool.py.jinja2")
        return self._tool_template

    def generate_tool(self, tool: MappedTool) -> str:
        """Generate Python code for a single MCP tool.

        Args:
            tool: The mapped tool definition

        Returns:
            Python code string for the tool function
        """
        return self.tool_template.render(
            tool=tool,
            is_read=tool.tool_type == "read",
            is_write=tool.tool_type == "write",
            is_payable=tool.tool_type == "write_payable",
        )

    def generate_all_tools(self, tools: list[MappedTool]) -> str:
        """Generate code for all tools.

        Args:
            tools: List of mapped tools

        Returns:
            Combined Python code for all tools
        """
        read_tools = [t for t in tools if t.tool_type == "read"]
        write_tools = [t for t in tools if t.tool_type in ("write", "write_payable")]

        sections = []

        if read_tools:
            sections.append(self._generate_section_header("READ FUNCTIONS", "No gas required"))
            for tool in read_tools:
                sections.append(self.generate_tool(tool))

        if write_tools:
            sections.append(
                self._generate_section_header(
                    "WRITE FUNCTIONS", "Require gas, simulation by default"
                )
            )
            for tool in write_tools:
                sections.append(self.generate_tool(tool))

        return "\n\n".join(sections)

    def _generate_section_header(self, title: str, subtitle: str = "") -> str:
        """Generate a section header comment."""
        lines = [
            "# " + "=" * 77,
            f"# {title}",
        ]
        if subtitle:
            lines.append(f"# ({subtitle})")
        lines.append("# " + "=" * 77)
        return "\n".join(lines)

    def generate_inline_tool(self, tool: MappedTool) -> str:
        """Generate tool code without using templates (for testing).

        This method generates tool code directly without Jinja2,
        useful for testing and simple use cases.

        Args:
            tool: The mapped tool definition

        Returns:
            Python code string for the tool function
        """
        lines = []

        # Decorator
        lines.append("@mcp.tool()")

        # Function signature
        params = self._build_param_list(tool)
        return_type = self._get_return_type(tool)
        lines.append(f"def {tool.name}({params}) -> {return_type}:")

        # Docstring
        lines.append('    """')
        lines.append(f"    {tool.description}")

        if tool.parameters:
            lines.append("")
            lines.append("    Args:")
            for param in tool.parameters:
                lines.append(f"        {param.name}: {param.description}")

        lines.append("")
        lines.append("    Returns:")
        lines.append(f"        {tool.return_description}")
        lines.append('    """')

        # Body
        if tool.tool_type == "read":
            lines.extend(self._generate_read_body(tool))
        else:
            lines.extend(self._generate_write_body(tool))

        return "\n".join(lines)

    def _build_param_list(self, tool: MappedTool) -> str:
        """Build the function parameter list string."""
        parts = []

        for param in tool.parameters:
            parts.append(f"{param.name}: {param.python_type}")

        if tool.tool_type == "write_payable":
            parts.append('value_wei: str = "0"')

        if tool.tool_type in ("write", "write_payable"):
            parts.append("simulate: bool = True")

        return ", ".join(parts)

    def _get_return_type(self, tool: MappedTool) -> str:
        """Get the return type annotation."""
        if tool.tool_type == "read":
            # Determine from return schema
            schema_type = tool.return_schema.get("type", "Any")
            type_map = {
                "string": "str",
                "integer": "int",
                "boolean": "bool",
                "array": "List",
                "object": "Dict[str, Any]",
            }
            return type_map.get(schema_type, "Any")
        else:
            return "Dict[str, Any]"

    def _generate_read_body(self, tool: MappedTool) -> list[str]:
        """Generate body for a read-only tool."""
        lines = []

        if tool.parameters:
            args = ", ".join(p.name for p in tool.parameters)
            lines.append(f"    result = contract.functions.{tool.original_name}({args}).call()")
        else:
            lines.append(f"    result = contract.functions.{tool.original_name}().call()")

        lines.append("    return result")
        return lines

    def _generate_write_body(self, tool: MappedTool) -> list[str]:
        """Generate body for a write tool with simulation support."""
        lines = []

        # Read-only mode check
        lines.append("    if READ_ONLY_MODE:")
        lines.append(
            '        return {"error": "Server is in read-only mode. Write operations disabled."}'
        )
        lines.append("")

        # Get signer
        lines.append("    signer = _get_signer()")
        lines.append("")

        # Build transaction params
        lines.append("    # Build transaction")
        lines.append("    tx_params = {")
        lines.append('        "from": signer.address,')
        lines.append('        "nonce": w3.eth.get_transaction_count(signer.address),')
        lines.append('        "gas": 0,')
        lines.append('        "gasPrice": w3.eth.gas_price,')
        if tool.tool_type == "write_payable":
            lines.append('        "value": int(value_wei),')
        lines.append("    }")
        lines.append("")

        # Build function call
        if tool.parameters:
            args = ", ".join(p.name for p in tool.parameters)
            lines.append(f"    func = contract.functions.{tool.original_name}({args})")
        else:
            lines.append(f"    func = contract.functions.{tool.original_name}()")
        lines.append("")

        lines.append("    tx = func.build_transaction(tx_params)")
        lines.append("    tx['gas'] = _estimate_gas(tx)")
        lines.append("")

        # Simulation branch
        lines.append("    if simulate:")
        lines.append("        # Simulation only - does not execute")
        lines.append("        try:")
        if tool.tool_type == "write_payable":
            lines.append(
                '            result = func.call({"from": signer.address, "value": int(value_wei)})'
            )
        else:
            lines.append('            result = func.call({"from": signer.address})')
        lines.append("            return {")
        lines.append('                "simulated": True,')
        lines.append('                "success": True,')
        lines.append('                "result": result,')
        lines.append('                "estimated_gas": tx["gas"],')
        lines.append(
            '                "gas_price_gwei": float(w3.from_wei(tx["gasPrice"], "gwei")),'
        )
        lines.append(
            '                "estimated_cost_eth": float(w3.from_wei(tx["gas"] * tx["gasPrice"], "ether")),'
        )
        lines.append(
            '                "note": "This was a simulation. Set simulate=False to execute for real."'
        )
        lines.append("            }")
        lines.append("        except Exception as e:")
        lines.append("            return {")
        lines.append('                "simulated": True,')
        lines.append('                "success": False,')
        lines.append('                "error": str(e),')
        lines.append(
            '                "note": "Simulation failed. The transaction would likely revert."'
        )
        lines.append("            }")
        lines.append("")

        # Execute branch
        lines.append("    # Execute transaction for real")
        lines.append("    signed = w3.eth.account.sign_transaction(tx, PRIVATE_KEY)")
        lines.append("    tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)")
        lines.append("    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)")
        lines.append("")
        lines.append("    return {")
        lines.append('        "simulated": False,')
        lines.append('        "success": receipt.status == 1,')
        lines.append('        "tx_hash": receipt.transactionHash.hex(),')
        lines.append('        "block_number": receipt.blockNumber,')
        lines.append('        "gas_used": receipt.gasUsed,')
        lines.append('        "effective_gas_price": receipt.effectiveGasPrice,')
        lines.append(
            '        "cost_eth": float(w3.from_wei(receipt.gasUsed * receipt.effectiveGasPrice, "ether")),'
        )
        lines.append("    }")

        return lines
