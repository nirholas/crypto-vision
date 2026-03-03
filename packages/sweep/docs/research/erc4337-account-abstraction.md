# ERC-4337 Account Abstraction - Comprehensive Technical Documentation

## Overview

ERC-4337 (Account Abstraction) enables smart contract wallets to be used as primary accounts on Ethereum without requiring protocol-level changes. It introduces a new transaction type called `UserOperation` that is processed by a decentralized network of bundlers who submit them to the `EntryPoint` contract.

---

## 1. Specification: UserOperation Structure & EntryPoint Interface

### 1.1 UserOperation Structure (v0.7+)

The v0.7+ version uses a **PackedUserOperation** format with gas fields packed for efficiency:

```solidity
// PackedUserOperation.sol
struct PackedUserOperation {
    address sender;              // Account making the operation
    uint256 nonce;               // Anti-replay parameter (key-value based)
    bytes initCode;              // Factory address (20 bytes) + factory calldata (for first deployment)
    bytes callData;              // Data to execute on the account
    bytes32 accountGasLimits;    // verificationGasLimit (16 bytes) || callGasLimit (16 bytes)
    uint256 preVerificationGas;  // Gas for bundler compensation
    bytes32 gasFees;             // maxPriorityFeePerGas (16 bytes) || maxFeePerGas (16 bytes)
    bytes paymasterAndData;      // paymaster (20 bytes) + pmVerificationGas (16 bytes) + pmPostOpGas (16 bytes) + pmData
    bytes signature;             // Account signature (validated in validateUserOp)
}
```

### 1.2 Unpacked UserOperation (for readability/SDKs)

```typescript
interface UserOperation {
    sender: Address;
    nonce: bigint;
    factory?: Address;           // Extracted from initCode[0:20]
    factoryData?: Hex;           // Extracted from initCode[20:]
    callData: Hex;
    callGasLimit: bigint;
    verificationGasLimit: bigint;
    preVerificationGas: bigint;
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
    paymaster?: Address;
    paymasterVerificationGasLimit?: bigint;
    paymasterPostOpGasLimit?: bigint;
    paymasterData?: Hex;
    signature: Hex;
}
```

### 1.3 Gas Field Packing

```solidity
// Packing (TypeScript/SDK side)
accountGasLimits = (verificationGasLimit << 128) | callGasLimit
gasFees = (maxPriorityFeePerGas << 128) | maxFeePerGas

// Unpacking (Solidity side via UserOperationLib)
function unpackVerificationGasLimit(PackedUserOperation calldata userOp) internal pure returns (uint256) {
    return uint128(bytes16(userOp.accountGasLimits));
}

function unpackCallGasLimit(PackedUserOperation calldata userOp) internal pure returns (uint256) {
    return uint128(uint256(userOp.accountGasLimits));
}
```

### 1.4 EntryPoint Interface (v0.9)

```solidity
interface IEntryPoint is IStakeManager, INonceManager {
    // Main execution functions
    function handleOps(
        PackedUserOperation[] calldata ops,
        address payable beneficiary
    ) external;
    
    function handleAggregatedOps(
        UserOpsPerAggregator[] calldata opsPerAggregator,
        address payable beneficiary
    ) external;
    
    // Hash computation
    function getUserOpHash(PackedUserOperation calldata userOp) 
        external view returns (bytes32);
    
    // Account deployment helper
    function getSenderAddress(bytes memory initCode) external;
    
    // Get SenderCreator contract
    function senderCreator() external view returns (ISenderCreator);
    
    // Events
    event UserOperationEvent(
        bytes32 indexed userOpHash,
        address indexed sender,
        address indexed paymaster,
        uint256 nonce,
        bool success,
        uint256 actualGasCost,
        uint256 actualGasUsed
    );
    
    event AccountDeployed(
        bytes32 indexed userOpHash,
        address indexed sender,
        address factory,
        address paymaster
    );
    
    event UserOperationRevertReason(
        bytes32 indexed userOpHash,
        address indexed sender,
        uint256 nonce,
        bytes revertReason
    );
    
    // Errors
    error FailedOp(uint256 opIndex, string reason);
    error FailedOpWithRevert(uint256 opIndex, string reason, bytes inner);
    error SignatureValidationFailed(address aggregator);
}
```

### 1.5 IAccount Interface

Every smart account must implement:

```solidity
interface IAccount {
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData);
}

// validationData format:
// - First 20 bytes: aggregator address (0 = valid signature, 1 = signature failed)
// - Next 6 bytes: validUntil timestamp (0 = no expiry)
// - Last 6 bytes: validAfter timestamp (0 = immediately valid)
```

### 1.6 UserOpHash Calculation

```solidity
// EIP-712 typed data hash
function getUserOpHash(PackedUserOperation calldata userOp) 
    external view returns (bytes32) {
    return keccak256(abi.encode(
        userOpHash,
        entryPointAddress,
        block.chainid
    ));
}
```

---

## 2. Bundler APIs (ERC-4337 RPC Methods)

### 2.1 Standard RPC Methods

| Method | Description |
|--------|-------------|
| `eth_sendUserOperation` | Submit a UserOperation to the mempool |
| `eth_estimateUserOperationGas` | Estimate gas for a UserOperation |
| `eth_getUserOperationByHash` | Get UserOp details by hash |
| `eth_getUserOperationReceipt` | Get execution receipt |
| `eth_supportedEntryPoints` | List supported EntryPoint addresses |
| `eth_chainId` | Get the chain ID |

### 2.2 eth_sendUserOperation

```typescript
// Request
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "eth_sendUserOperation",
  "params": [
    {
      "sender": "0x...",
      "nonce": "0x1",
      "initCode": "0x",
      "callData": "0x...",
      "callGasLimit": "0x...",
      "verificationGasLimit": "0x...",
      "preVerificationGas": "0x...",
      "maxFeePerGas": "0x...",
      "maxPriorityFeePerGas": "0x...",
      "paymasterAndData": "0x",
      "signature": "0x..."
    },
    "0x0000000071727De22E5E9d8BAf0edAc6f37da032" // EntryPoint address
  ]
}

// Response
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "0x..." // userOpHash
}
```

### 2.3 eth_estimateUserOperationGas

```typescript
// Request
{
  "method": "eth_estimateUserOperationGas",
  "params": [
    { /* partial UserOperation - signature/gas fields can be empty */ },
    "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    { /* optional state override */ }
  ]
}

// Response
{
  "result": {
    "preVerificationGas": "0x...",
    "verificationGasLimit": "0x...",
    "callGasLimit": "0x...",
    "validAfter": "0x0",  // optional
    "validUntil": "0x0"   // optional
  }
}
```

### 2.4 eth_getUserOperationReceipt

```typescript
interface UserOperationReceipt {
    userOpHash: string;
    sender: string;
    nonce: bigint;
    paymaster?: string;
    actualGasCost: bigint;
    actualGasUsed: bigint;
    success: boolean;
    reason?: string;
    logs: Log[];
    receipt: TransactionReceipt;
}
```

### 2.5 Bundler-Specific APIs

#### Pimlico Extensions
```typescript
// Sponsor UserOp via paymaster
pimlico_sponsorUserOperation(userOp, entryPoint, sponsorshipPolicy?)

// Get UserOp status with more details
pimlico_getUserOperationStatus(userOpHash)

// Get supported gas tokens for paymaster
pimlico_getSupportedGasTokens()
```

#### Alchemy Extensions
```typescript
// Estimate gas with state override
alchemy_requestGasAndPaymasterAndData(userOp, entryPoint, policyId)

// Simulate UserOp execution
alchemy_simulateUserOperationAssetChanges(userOp, entryPoint)
```

### 2.6 Debug Methods

```typescript
debug_bundler_clearState()        // Clear mempool
debug_bundler_dumpMempool()       // Dump mempool contents
debug_bundler_setReputation()     // Set entity reputation
debug_bundler_sendBundleNow()     // Force bundle submission
```

---

## 3. Paymaster Patterns

### 3.1 IPaymaster Interface

```solidity
interface IPaymaster {
    enum PostOpMode {
        opSucceeded,     // UserOp succeeded
        opReverted,      // UserOp reverted
        postOpReverted   // postOp itself reverted
    }
    
    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData);
    
    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) external;
}
```

### 3.2 Validation Data Format

Same as account validation:
```solidity
validationData = (sigFailed ? 1 : 0) | (validUntil << 160) | (validAfter << 208)
```

### 3.3 Paymaster Types

#### Verifying Paymaster (Signature-based)
```solidity
contract VerifyingPaymaster is BasePaymaster {
    function _validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) internal override returns (bytes memory context, uint256 validationData) {
        // Extract signature from paymasterData
        (uint48 validUntil, uint48 validAfter, bytes memory signature) = 
            abi.decode(userOp.paymasterAndData[52:], (uint48, uint48, bytes));
        
        // Verify signature from paymaster signer
        bytes32 hash = getHash(userOp, validUntil, validAfter);
        if (!verifySignature(hash, signature)) {
            return ("", _packValidationData(true, validUntil, validAfter));
        }
        
        return ("", _packValidationData(false, validUntil, validAfter));
    }
}
```

#### ERC-20 Token Paymaster
```solidity
contract ERC20Paymaster is BasePaymaster {
    IERC20 public token;
    uint256 public priceMarkup; // e.g., 110% = 1.1e6
    
    function _validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) internal override returns (bytes memory context, uint256 validationData) {
        uint256 tokenAmount = calculateTokenAmount(maxCost);
        
        // Transfer tokens from user (requires approval)
        token.transferFrom(userOp.sender, address(this), tokenAmount);
        
        // Return context for postOp refund
        return (abi.encode(userOp.sender, tokenAmount, maxCost), 0);
    }
    
    function _postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256
    ) internal override {
        (address sender, uint256 preCharge, uint256 maxCost) = 
            abi.decode(context, (address, uint256, uint256));
        
        // Refund excess tokens
        uint256 actualTokenCost = calculateTokenAmount(actualGasCost);
        if (preCharge > actualTokenCost) {
            token.transfer(sender, preCharge - actualTokenCost);
        }
    }
}
```

#### Deposit Paymaster (Prepaid)
```solidity
contract DepositPaymaster is BasePaymaster {
    mapping(address => uint256) public deposits;
    
    function deposit(address account) external payable {
        deposits[account] += msg.value;
    }
    
    function _validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) internal override returns (bytes memory context, uint256 validationData) {
        require(deposits[userOp.sender] >= maxCost, "Insufficient deposit");
        deposits[userOp.sender] -= maxCost;
        
        return (abi.encode(userOp.sender, maxCost), 0);
    }
    
    function _postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256
    ) internal override {
        (address sender, uint256 preCharge) = abi.decode(context, (address, uint256));
        // Refund unused gas
        deposits[sender] += preCharge - actualGasCost;
    }
}
```

### 3.4 paymasterAndData Encoding

```typescript
// Standard format (v0.7+)
paymasterAndData = concat([
    paymaster,                    // 20 bytes - paymaster address
    paymasterVerificationGas,     // 16 bytes - gas for validation
    paymasterPostOpGas,           // 16 bytes - gas for postOp
    paymasterData                 // variable - paymaster-specific data
]);

// Example encoding
function encodePaymasterData(
    paymaster: Address,
    verificationGas: bigint,
    postOpGas: bigint,
    data: Hex
): Hex {
    return concat([
        paymaster,
        pad(toHex(verificationGas), { size: 16 }),
        pad(toHex(postOpGas), { size: 16 }),
        data
    ]);
}
```

### 3.5 BasePaymaster Implementation

```solidity
abstract contract BasePaymaster is IPaymaster {
    IEntryPoint public immutable entryPoint;
    
    constructor(IEntryPoint _entryPoint) {
        entryPoint = _entryPoint;
    }
    
    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external override returns (bytes memory context, uint256 validationData) {
        _requireFromEntryPoint();
        return _validatePaymasterUserOp(userOp, userOpHash, maxCost);
    }
    
    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) external override {
        _requireFromEntryPoint();
        _postOp(mode, context, actualGasCost, actualUserOpFeePerGas);
    }
    
    // Staking functions
    function addStake(uint32 unstakeDelaySec) external payable {
        entryPoint.addStake{value: msg.value}(unstakeDelaySec);
    }
    
    function deposit() external payable {
        entryPoint.depositTo{value: msg.value}(address(this));
    }
}
```

---

## 4. Gas Estimation

### 4.1 Gas Components

| Component | Description |
|-----------|-------------|
| `preVerificationGas` | Fixed overhead: calldata cost + bundler compensation |
| `verificationGasLimit` | Gas for `validateUserOp` + account creation |
| `callGasLimit` | Gas for executing the account's `callData` |
| `paymasterVerificationGasLimit` | Gas for `validatePaymasterUserOp` |
| `paymasterPostOpGasLimit` | Gas for paymaster's `postOp` |

### 4.2 preVerificationGas Calculation

```typescript
function calculatePreVerificationGas(userOp: UserOperation): bigint {
    const packed = packUserOp(userOp);
    const callDataCost = packed
        .slice(2) // remove 0x
        .match(/.{2}/g)! // split into bytes
        .reduce((cost, byte) => {
            return cost + (byte === '00' ? 4n : 16n);
        }, 0n);
    
    // Add fixed overhead (bundler-specific)
    const fixedOverhead = 21000n; // base tx cost
    const perUserOpOverhead = 18300n; // ERC-4337 specific overhead
    
    return callDataCost + fixedOverhead + perUserOpOverhead;
}
```

### 4.3 verificationGasLimit Estimation

```typescript
async function estimateVerificationGas(
    bundler: BundlerClient,
    userOp: PartialUserOperation
): Promise<bigint> {
    // Use simulateValidation via bundler
    const result = await bundler.estimateUserOperationGas({
        ...userOp,
        signature: getDummySignature(), // Use max-length signature
    });
    
    return result.verificationGasLimit;
}
```

### 4.4 callGasLimit Estimation

```typescript
async function estimateCallGasLimit(
    provider: Provider,
    userOp: UserOperation
): Promise<bigint> {
    // Simulate call from EntryPoint to account
    const gasEstimate = await provider.estimateGas({
        from: ENTRY_POINT_ADDRESS,
        to: userOp.sender,
        data: userOp.callData,
    });
    
    // Add buffer for safety
    return gasEstimate * 120n / 100n;
}
```

### 4.5 simulateHandleOp for Validation

```solidity
// EntryPointSimulations.sol
function simulateHandleOp(
    PackedUserOperation calldata op,
    address target,
    bytes calldata targetCallData
) external returns (ExecutionResult memory) {
    UserOpInfo memory opInfo;
    _simulationOnlyValidations(op);
    
    (uint256 validationData, uint256 paymasterValidationData) = 
        _validatePrepayment(0, op, opInfo);
    
    uint256 paid = _executeUserOp(0, op, opInfo);
    
    bool targetSuccess;
    bytes memory targetResult;
    if (target != address(0)) {
        (targetSuccess, targetResult) = target.call(targetCallData);
    }
    
    return ExecutionResult(
        opInfo.preOpGas,
        paid,
        validationData,
        paymasterValidationData,
        targetSuccess,
        targetResult
    );
}
```

---

## 5. Signature Schemes

### 5.1 Standard ECDSA Signing

```typescript
async function signUserOp(
    userOp: UserOperation,
    signer: Signer,
    entryPoint: Address,
    chainId: number
): Promise<Hex> {
    const userOpHash = getUserOpHash(userOp, entryPoint, chainId);
    
    // EIP-191 personal sign
    const signature = await signer.signMessage(
        getBytes(userOpHash)
    );
    
    return signature;
}

function getUserOpHash(
    userOp: UserOperation,
    entryPoint: Address,
    chainId: number
): Hex {
    const packed = packUserOp(userOp);
    const encoded = encodeAbiParameters(
        [{ type: 'bytes32' }, { type: 'address' }, { type: 'uint256' }],
        [keccak256(packed), entryPoint, BigInt(chainId)]
    );
    return keccak256(encoded);
}
```

### 5.2 EIP-1271 Contract Signatures

```solidity
// Account validation supporting EIP-1271
function _validateSignature(
    PackedUserOperation calldata userOp,
    bytes32 userOpHash
) internal virtual override returns (uint256 validationData) {
    bytes32 hash = userOpHash.toEthSignedMessageHash();
    
    // Check if signer is EOA owner
    if (owner.code.length == 0) {
        if (owner != hash.recover(userOp.signature)) {
            return SIG_VALIDATION_FAILED;
        }
        return 0;
    }
    
    // EIP-1271 validation for smart contract owners
    try IERC1271(owner).isValidSignature(hash, userOp.signature) returns (bytes4 result) {
        if (result == IERC1271.isValidSignature.selector) {
            return 0;
        }
    } catch {}
    
    return SIG_VALIDATION_FAILED;
}
```

### 5.3 Multi-Signature Support

```solidity
contract MultiSigAccount is BaseAccount {
    address[] public owners;
    uint256 public threshold;
    
    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) internal override returns (uint256) {
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        
        // Decode packed signatures
        bytes memory signatures = userOp.signature;
        require(signatures.length >= threshold * 65, "Not enough signatures");
        
        address lastOwner = address(0);
        for (uint256 i = 0; i < threshold; i++) {
            (uint8 v, bytes32 r, bytes32 s) = signatureSplit(signatures, i);
            address recovered = ecrecover(hash, v, r, s);
            
            require(recovered > lastOwner, "Invalid signature order");
            require(isOwner(recovered), "Invalid signer");
            
            lastOwner = recovered;
        }
        
        return 0;
    }
}
```

### 5.4 Aggregated Signatures (BLS)

```solidity
interface IAggregator {
    function validateSignatures(
        PackedUserOperation[] calldata userOps,
        bytes calldata signature
    ) external view;
    
    function validateUserOpSignature(
        PackedUserOperation calldata userOp
    ) external view returns (bytes memory sigForUserOp);
    
    function aggregateSignatures(
        PackedUserOperation[] calldata userOps
    ) external view returns (bytes memory aggregatedSignature);
}
```

### 5.5 Passkey/WebAuthn Support

```typescript
// Creating WebAuthn signature for UserOp
async function signWithPasskey(
    userOpHash: Hex,
    credential: PublicKeyCredential
): Promise<Hex> {
    const challenge = hexToBytes(userOpHash);
    
    const assertion = await navigator.credentials.get({
        publicKey: {
            challenge,
            rpId: window.location.hostname,
            allowCredentials: [{
                id: credential.rawId,
                type: 'public-key',
            }],
        },
    });
    
    // Encode authenticator data + signature
    return encodeAbiParameters(
        [
            { type: 'bytes' },  // authenticatorData
            { type: 'string' }, // clientDataJSON
            { type: 'uint256' }, // challengeIndex
            { type: 'uint256' }, // typeIndex
            { type: 'bytes' },  // signature (r, s)
        ],
        [
            assertion.response.authenticatorData,
            assertion.response.clientDataJSON,
            /* extracted indices */,
            assertion.response.signature,
        ]
    );
}
```

---

## 6. SDK Options Comparison

### 6.1 permissionless.js (Pimlico)

**Pros:**
- Built on viem (modern, type-safe)
- Excellent TypeScript support
- Supports all major smart accounts
- Active development

**Basic Usage:**
```typescript
import { createSmartAccountClient } from "permissionless"
import { toSimpleSmartAccount } from "permissionless/accounts"
import { createPimlicoClient } from "permissionless/clients/pimlico"

// Create smart account
const account = await toSimpleSmartAccount({
    client: publicClient,
    owner: privateKeyToAccount(privateKey),
    entryPoint: {
        address: entryPoint07Address,
        version: "0.7",
    },
})

// Create bundler client
const bundlerClient = createPimlicoClient({
    transport: http(bundlerUrl),
    entryPoint: {
        address: entryPoint07Address,
        version: "0.7",
    },
})

// Create smart account client
const smartAccountClient = createSmartAccountClient({
    account,
    chain: sepolia,
    bundlerTransport: http(bundlerUrl),
    paymaster: paymasterClient,
})

// Send transaction
const hash = await smartAccountClient.sendTransaction({
    to: "0x...",
    value: parseEther("0.1"),
    data: "0x",
})
```

**Supported Accounts:**
- `toSimpleSmartAccount` - Simple Account
- `toSafeSmartAccount` - Safe (Gnosis)
- `toKernelSmartAccount` - Kernel (ZeroDev)
- `toBiconomySmartAccount` - Biconomy
- `toNexusSmartAccount` - Biconomy Nexus
- `toLightSmartAccount` - Light Account (Alchemy)
- `toThirdwebSmartAccount` - Thirdweb

### 6.2 aa-sdk (Alchemy)

**Pros:**
- Official Alchemy SDK
- Deep integration with Alchemy infrastructure
- Good documentation
- Modular architecture

**Basic Usage:**
```typescript
import { createModularAccountAlchemyClient } from "@alchemy/aa-alchemy"
import { LocalAccountSigner } from "@alchemy/aa-core"

const client = await createModularAccountAlchemyClient({
    apiKey: "YOUR_API_KEY",
    chain: sepolia,
    signer: LocalAccountSigner.privateKeyToAccountSigner(privateKey),
})

const result = await client.sendUserOperation({
    uo: {
        target: "0x...",
        data: "0x...",
        value: 0n,
    },
})

const txHash = await client.waitForUserOperationTransaction(result)
```

### 6.3 userop.js (StackUp)

**Pros:**
- Straightforward API
- Good for learning
- Works with any bundler

**Basic Usage:**
```typescript
import { Presets, Client } from "userop"

const signer = new ethers.Wallet(privateKey)
const builder = await Presets.Builder.SimpleAccount.init(
    signer,
    rpcUrl,
    { entryPoint: entryPointAddress }
)

const client = await Client.init(bundlerUrl)

builder.execute(target, value, data)

const result = await client.sendUserOperation(builder)
const receipt = await result.wait()
```

### 6.4 SDK Comparison Table

| Feature | permissionless.js | aa-sdk | userop.js |
|---------|-------------------|--------|-----------|
| Base Library | viem | ethers/viem | ethers |
| TypeScript | Excellent | Good | Basic |
| Account Types | 7+ | 3+ | 2 |
| Bundler Support | Any | Alchemy-focused | Any |
| Paymaster Integration | Built-in | Built-in | Manual |
| Active Development | Very Active | Active | Moderate |
| Documentation | Good | Excellent | Basic |

---

## 7. EntryPoint Version Differences

### 7.1 v0.6 vs v0.7/v0.8 Key Differences

| Aspect | v0.6 | v0.7+ |
|--------|------|-------|
| UserOp Format | Unpacked fields | Packed gas fields |
| Gas Fields | Separate fields | `accountGasLimits`, `gasFees` |
| Paymaster Data | Single `paymasterAndData` | Includes gas limits |
| initCode Format | `initCode` only | `factory` + `factoryData` |
| postOp Gas | N/A | Explicit `paymasterPostOpGasLimit` |
| EIP-712 | Not used | Used for hash |

### 7.2 v0.6 UserOperation

```solidity
struct UserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    uint256 callGasLimit;           // Separate field
    uint256 verificationGasLimit;   // Separate field
    uint256 preVerificationGas;
    uint256 maxFeePerGas;           // Separate field
    uint256 maxPriorityFeePerGas;   // Separate field
    bytes paymasterAndData;
    bytes signature;
}
```

### 7.3 v0.7+ PackedUserOperation

```solidity
struct PackedUserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;                 // factory (20 bytes) + factoryData
    bytes callData;
    bytes32 accountGasLimits;       // Packed: verificationGas || callGas
    uint256 preVerificationGas;
    bytes32 gasFees;                // Packed: maxPriority || maxFee
    bytes paymasterAndData;         // Includes paymaster gas limits
    bytes signature;
}
```

### 7.4 v0.9 (Latest) Additions

```solidity
// Constants
uint256 private constant INNER_GAS_OVERHEAD = 10000;
uint256 private constant UNUSED_GAS_PENALTY_PERCENT = 10;
uint256 private constant PENALTY_GAS_THRESHOLD = 40000;

// EIP-712 domain
string constant DOMAIN_NAME = "ERC4337";
string constant DOMAIN_VERSION = "1";

// Supports EIP-7702 (account delegation)
// Transient storage for currentUserOpHash
bytes32 transient private currentUserOpHash;
```

### 7.5 Migration: v0.6 → v0.7

```typescript
function migrateUserOpV6ToV7(v6Op: UserOperationV6): PackedUserOperation {
    return {
        sender: v6Op.sender,
        nonce: v6Op.nonce,
        initCode: v6Op.initCode,
        callData: v6Op.callData,
        accountGasLimits: packGasLimits(
            v6Op.verificationGasLimit,
            v6Op.callGasLimit
        ),
        preVerificationGas: v6Op.preVerificationGas,
        gasFees: packGasFees(
            v6Op.maxPriorityFeePerGas,
            v6Op.maxFeePerGas
        ),
        paymasterAndData: migratePaymasterData(v6Op.paymasterAndData),
        signature: v6Op.signature,
    };
}

function packGasLimits(verificationGas: bigint, callGas: bigint): Hex {
    return pad(toHex((verificationGas << 128n) | callGas), { size: 32 });
}
```

---

## 8. Batching Multiple Calls

### 8.1 Account execute vs executeBatch

```solidity
// BaseAccount.sol - Single call
function execute(
    address target,
    uint256 value,
    bytes calldata data
) external virtual {
    _requireForExecute();
    bool ok = Exec.call(target, value, data, gasleft());
    if (!ok) {
        Exec.revertWithReturnData();
    }
}

// BaseAccount.sol - Batch calls
struct Call {
    address target;
    uint256 value;
    bytes data;
}

function executeBatch(Call[] calldata calls) external virtual {
    _requireForExecute();
    uint256 callsLength = calls.length;
    
    for (uint256 i = 0; i < callsLength; i++) {
        Call calldata call = calls[i];
        bool ok = Exec.call(call.target, call.value, call.data, gasleft());
        if (!ok) {
            if (callsLength == 1) {
                Exec.revertWithReturnData();
            } else {
                revert ExecuteError(i, Exec.getReturnData(0));
            }
        }
    }
}
```

### 8.2 Encoding Batch callData

```typescript
import { encodeFunctionData } from "viem"

// Single call
const singleCallData = encodeFunctionData({
    abi: simpleAccountAbi,
    functionName: "execute",
    args: [targetAddress, value, data],
})

// Batch call
const batchCallData = encodeFunctionData({
    abi: simpleAccountAbi,
    functionName: "executeBatch",
    args: [[
        { target: address1, value: 0n, data: callData1 },
        { target: address2, value: parseEther("1"), data: callData2 },
        { target: address3, value: 0n, data: callData3 },
    ]],
})
```

### 8.3 SDK Batch Examples

**permissionless.js:**
```typescript
const hash = await smartAccountClient.sendTransactions({
    transactions: [
        {
            to: tokenAddress,
            data: encodeFunctionData({
                abi: erc20Abi,
                functionName: "approve",
                args: [spender, amount],
            }),
        },
        {
            to: dexAddress,
            data: encodeFunctionData({
                abi: dexAbi,
                functionName: "swap",
                args: [tokenIn, tokenOut, amount],
            }),
        },
    ],
})
```

**aa-sdk:**
```typescript
const result = await client.sendUserOperation({
    uo: [
        { target: token, data: approveData },
        { target: dex, data: swapData },
    ],
})
```

### 8.4 executeUserOp Pattern

For operations that need the full UserOp context:

```solidity
interface IAccountExecute {
    function executeUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) external;
}

// EntryPoint detects this selector and passes full UserOp
if (methodSig == IAccountExecute.executeUserOp.selector) {
    bytes memory executeUserOp = abi.encodeCall(
        IAccountExecute.executeUserOp,
        (userOp, opInfo.userOpHash)
    );
    innerCall = abi.encodeCall(this.innerHandleOp, (executeUserOp, opInfo, context));
}
```

---

## 9. Cross-Chain Same Address Deployment

### 9.1 CREATE2 Deterministic Deployment

The key to cross-chain same address deployment is using **CREATE2** with the same:
- Factory address
- Salt
- Init code (bytecode + constructor args)

```solidity
// Create2Factory pattern
address deployed = Create2.computeAddress(
    bytes32(salt),
    keccak256(abi.encodePacked(
        type(ERC1967Proxy).creationCode,
        abi.encode(
            address(accountImplementation),
            abi.encodeCall(SimpleAccount.initialize, (owner))
        )
    ))
);
```

### 9.2 Deterministic Factory Deployment

Using [Arachnid's deterministic deployment proxy](https://github.com/Arachnid/deterministic-deployment-proxy):

```typescript
// Factory is deployed at same address on all chains
const Create2Factory = {
    contractAddress: "0x4e59b44847b379578588920ca78fbf26c0b4956c",
    factoryTx: "0xf8a58085174876e800830186a08080b853604580600e600039806000f350fe...",
    factoryDeployer: "0x3fab184622dc19b6109349b94811493bf2a45362",
}

// Deploy factory if not exists
async function deployFactory(provider: Provider): Promise<void> {
    const code = await provider.getCode(Create2Factory.contractAddress);
    if (code.length > 2) return; // Already deployed
    
    // Fund the deployer
    await signer.sendTransaction({
        to: Create2Factory.factoryDeployer,
        value: BigInt(100000 * 100e9), // deploymentGasLimit * gasPrice
    });
    
    // Send pre-signed deployment tx
    await provider.sendTransaction(Create2Factory.factoryTx);
}
```

### 9.3 Computing Counterfactual Address

```typescript
import { keccak256, concat, getAddress } from "viem"

function getDeployedAddress(
    initCode: Hex,
    salt: bigint,
    factory: Address = "0x4e59b44847b379578588920ca78fbf26c0b4956c"
): Address {
    const saltBytes32 = pad(toHex(salt), { size: 32 });
    
    const hash = keccak256(concat([
        "0xff",
        factory,
        saltBytes32,
        keccak256(initCode),
    ]));
    
    return getAddress(`0x${hash.slice(-40)}`);
}
```

### 9.4 SimpleAccountFactory Pattern

```solidity
contract SimpleAccountFactory {
    SimpleAccount public immutable accountImplementation;
    
    function createAccount(address owner, uint256 salt) public returns (SimpleAccount ret) {
        address addr = getAddress(owner, salt);
        uint256 codeSize = addr.code.length;
        
        if (codeSize > 0) {
            return SimpleAccount(payable(addr));
        }
        
        // CREATE2 deployment with deterministic address
        ret = SimpleAccount(payable(new ERC1967Proxy{salt: bytes32(salt)}(
            address(accountImplementation),
            abi.encodeCall(SimpleAccount.initialize, (owner))
        )));
    }
    
    function getAddress(address owner, uint256 salt) public view returns (address) {
        return Create2.computeAddress(
            bytes32(salt),
            keccak256(abi.encodePacked(
                type(ERC1967Proxy).creationCode,
                abi.encode(
                    address(accountImplementation),
                    abi.encodeCall(SimpleAccount.initialize, (owner))
                )
            ))
        );
    }
}
```

### 9.5 Cross-Chain Deployment Steps

```typescript
async function deployAccountCrossChain(
    owner: Address,
    salt: bigint,
    chains: Chain[]
): Promise<Address> {
    // 1. Compute address (same on all chains)
    const accountAddress = getCounterfactualAddress(owner, salt);
    
    for (const chain of chains) {
        const client = createWalletClient({ chain, ... });
        const publicClient = createPublicClient({ chain, ... });
        
        // 2. Check if already deployed
        const code = await publicClient.getBytecode({ address: accountAddress });
        if (code && code !== "0x") {
            console.log(`Already deployed on ${chain.name}`);
            continue;
        }
        
        // 3. Ensure factory is deployed
        await ensureFactoryDeployed(publicClient, client);
        
        // 4. Fund the counterfactual address
        await fundAddress(accountAddress, chain);
        
        // 5. Create UserOp to deploy
        const userOp = await createDeploymentUserOp({
            sender: accountAddress,
            factory: SIMPLE_ACCOUNT_FACTORY,
            factoryData: encodeFactoryData(owner, salt),
            callData: "0x", // Empty call
        });
        
        // 6. Submit to bundler
        await bundlerClient.sendUserOperation(userOp);
    }
    
    return accountAddress;
}
```

### 9.6 EntryPoint Addresses

Standard EntryPoint addresses (v0.7):
```
EntryPoint v0.7: 0x0000000071727De22E5E9d8BAf0edAc6f37da032
```

The EntryPoint is deployed at the same address on all EVM chains using CREATE2.

### 9.7 initCode for Cross-Chain

```typescript
// initCode = factory (20 bytes) + factoryData
function buildInitCode(
    factoryAddress: Address,
    owner: Address,
    salt: bigint
): Hex {
    const factoryData = encodeFunctionData({
        abi: simpleAccountFactoryAbi,
        functionName: "createAccount",
        args: [owner, salt],
    });
    
    return concat([factoryAddress, factoryData]);
}
```

---

## 10. Common Error Codes

| Error Code | Meaning |
|------------|---------|
| AA10 | Sender already constructed |
| AA13 | initCode failed or OOG |
| AA14 | initCode must return sender |
| AA15 | initCode must create sender |
| AA20 | Account not deployed |
| AA21 | Didn't pay prefund |
| AA22 | Expired or not yet valid |
| AA23 | Reverted (account validation) |
| AA24 | Signature error |
| AA25 | Invalid account nonce |
| AA26 | Account verificationGasLimit too low |
| AA30 | Paymaster not deployed |
| AA31 | Paymaster deposit too low |
| AA32 | Paymaster expired |
| AA33 | Reverted (paymaster validation) |
| AA34 | Paymaster signature error |
| AA40 | Over verificationGasLimit (postOp) |
| AA41 | Too little verificationGas for postOp |
| AA50 | PostOp reverted |
| AA51 | Prefund below actualGasCost |

---

## 11. Security Considerations

### 11.1 Validation Phase Rules (ERC-7562)

- No access to other accounts' storage
- No use of forbidden opcodes (CREATE, SELFDESTRUCT, etc.)
- Limited use of GAS opcode
- No access to environment opcodes (TIMESTAMP, NUMBER, etc.) for signature validation
- Factory must be staked if accessing storage

### 11.2 Paymaster Security

- Always verify caller is EntryPoint
- Implement signature expiry (validUntil/validAfter)
- Use rate limiting
- Monitor deposit balance
- Implement withdrawal delays

### 11.3 Signature Replay Protection

- UserOpHash includes chainId and EntryPoint address
- Nonce system prevents same-chain replay
- Use validUntil for time-limited signatures

---

## References

- [EIP-4337](https://eips.ethereum.org/EIPS/eip-4337)
- [ERC-7562 (Validation Rules)](https://eips.ethereum.org/EIPS/eip-7562)
- [eth-infinitism/account-abstraction](https://github.com/eth-infinitism/account-abstraction)
- [Pimlico Documentation](https://docs.pimlico.io)
- [Alchemy AA Documentation](https://docs.alchemy.com/docs/account-abstraction)
- [StackUp Documentation](https://docs.stackup.sh)
