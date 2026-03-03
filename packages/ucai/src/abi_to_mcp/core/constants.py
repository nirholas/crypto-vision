"""Network configurations and type mappings for abi-to-mcp."""

from typing import Dict, Any

# =============================================================================
# Supported EVM Networks
# =============================================================================

NETWORKS: Dict[str, Dict[str, Any]] = {
    "mainnet": {
        "chain_id": 1,
        "name": "Ethereum Mainnet",
        "rpc": "https://eth.llamarpc.com",
        "explorer": "https://etherscan.io",
        "etherscan_api": "https://api.etherscan.io/api",
        "currency": "ETH",
        "is_testnet": False,
    },
    "sepolia": {
        "chain_id": 11155111,
        "name": "Sepolia Testnet",
        "rpc": "https://rpc.sepolia.org",
        "explorer": "https://sepolia.etherscan.io",
        "etherscan_api": "https://api-sepolia.etherscan.io/api",
        "currency": "ETH",
        "is_testnet": True,
    },
    "goerli": {
        "chain_id": 5,
        "name": "Goerli Testnet",
        "rpc": "https://rpc.ankr.com/eth_goerli",
        "explorer": "https://goerli.etherscan.io",
        "etherscan_api": "https://api-goerli.etherscan.io/api",
        "currency": "ETH",
        "is_testnet": True,
    },
    "polygon": {
        "chain_id": 137,
        "name": "Polygon Mainnet",
        "rpc": "https://polygon-rpc.com",
        "explorer": "https://polygonscan.com",
        "etherscan_api": "https://api.polygonscan.com/api",
        "currency": "MATIC",
        "is_testnet": False,
    },
    "arbitrum": {
        "chain_id": 42161,
        "name": "Arbitrum One",
        "rpc": "https://arb1.arbitrum.io/rpc",
        "explorer": "https://arbiscan.io",
        "etherscan_api": "https://api.arbiscan.io/api",
        "currency": "ETH",
        "is_testnet": False,
    },
    "optimism": {
        "chain_id": 10,
        "name": "Optimism Mainnet",
        "rpc": "https://mainnet.optimism.io",
        "explorer": "https://optimistic.etherscan.io",
        "etherscan_api": "https://api-optimistic.etherscan.io/api",
        "currency": "ETH",
        "is_testnet": False,
    },
    "base": {
        "chain_id": 8453,
        "name": "Base Mainnet",
        "rpc": "https://mainnet.base.org",
        "explorer": "https://basescan.org",
        "etherscan_api": "https://api.basescan.org/api",
        "currency": "ETH",
        "is_testnet": False,
    },
    "bsc": {
        "chain_id": 56,
        "name": "BNB Smart Chain",
        "rpc": "https://bsc-dataseed.binance.org",
        "explorer": "https://bscscan.com",
        "etherscan_api": "https://api.bscscan.com/api",
        "currency": "BNB",
        "is_testnet": False,
    },
    "avalanche": {
        "chain_id": 43114,
        "name": "Avalanche C-Chain",
        "rpc": "https://api.avax.network/ext/bc/C/rpc",
        "explorer": "https://snowtrace.io",
        "etherscan_api": "https://api.snowtrace.io/api",
        "currency": "AVAX",
        "is_testnet": False,
    },
    "fantom": {
        "chain_id": 250,
        "name": "Fantom Opera",
        "rpc": "https://rpc.ftm.tools",
        "explorer": "https://ftmscan.com",
        "etherscan_api": "https://api.ftmscan.com/api",
        "currency": "FTM",
        "is_testnet": False,
    },
}


# =============================================================================
# Solidity Type → JSON Schema Mapping
# =============================================================================

SOLIDITY_TO_JSON_SCHEMA: Dict[str, Dict[str, Any]] = {
    # Address
    "address": {
        "type": "string",
        "pattern": "^0x[a-fA-F0-9]{40}$",
        "description": "Ethereum address (20 bytes)",
    },
    # Unsigned Integers - small ones fit in JSON integers
    "uint8": {"type": "integer", "minimum": 0, "maximum": 255},
    "uint16": {"type": "integer", "minimum": 0, "maximum": 65535},
    "uint32": {"type": "integer", "minimum": 0, "maximum": 4294967295},
    # Unsigned Integers - large ones as strings for precision
    "uint64": {
        "type": "string",
        "pattern": "^[0-9]+$",
        "description": "Unsigned 64-bit integer as string",
    },
    "uint128": {
        "type": "string",
        "pattern": "^[0-9]+$",
        "description": "Unsigned 128-bit integer as string",
    },
    "uint256": {
        "type": "string",
        "pattern": "^[0-9]+$",
        "description": "Unsigned 256-bit integer as string (wei)",
    },
    # Default uint is uint256
    "uint": {
        "type": "string",
        "pattern": "^[0-9]+$",
        "description": "Unsigned 256-bit integer as string",
    },
    # Signed Integers - small ones fit in JSON integers
    "int8": {"type": "integer", "minimum": -128, "maximum": 127},
    "int16": {"type": "integer", "minimum": -32768, "maximum": 32767},
    "int32": {"type": "integer", "minimum": -2147483648, "maximum": 2147483647},
    # Signed Integers - large ones as strings
    "int64": {
        "type": "string",
        "pattern": "^-?[0-9]+$",
        "description": "Signed 64-bit integer as string",
    },
    "int128": {
        "type": "string",
        "pattern": "^-?[0-9]+$",
        "description": "Signed 128-bit integer as string",
    },
    "int256": {
        "type": "string",
        "pattern": "^-?[0-9]+$",
        "description": "Signed 256-bit integer as string",
    },
    # Default int is int256
    "int": {
        "type": "string",
        "pattern": "^-?[0-9]+$",
        "description": "Signed 256-bit integer as string",
    },
    # Boolean
    "bool": {"type": "boolean"},
    # String
    "string": {"type": "string"},
    # Dynamic Bytes
    "bytes": {
        "type": "string",
        "pattern": "^0x[a-fA-F0-9]*$",
        "description": "Hex-encoded bytes",
    },
    # Fixed-size Bytes
    "bytes1": {"type": "string", "pattern": "^0x[a-fA-F0-9]{2}$"},
    "bytes2": {"type": "string", "pattern": "^0x[a-fA-F0-9]{4}$"},
    "bytes3": {"type": "string", "pattern": "^0x[a-fA-F0-9]{6}$"},
    "bytes4": {
        "type": "string",
        "pattern": "^0x[a-fA-F0-9]{8}$",
        "description": "Function selector (4 bytes)",
    },
    "bytes8": {"type": "string", "pattern": "^0x[a-fA-F0-9]{16}$"},
    "bytes16": {"type": "string", "pattern": "^0x[a-fA-F0-9]{32}$"},
    "bytes20": {"type": "string", "pattern": "^0x[a-fA-F0-9]{40}$"},
    "bytes32": {
        "type": "string",
        "pattern": "^0x[a-fA-F0-9]{64}$",
        "description": "32-byte hash or identifier",
    },
}

# Generate remaining bytesN types programmatically
for n in range(1, 33):
    key = f"bytes{n}"
    if key not in SOLIDITY_TO_JSON_SCHEMA:
        SOLIDITY_TO_JSON_SCHEMA[key] = {
            "type": "string",
            "pattern": f"^0x[a-fA-F0-9]{{{n * 2}}}$",
        }

# Generate remaining uintN and intN types
for bits in [
    24,
    40,
    48,
    56,
    72,
    80,
    88,
    96,
    104,
    112,
    120,
    136,
    144,
    152,
    160,
    168,
    176,
    184,
    192,
    200,
    208,
    216,
    224,
    232,
    240,
    248,
]:
    # These are all large enough to need string representation
    SOLIDITY_TO_JSON_SCHEMA[f"uint{bits}"] = {
        "type": "string",
        "pattern": "^[0-9]+$",
        "description": f"Unsigned {bits}-bit integer as string",
    }
    SOLIDITY_TO_JSON_SCHEMA[f"int{bits}"] = {
        "type": "string",
        "pattern": "^-?[0-9]+$",
        "description": f"Signed {bits}-bit integer as string",
    }


# =============================================================================
# State Mutability → Tool Behavior Mapping
# =============================================================================

STATE_MUTABILITY_MAP = {
    "pure": {
        "requires_gas": False,
        "can_modify_state": False,
        "tool_type": "read",
        "description": "Does not read or modify state",
    },
    "view": {
        "requires_gas": False,
        "can_modify_state": False,
        "tool_type": "read",
        "description": "Reads state but does not modify",
    },
    "nonpayable": {
        "requires_gas": True,
        "can_modify_state": True,
        "tool_type": "write",
        "description": "Modifies state, does not accept ETH",
    },
    "payable": {
        "requires_gas": True,
        "can_modify_state": True,
        "tool_type": "write_payable",
        "description": "Modifies state and accepts ETH",
    },
}


# =============================================================================
# Common ERC Standards
# =============================================================================

ERC_STANDARDS = {
    "ERC20": {
        "name": "ERC-20 Token Standard",
        "functions": [
            "name",
            "symbol",
            "decimals",
            "totalSupply",
            "balanceOf",
            "transfer",
            "approve",
            "allowance",
            "transferFrom",
        ],
        "events": ["Transfer", "Approval"],
        "required_functions": ["totalSupply", "balanceOf", "transfer"],
    },
    "ERC721": {
        "name": "ERC-721 Non-Fungible Token Standard",
        "functions": [
            "name",
            "symbol",
            "tokenURI",
            "balanceOf",
            "ownerOf",
            "approve",
            "getApproved",
            "setApprovalForAll",
            "isApprovedForAll",
            "transferFrom",
            "safeTransferFrom",
        ],
        "events": ["Transfer", "Approval", "ApprovalForAll"],
        "required_functions": ["balanceOf", "ownerOf"],
    },
    "ERC1155": {
        "name": "ERC-1155 Multi Token Standard",
        "functions": [
            "uri",
            "balanceOf",
            "balanceOfBatch",
            "setApprovalForAll",
            "isApprovedForAll",
            "safeTransferFrom",
            "safeBatchTransferFrom",
        ],
        "events": ["TransferSingle", "TransferBatch", "ApprovalForAll", "URI"],
        "required_functions": ["balanceOf", "balanceOfBatch"],
    },
    "ERC4626": {
        "name": "ERC-4626 Tokenized Vault Standard",
        "functions": [
            "asset",
            "totalAssets",
            "convertToShares",
            "convertToAssets",
            "maxDeposit",
            "previewDeposit",
            "deposit",
            "maxMint",
            "previewMint",
            "mint",
            "maxWithdraw",
            "previewWithdraw",
            "withdraw",
            "maxRedeem",
            "previewRedeem",
            "redeem",
        ],
        "events": ["Deposit", "Withdraw"],
        "required_functions": ["asset", "totalAssets", "deposit", "withdraw"],
    },
}


# =============================================================================
# Default Gas Limits by Operation Type
# =============================================================================

DEFAULT_GAS_LIMITS = {
    "transfer": 65000,
    "approve": 50000,
    "transferFrom": 80000,
    "swap": 250000,
    "addLiquidity": 300000,
    "removeLiquidity": 250000,
    "mint": 150000,
    "burn": 100000,
    "stake": 150000,
    "unstake": 150000,
    "claim": 100000,
    "deposit": 150000,
    "withdraw": 150000,
    "default": 200000,
}


# =============================================================================
# Python Type Mappings
# =============================================================================

SOLIDITY_TO_PYTHON_TYPE = {
    "address": "str",
    "bool": "bool",
    "string": "str",
    "bytes": "str",
    "uint8": "int",
    "uint16": "int",
    "uint32": "int",
    "uint64": "str",
    "uint128": "str",
    "uint256": "str",
    "uint": "str",
    "int8": "int",
    "int16": "int",
    "int32": "int",
    "int64": "str",
    "int128": "str",
    "int256": "str",
    "int": "str",
}

# Add remaining types
for n in range(1, 33):
    SOLIDITY_TO_PYTHON_TYPE[f"bytes{n}"] = "str"


# =============================================================================
# Proxy Contract Detection
# =============================================================================

# EIP-1967 storage slots for proxy detection
PROXY_STORAGE_SLOTS = {
    "implementation": "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
    "admin": "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103",
    "beacon": "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50",
}

# EIP-1167 minimal proxy bytecode prefix
MINIMAL_PROXY_PREFIX = "0x363d3d373d3d3d363d73"
