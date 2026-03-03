"""Unit tests for ResourceGenerator."""

import pytest
from jinja2 import Environment

from abi_to_mcp.core.models import MappedResource, ResourceField
from abi_to_mcp.generator.resource_generator import ResourceGenerator
from abi_to_mcp.generator.templates import create_jinja_env


@pytest.fixture
def jinja_env():
    """Create a Jinja2 environment for testing."""
    return create_jinja_env()


@pytest.fixture
def resource_generator(jinja_env):
    """Create a ResourceGenerator instance."""
    return ResourceGenerator(jinja_env)


@pytest.fixture
def transfer_resource():
    """Create a sample Transfer event resource."""
    return MappedResource(
        name="transfer",
        original_name="Transfer",
        description="Query Transfer events from the contract.",
        uri_template="events://transfer",
        fields=[
            ResourceField(
                name="from_address",
                original_name="from",
                solidity_type="address",
                json_schema={"type": "string", "pattern": "^0x[a-fA-F0-9]{40}$"},
                description="Sender address",
                indexed=True,
            ),
            ResourceField(
                name="to",
                original_name="to",
                solidity_type="address",
                json_schema={"type": "string", "pattern": "^0x[a-fA-F0-9]{40}$"},
                description="Recipient address",
                indexed=True,
            ),
            ResourceField(
                name="value",
                original_name="value",
                solidity_type="uint256",
                json_schema={"type": "string", "pattern": "^[0-9]+$"},
                description="Transfer amount in wei",
                indexed=False,
            ),
        ],
        function_name="get_transfer_events",
    )


@pytest.fixture
def approval_resource():
    """Create a sample Approval event resource."""
    return MappedResource(
        name="approval",
        original_name="Approval",
        description="Query Approval events from the contract.",
        uri_template="events://approval",
        fields=[
            ResourceField(
                name="owner",
                original_name="owner",
                solidity_type="address",
                json_schema={"type": "string"},
                description="Token owner",
                indexed=True,
            ),
            ResourceField(
                name="spender",
                original_name="spender",
                solidity_type="address",
                json_schema={"type": "string"},
                description="Approved spender",
                indexed=True,
            ),
            ResourceField(
                name="value",
                original_name="value",
                solidity_type="uint256",
                json_schema={"type": "string"},
                description="Approved amount",
                indexed=False,
            ),
        ],
        function_name="get_approval_events",
    )


class TestResourceGenerator:
    """Tests for ResourceGenerator class."""

    def test_generate_resource(self, resource_generator, transfer_resource):
        """Generate code for a resource."""
        code = resource_generator.generate_resource(transfer_resource)
        
        assert "@mcp.tool" in code
        assert "async def get_transfer_events" in code
        assert "from_block" in code
        assert "to_block" in code
        assert "contract.events.Transfer.get_logs" in code

    def test_generate_resource_with_fields(self, resource_generator, transfer_resource):
        """Verify all fields are included in generated resource."""
        code = resource_generator.generate_resource(transfer_resource)
        
        assert "from_address" in code
        assert "to" in code
        assert "value" in code
        assert "block_number" in code
        assert "transaction_hash" in code
        assert "log_index" in code

    def test_generate_all_resources(self, resource_generator, transfer_resource, approval_resource):
        """Generate code for multiple resources."""
        resources = [transfer_resource, approval_resource]
        code = resource_generator.generate_all_resources(resources)
        
        assert "EVENT RESOURCES" in code
        assert "get_transfer_events" in code
        assert "get_approval_events" in code

    def test_generate_empty_resources(self, resource_generator):
        """Generate code for empty resources list."""
        code = resource_generator.generate_all_resources([])
        
        assert code == ""

    def test_inline_resource_generation(self, resource_generator, transfer_resource):
        """Test inline resource generation without templates."""
        code = resource_generator.generate_inline_resource(transfer_resource)
        
        assert "@mcp.resource" in code
        assert "events://transfer" in code
        assert "async def get_transfer_events" in code
        assert "List[Dict[str, Any]]" in code
        assert "from_block" in code
        assert "to_block" in code


class TestResourceGeneratorEdgeCases:
    """Edge case tests for ResourceGenerator."""

    def test_resource_with_single_field(self, resource_generator, jinja_env):
        """Test resource with single field."""
        resource = MappedResource(
            name="paused",
            original_name="Paused",
            description="Query Paused events.",
            uri_template="events://paused",
            fields=[
                ResourceField(
                    name="account",
                    original_name="account",
                    solidity_type="address",
                    json_schema={"type": "string"},
                    description="Account that triggered pause",
                    indexed=False,
                ),
            ],
            function_name="get_paused_events",
        )
        
        code = resource_generator.generate_resource(resource)
        
        assert "get_paused_events" in code
        assert "Paused" in code

    def test_resource_with_no_indexed_fields(self, resource_generator, jinja_env):
        """Test resource with no indexed fields."""
        resource = MappedResource(
            name="data_stored",
            original_name="DataStored",
            description="Query DataStored events.",
            uri_template="events://data_stored",
            fields=[
                ResourceField(
                    name="key",
                    original_name="key",
                    solidity_type="bytes32",
                    json_schema={"type": "string"},
                    description="Storage key",
                    indexed=False,
                ),
                ResourceField(
                    name="value",
                    original_name="value",
                    solidity_type="bytes",
                    json_schema={"type": "string"},
                    description="Stored value",
                    indexed=False,
                ),
            ],
            function_name="get_data_stored_events",
        )
        
        code = resource_generator.generate_resource(resource)
        
        assert "get_data_stored_events" in code

    def test_section_header(self, resource_generator):
        """Test section header generation."""
        header = resource_generator._generate_section_header("TEST SECTION")
        
        assert "TEST SECTION" in header
        assert "=" in header
