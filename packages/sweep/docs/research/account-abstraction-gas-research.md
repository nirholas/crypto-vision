# Account Abstraction & Gas Abstraction Infrastructure Research
## Sweep Multi-Chain Dust Sweeper

**Target**: 600,000 users across Ethereum, Base, Arbitrum, BNB Chain, Polygon, Linea  
**Core Requirement**: Users sweep dust tokens WITHOUT native gas tokens, paying with USDC/USDT

---

## Table of Contents

1. [ERC-4337 Deep Dive](#1-erc-4337-deep-dive)
2. [Coinbase Smart Wallet Architecture](#2-coinbase-smart-wallet-architecture)
3. [Coinbase Verifying Paymaster](#3-coinbase-verifying-paymaster)
4. [Bundler Infrastructure Comparison](#4-bundler-infrastructure-comparison)
5. [Permit2 for Gasless Approvals](#5-permit2-for-gasless-approvals)
6. [Recommended Stack for 600K Users](#6-recommended-stack-for-600k-users)
7. [Cost Analysis](#7-cost-analysis)
8. [Security Considerations](#8-security-considerations)
9. [Implementation Code Examples](#9-implementation-code-examples)

---

## 1. ERC-4337 Deep Dive

### 1.1 PackedUserOperation Structure (v0.7+)

The latest EntryPoint v0.7 uses packed gas fields for efficiency:

```solidity
struct PackedUserOperation {
    address sender;              // Smart account address
    uint256 nonce;               // Key-value based nonce (top 192 bits = key, bottom 64 = sequence)
    bytes initCode;              // factory (20 bytes) + factoryData (for first deployment)
    bytes callData;              // Encoded execute() or executeBatch() call
    bytes32 accountGasLimits;    // verificationGasLimit (16 bytes) || callGasLimit (16 bytes)
    uint256 preVerificationGas;  // Bundler compensation for off-chain work
    bytes32 gasFees;             // maxPriorityFeePerGas (16 bytes) || maxFeePerGas (16 bytes)
    bytes paymasterAndData;      // paymaster (20) + pmVerificationGas (16) + pmPostOpGas (16) + pmData
    bytes signature;             // Account-specific signature
}
```

### 1.2 TypeScript UserOperation Interface

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

### 1.3 Validation Flow

```
User → Bundler (eth_sendUserOperation)
         ↓
    Bundler validates UserOp locally
         ↓
    Bundler calls simulateValidation on EntryPoint
         ↓
    EntryPoint.handleOps([userOps], beneficiary)
         ↓
    For each UserOp:
      1. Deploy account if initCode present
      2. Call account.validateUserOp() - returns validationData
      3. If paymaster: call paymaster.validatePaymasterUserOp() - returns context
      4. Execute callData on account
      5. If paymaster: call paymaster.postOp(context, actualGasCost)
```

### 1.4 IAccount Interface

Every ERC-4337 smart account must implement:

```solidity
interface IAccount {
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData);
}

// validationData format (packed uint256):
// - Bytes 0-19:  aggregator address (0 = valid, 1 = invalid signature)
// - Bytes 20-25: validUntil timestamp (0 = no expiry)
// - Bytes 26-31: validAfter timestamp (0 = immediately valid)
```

### 1.5 EntryPoint Contract (v0.7)

**Canonical Address**: `0x0000000071727De22E5E9d8BAf0edAc6f37da032`

Key functions:
```solidity
interface IEntryPoint {
    function handleOps(PackedUserOperation[] calldata ops, address payable beneficiary) external;
    function getUserOpHash(PackedUserOperation calldata userOp) external view returns (bytes32);
    function getSenderAddress(bytes memory initCode) external;
    function depositTo(address account) external payable;
}
```

### 1.6 Bundler RPC Methods

| Method | Description |
|--------|-------------|
| `eth_sendUserOperation` | Submit UserOp to mempool |
| `eth_estimateUserOperationGas` | Estimate gas limits |
| `eth_getUserOperationByHash` | Get UserOp by hash |
| `eth_getUserOperationReceipt` | Get execution receipt |
| `eth_supportedEntryPoints` | List supported EntryPoints |

---

## 2. Coinbase Smart Wallet Architecture

### 2.1 Contract Overview

**Factory Address (v1.1)**: `0xBA5ED110eFDBa3D005bfC882d75358ACBbB85842`

The Coinbase Smart Wallet is an ERC-4337 compliant wallet with multi-owner support including passkeys.

```solidity
contract CoinbaseSmartWallet is ERC1271, IAccount, MultiOwnable, UUPSUpgradeable, Receiver {
    // Signature wrapper for owner identification
    struct SignatureWrapper {
        uint256 ownerIndex;      // Index of owner in MultiOwnable
        bytes signatureData;     // EOA: abi.encodePacked(r,s,v) | Passkey: abi.encode(WebAuthnAuth)
    }
    
    // Batch call structure
    struct Call {
        address target;
        uint256 value;
        bytes data;
    }
}
```

### 2.2 Factory Contract Usage

```solidity
contract CoinbaseSmartWalletFactory {
    address public immutable implementation;
    
    // Deploy or return existing account
    function createAccount(
        bytes[] calldata owners,  // ABI-encoded addresses (32 bytes) or public keys (64 bytes)
        uint256 nonce             // Salt for deterministic address
    ) external payable returns (CoinbaseSmartWallet account);
    
    // Compute counterfactual address
    function getAddress(
        bytes[] calldata owners,
        uint256 nonce
    ) external view returns (address);
}
```

### 2.3 Deployment Flow (TypeScript)

```typescript
import { encodeFunctionData, keccak256, encodeAbiParameters } from 'viem';

const FACTORY_ADDRESS = '0xBA5ED110eFDBa3D005bfC882d75358ACBbB85842';

// Step 1: Prepare owners array
function prepareOwners(addresses: Address[], passkeys: { x: bigint; y: bigint }[]): Hex[] {
    const owners: Hex[] = [];
    
    // Add EOA owners (32 bytes each)
    for (const addr of addresses) {
        owners.push(encodeAbiParameters([{ type: 'address' }], [addr]));
    }
    
    // Add passkey owners (64 bytes each - x,y coordinates)
    for (const pk of passkeys) {
        owners.push(encodeAbiParameters(
            [{ type: 'uint256' }, { type: 'uint256' }],
            [pk.x, pk.y]
        ));
    }
    
    return owners;
}

// Step 2: Get counterfactual address
async function getSmartWalletAddress(
    publicClient: PublicClient,
    owners: Hex[],
    nonce: bigint
): Promise<Address> {
    return await publicClient.readContract({
        address: FACTORY_ADDRESS,
        abi: coinbaseSmartWalletFactoryAbi,
        functionName: 'getAddress',
        args: [owners, nonce],
    });
}

// Step 3: Build initCode for UserOp
function buildInitCode(owners: Hex[], nonce: bigint): Hex {
    const factoryData = encodeFunctionData({
        abi: coinbaseSmartWalletFactoryAbi,
        functionName: 'createAccount',
        args: [owners, nonce],
    });
    
    return concat([FACTORY_ADDRESS, factoryData]);
}
```

### 2.4 Passkey/WebAuthn Integration

```typescript
// Create passkey during wallet setup
async function createPasskeyOwner(userId: string): Promise<{ x: bigint; y: bigint; credentialId: Uint8Array }> {
    const credential = await navigator.credentials.create({
        publicKey: {
            challenge: crypto.getRandomValues(new Uint8Array(32)),
            rp: { name: 'Sweep', id: window.location.hostname },
            user: {
                id: new TextEncoder().encode(userId),
                name: userId,
                displayName: 'Sweep User',
            },
            pubKeyCredParams: [{ alg: -7, type: 'public-key' }], // ES256 (P-256)
            authenticatorSelection: {
                authenticatorAttachment: 'platform',
                userVerification: 'required',
                residentKey: 'required',
            },
        },
    }) as PublicKeyCredential;
    
    // Extract public key coordinates
    const response = credential.response as AuthenticatorAttestationResponse;
    const publicKey = response.getPublicKey()!;
    const { x, y } = extractP256Coordinates(publicKey);
    
    return {
        x: BigInt('0x' + Buffer.from(x).toString('hex')),
        y: BigInt('0x' + Buffer.from(y).toString('hex')),
        credentialId: new Uint8Array(credential.rawId),
    };
}

// Sign UserOp with passkey
async function signWithPasskey(
    userOpHash: Hex,
    credentialId: Uint8Array,
    ownerIndex: number
): Promise<Hex> {
    const assertion = await navigator.credentials.get({
        publicKey: {
            challenge: hexToBytes(userOpHash),
            rpId: window.location.hostname,
            allowCredentials: [{
                id: credentialId,
                type: 'public-key',
            }],
            userVerification: 'required',
        },
    }) as PublicKeyCredential;
    
    const response = assertion.response as AuthenticatorAssertionResponse;
    
    // Encode WebAuthnAuth struct
    const webAuthnAuth = encodeAbiParameters(
        [
            { type: 'bytes', name: 'authenticatorData' },
            { type: 'string', name: 'clientDataJSON' },
            { type: 'uint256', name: 'challengeIndex' },
            { type: 'uint256', name: 'typeIndex' },
            { type: 'uint256', name: 'r' },
            { type: 'uint256', name: 's' },
        ],
        [
            toHex(new Uint8Array(response.authenticatorData)),
            new TextDecoder().decode(response.clientDataJSON),
            findChallengeIndex(response.clientDataJSON),
            findTypeIndex(response.clientDataJSON),
            extractR(response.signature),
            extractS(response.signature),
        ]
    );
    
    // Wrap with SignatureWrapper
    return encodeAbiParameters(
        [{ 
            type: 'tuple',
            components: [
                { type: 'uint256', name: 'ownerIndex' },
                { type: 'bytes', name: 'signatureData' },
            ]
        }],
        [{ ownerIndex: BigInt(ownerIndex), signatureData: webAuthnAuth }]
    );
}
```

### 2.5 Multi-Owner Support

```typescript
// Add new owner (requires existing owner signature)
async function addOwner(
    smartAccountClient: SmartAccountClient,
    newOwnerAddress: Address
): Promise<Hex> {
    return await smartAccountClient.sendUserOperation({
        calls: [{
            to: smartAccountClient.account.address,
            data: encodeFunctionData({
                abi: coinbaseSmartWalletAbi,
                functionName: 'addOwnerAddress',
                args: [newOwnerAddress],
            }),
        }],
    });
}

// Cross-chain owner update (replayable)
async function addOwnerCrossChain(
    smartAccountClient: SmartAccountClient,
    newOwnerAddress: Address
): Promise<Hex> {
    // Uses REPLAYABLE_NONCE_KEY = 8453 for cross-chain replay
    return await smartAccountClient.sendUserOperation({
        calls: [{
            to: smartAccountClient.account.address,
            data: encodeFunctionData({
                abi: coinbaseSmartWalletAbi,
                functionName: 'executeWithoutChainIdValidation',
                args: [
                    encodeFunctionData({
                        abi: coinbaseSmartWalletAbi,
                        functionName: 'addOwnerAddress',
                        args: [newOwnerAddress],
                    }),
                ],
            }),
        }],
        nonce: (8453n << 64n) | sequenceNumber, // REPLAYABLE_NONCE_KEY
    });
}
```

---

## 3. Coinbase Verifying Paymaster

### 3.1 PaymasterData Structure

The Coinbase Verifying Paymaster enables ERC-20 gas payment with off-chain signature verification.

```solidity
struct PaymasterData {
    uint48 validUntil;         // Signature expiry timestamp
    uint48 validAfter;         // Signature activation timestamp
    uint128 sponsorUUID;       // Off-chain tracking ID
    bool allowAnyBundler;      // If false, only allowlisted bundlers
    bool precheckBalance;      // Check token balance during validation
    bool prepaymentRequired;   // Require upfront token transfer
    address token;             // ERC-20 token address (0x0 for native sponsorship)
    address receiver;          // Token payment recipient (your treasury)
    uint256 exchangeRate;      // ETH price in token (token_decimals * 1e18)
    uint48 postOpGas;          // Gas overhead for postOp
}
```

### 3.2 Exchange Rate Calculation

```typescript
/**
 * Calculate exchange rate for paymaster
 * exchangeRate = (ETH_PRICE_IN_USD / TOKEN_PRICE_IN_USD) * TOKEN_DECIMALS * 1e18
 * 
 * Example: ETH = $3000, USDC = $1, USDC decimals = 6
 * exchangeRate = (3000 / 1) * 10^6 * 10^18 = 3000 * 10^24
 */
function calculateExchangeRate(
    ethPriceUsd: number,
    tokenPriceUsd: number,
    tokenDecimals: number,
    profitMarginPercent: number = 5  // 5% markup
): bigint {
    const baseRate = (ethPriceUsd / tokenPriceUsd) * (10 ** tokenDecimals);
    const withMargin = baseRate * (1 + profitMarginPercent / 100);
    return BigInt(Math.floor(withMargin * 1e18));
}

// Example for USDC at $1, ETH at $3000, 5% profit margin
const usdcExchangeRate = calculateExchangeRate(3000, 1, 6, 5);
// = 3150000000000000000000000n (3150 * 10^21)
```

### 3.3 Off-Chain Signature Flow

```typescript
import { keccak256, encodeAbiParameters, toHex, hashMessage } from 'viem';

interface PaymasterSignatureRequest {
    userOp: PackedUserOperation;
    paymasterData: PaymasterData;
    paymasterValidationGasLimit: bigint;
    postOpGasLimit: bigint;
}

// Backend: Generate paymaster signature
async function signPaymasterData(
    request: PaymasterSignatureRequest,
    paymasterSigner: PrivateKeyAccount,
    paymasterAddress: Address,
    chainId: number
): Promise<Hex> {
    // 1. Compute hash (matches getHash in contract)
    const hash = keccak256(encodeAbiParameters(
        [
            { type: 'address' },    // sender
            { type: 'uint256' },    // nonce
            { type: 'bytes32' },    // keccak256(initCode)
            { type: 'bytes32' },    // keccak256(callData)
            { type: 'bytes32' },    // accountGasLimits
            { type: 'uint256' },    // preVerificationGas
            { type: 'bytes32' },    // gasFees
            { type: 'uint256' },    // chainId
            { type: 'address' },    // paymaster
            { type: 'tuple' },      // paymasterData
            { type: 'uint256' },    // paymasterValidationGasLimit
            { type: 'uint256' },    // postOpGasLimit
        ],
        [
            request.userOp.sender,
            request.userOp.nonce,
            keccak256(request.userOp.initCode),
            keccak256(request.userOp.callData),
            request.userOp.accountGasLimits,
            request.userOp.preVerificationGas,
            request.userOp.gasFees,
            BigInt(chainId),
            paymasterAddress,
            request.paymasterData,
            request.paymasterValidationGasLimit,
            request.postOpGasLimit,
        ]
    ));
    
    // 2. Sign with EIP-191 (personal_sign)
    const signature = await paymasterSigner.signMessage({
        message: { raw: hash },
    });
    
    return signature;
}

// Build complete paymasterAndData
function buildPaymasterAndData(
    paymasterAddress: Address,
    paymasterValidationGasLimit: bigint,
    postOpGasLimit: bigint,
    paymasterData: PaymasterData,
    signature: Hex
): Hex {
    const packedData = encodeAbiParameters(
        [
            { type: 'uint48' },     // validUntil
            { type: 'uint48' },     // validAfter
            { type: 'uint128' },    // sponsorUUID
            { type: 'bool' },       // allowAnyBundler
            { type: 'bool' },       // precheckBalance
            { type: 'bool' },       // prepaymentRequired
            { type: 'address' },    // token
            { type: 'address' },    // receiver
            { type: 'uint256' },    // exchangeRate
            { type: 'uint48' },     // postOpGas
        ],
        [
            paymasterData.validUntil,
            paymasterData.validAfter,
            paymasterData.sponsorUUID,
            paymasterData.allowAnyBundler,
            paymasterData.precheckBalance,
            paymasterData.prepaymentRequired,
            paymasterData.token,
            paymasterData.receiver,
            paymasterData.exchangeRate,
            paymasterData.postOpGas,
        ]
    );
    
    return concat([
        paymasterAddress,                              // 20 bytes
        pad(toHex(paymasterValidationGasLimit), { size: 16 }),  // 16 bytes
        pad(toHex(postOpGasLimit), { size: 16 }),              // 16 bytes
        packedData,                                    // variable
        signature,                                     // 65 bytes
    ]);
}
```

### 3.4 postOp Token Transfer Flow

```
validatePaymasterUserOp()
    ├── Verify signature
    ├── Check bundler allowlist (if !allowAnyBundler)
    ├── If token != address(0):
    │   ├── If precheckBalance: verify balance >= maxTokenCost
    │   └── If prepaymentRequired: transfer maxTokenCost to paymaster
    └── Return context with PostOpContextData

UserOp execution...

_postOp()
    ├── Calculate actualTokenCost from actualGasCost + postOpGas
    ├── If prepaid:
    │   ├── Refund (prepaidAmount - actualTokenCost) to sender
    │   └── Transfer actualTokenCost to receiver
    └── Else:
        └── Try transfer actualTokenCost from sender to receiver
```

### 3.5 Deployment & Configuration

```typescript
// Deploy verifying paymaster
const paymaster = await deployContract({
    abi: verifyingPaymasterAbi,
    bytecode: verifyingPaymasterBytecode,
    args: [
        ENTRY_POINT_V07,           // EntryPoint address
        paymasterSignerAddress,     // Off-chain signer
        ownerAddress,               // Contract owner
    ],
});

// Fund paymaster deposit at EntryPoint
await entryPoint.depositTo(paymaster.address, { value: parseEther('10') });

// Allowlist bundlers (optional)
await paymaster.setBundlerAllowed(bundlerAddress, true);

// Rotate signer (two-step process)
await paymaster.setPendingVerifyingSigner(newSignerAddress);
// ... wait for confirmation ...
await paymaster.rotateVerifyingSigner();
```

---

## 4. Bundler Infrastructure Comparison

### 4.1 Provider Comparison

| Feature | Pimlico | Alchemy AA | Stackup | Biconomy |
|---------|---------|------------|---------|----------|
| **Pricing Model** | Per UserOp | Compute Units | Per UserOp | Hybrid |
| **Free Tier** | 100 UserOps/month | 3M CU/month | 1000 UserOps/month | Limited |
| **L2 Support** | Excellent | Good | Good | Good |
| **Rate Limits** | 300 req/s | Varies by plan | 100 req/s | 100 req/s |
| **EntryPoint v0.7** | ✅ | ✅ | ✅ | ✅ |
| **Paymaster API** | ✅ Built-in | ✅ Built-in | ✅ | ✅ Built-in |
| **SDK** | permissionless.js | aa-sdk | userop.js | Biconomy SDK |
| **Self-Hosting** | OSS available | No | OSS available | No |

### 4.2 Pimlico (Recommended for Multi-Chain)

```typescript
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { createSmartAccountClient } from 'permissionless';

const pimlicoClient = createPimlicoClient({
    transport: http(`https://api.pimlico.io/v2/${chainId}/rpc?apikey=${PIMLICO_API_KEY}`),
    entryPoint: { address: entryPoint07Address, version: '0.7' },
});

// Estimate gas
const gasEstimate = await pimlicoClient.estimateUserOperationGas({
    userOperation,
});

// Get paymaster sponsorship
const sponsorResult = await pimlicoClient.sponsorUserOperation({
    userOperation,
    entryPoint: entryPoint07Address,
});

// Send UserOp
const hash = await pimlicoClient.sendUserOperation({
    userOperation: sponsorResult.userOperation,
});

// Wait for receipt
const receipt = await pimlicoClient.waitForUserOperationReceipt({ hash });
```

### 4.3 Alchemy AA

```typescript
import { createModularAccountAlchemyClient } from '@alchemy/aa-alchemy';

const client = await createModularAccountAlchemyClient({
    apiKey: ALCHEMY_API_KEY,
    chain: sepolia,
    signer: localSigner,
    gasManagerConfig: {
        policyId: ALCHEMY_GAS_POLICY_ID,
    },
});

const result = await client.sendUserOperation({
    uo: {
        target: tokenAddress,
        data: transferCallData,
        value: 0n,
    },
});
```

### 4.4 Self-Hosted Bundler (Rundler by Alchemy)

For 600K users, consider self-hosting for cost optimization:

```yaml
# docker-compose.yml
version: '3.8'
services:
  rundler:
    image: alchemyplatform/rundler:latest
    ports:
      - "3000:3000"
    environment:
      - CHAIN_SPEC=base-mainnet
      - NODE_HTTP_URL=${RPC_URL}
      - ENTRY_POINTS=0x0000000071727De22E5E9d8BAf0edAc6f37da032
      - BUILDER_PRIVATE_KEY=${BUNDLER_PRIVATE_KEY}
      - MIN_BALANCE=0.5
    volumes:
      - rundler-data:/data

volumes:
  rundler-data:
```

### 4.5 Scaling for 600K Users

**Traffic Estimation**:
- 600K users × 1 sweep/month = 20K UserOps/day average
- Peak: 100K UserOps/day during market volatility

**Recommended Architecture**:

```
┌─────────────────────────────────────────────────────────────┐
│                        Load Balancer                         │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   Pimlico     │    │   Alchemy     │    │   Self-host   │
│  (Primary)    │    │  (Fallback)   │    │   (Backup)    │
└───────────────┘    └───────────────┘    └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                    Multi-Chain Router
                              │
        ┌─────────────────────┼─────────────────────┐
        │           │         │         │           │
        ▼           ▼         ▼         ▼           ▼
     Base      Arbitrum   Polygon    BNB       Linea
```

---

## 5. Permit2 for Gasless Approvals

### 5.1 Why Permit2?

Traditional ERC-20 approval requires a separate transaction (gas). Permit2 enables:
- **Signature-based approvals**: No gas for approval
- **Batch approvals**: Approve multiple tokens in one signature
- **Time-limited permissions**: Automatic expiry

**Canonical Address**: `0x000000000022D473030F116dDEE9F6B43aC78BA3` (all chains)

### 5.2 Integration Architecture

```
User Flow:
1. User signs Permit2 signature for dust tokens (off-chain)
2. User signs UserOp for sweep (off-chain)
3. Bundler submits UserOp which:
   a. Calls Permit2.permit() to grant approval
   b. Sweeps tokens to aggregator/DEX
   c. Paymaster collects USDC for gas
```

### 5.3 Permit2 Batch Signature

```typescript
import { IAllowanceTransfer } from '@uniswap/permit2-sdk';

interface PermitBatch {
    details: {
        token: Address;
        amount: bigint;       // uint160 max
        expiration: number;   // uint48 timestamp
        nonce: number;        // uint48
    }[];
    spender: Address;
    sigDeadline: bigint;
}

async function signPermit2Batch(
    tokens: Address[],
    spender: Address,      // Smart wallet address
    owner: Address,        // EOA signer
    signer: WalletClient,
    permit2Address: Address,
    chainId: number
): Promise<{ permit: PermitBatch; signature: Hex }> {
    const permit: PermitBatch = {
        details: tokens.map((token, i) => ({
            token,
            amount: 2n ** 160n - 1n,  // Max uint160
            expiration: Math.floor(Date.now() / 1000) + 3600,  // 1 hour
            nonce: 0,  // Query from Permit2 contract
        })),
        spender,
        sigDeadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
    };
    
    const domain = {
        name: 'Permit2',
        chainId,
        verifyingContract: permit2Address,
    };
    
    const types = {
        PermitBatch: [
            { name: 'details', type: 'PermitDetails[]' },
            { name: 'spender', type: 'address' },
            { name: 'sigDeadline', type: 'uint256' },
        ],
        PermitDetails: [
            { name: 'token', type: 'address' },
            { name: 'amount', type: 'uint160' },
            { name: 'expiration', type: 'uint48' },
            { name: 'nonce', type: 'uint48' },
        ],
    };
    
    const signature = await signer.signTypedData({
        account: owner,
        domain,
        types,
        primaryType: 'PermitBatch',
        message: permit,
    });
    
    return { permit, signature };
}
```

### 5.4 Smart Wallet Integration

```solidity
// In smart wallet's execute batch
function sweepWithPermit2(
    IAllowanceTransfer.PermitBatch calldata permitBatch,
    bytes calldata permitSignature,
    address[] calldata tokens,
    uint256[] calldata amounts,
    address aggregator,
    bytes calldata swapData
) external onlyOwner {
    // 1. Grant approvals via Permit2
    PERMIT2.permit(msg.sender, permitBatch, permitSignature);
    
    // 2. Transfer tokens to aggregator using Permit2
    for (uint i = 0; i < tokens.length; i++) {
        PERMIT2.transferFrom(
            msg.sender,        // from EOA
            address(this),     // to smart wallet
            uint160(amounts[i]),
            tokens[i]
        );
    }
    
    // 3. Execute swap via aggregator
    (bool success,) = aggregator.call(swapData);
    require(success, "Swap failed");
}
```

### 5.5 SignatureTransfer for One-Time Permits

For dust sweeping, `SignatureTransfer` is more gas-efficient:

```typescript
interface PermitTransferFrom {
    permitted: {
        token: Address;
        amount: bigint;
    };
    nonce: bigint;
    deadline: bigint;
}

async function signOneTimePermit(
    token: Address,
    amount: bigint,
    spender: Address,
    signer: WalletClient,
    chainId: number
): Promise<{ permit: PermitTransferFrom; signature: Hex }> {
    const nonce = BigInt(Date.now());  // Unique nonce
    
    const permit: PermitTransferFrom = {
        permitted: { token, amount },
        nonce,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
    };
    
    const types = {
        PermitTransferFrom: [
            { name: 'permitted', type: 'TokenPermissions' },
            { name: 'spender', type: 'address' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
        ],
        TokenPermissions: [
            { name: 'token', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
    };
    
    const signature = await signer.signTypedData({
        domain: { name: 'Permit2', chainId, verifyingContract: PERMIT2_ADDRESS },
        types,
        primaryType: 'PermitTransferFrom',
        message: { ...permit, spender },
    });
    
    return { permit, signature };
}
```

---

## 6. Recommended Stack for 600K Users

### 6.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Frontend (Web/Mobile)                      │
│  - Passkey registration & signing                                    │
│  - Permit2 signature collection                                      │
│  - UserOp construction                                               │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Backend API (Node.js)                        │
│  - Exchange rate oracle                                              │
│  - Paymaster signature generation                                    │
│  - UserOp simulation & validation                                    │
│  - Bundler routing & failover                                        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │   Pimlico   │ │   Alchemy   │ │  Self-host  │
            │  Bundler    │ │  Bundler    │ │  Rundler    │
            └─────────────┘ └─────────────┘ └─────────────┘
                    │               │               │
                    └───────────────┼───────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Smart Contracts                               │
│  - CoinbaseSmartWalletFactory (deploy wallets)                       │
│  - CoinbaseSmartWallet (per user)                                    │
│  - VerifyingPaymaster (gas abstraction)                              │
│  - Permit2 (gasless approvals)                                       │
│  - EntryPoint v0.7                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Technology Stack

| Component | Recommended | Alternative |
|-----------|-------------|-------------|
| Smart Wallet | Coinbase Smart Wallet | Safe, Kernel |
| Paymaster | Coinbase Verifying Paymaster | Pimlico Paymaster |
| Primary Bundler | Pimlico | Alchemy |
| Fallback Bundler | Alchemy | Stackup |
| Self-hosted | Rundler | Stackup bundler |
| SDK | permissionless.js | aa-sdk |
| Approvals | Permit2 | EIP-2612 |
| Backend | Node.js + TypeScript | Rust |
| Database | PostgreSQL + Redis | - |

### 6.3 Multi-Chain Configuration

```typescript
const CHAIN_CONFIGS: Record<number, ChainConfig> = {
    // Ethereum Mainnet
    1: {
        bundlerUrl: `https://api.pimlico.io/v2/1/rpc?apikey=${PIMLICO_KEY}`,
        paymasterAddress: '0x...', // Deploy per chain
        factoryAddress: '0xBA5ED110eFDBa3D005bfC882d75358ACBbB85842',
        entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
        permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
        supportedTokens: {
            USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
            USDT: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
        },
    },
    // Base
    8453: {
        bundlerUrl: `https://api.pimlico.io/v2/8453/rpc?apikey=${PIMLICO_KEY}`,
        paymasterAddress: '0x...',
        factoryAddress: '0xBA5ED110eFDBa3D005bfC882d75358ACBbB85842',
        entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
        permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
        supportedTokens: {
            USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
        },
    },
    // Arbitrum
    42161: { /* ... */ },
    // Polygon
    137: { /* ... */ },
    // BNB Chain
    56: { /* ... */ },
    // Linea
    59144: { /* ... */ },
};
```

---

## 7. Cost Analysis

### 7.1 Per UserOp Gas Breakdown

| Component | Gas (L1) | Gas (L2) | Notes |
|-----------|----------|----------|-------|
| preVerificationGas | ~50,000 | ~20,000 | Bundler overhead |
| verificationGasLimit | ~150,000 | ~100,000 | Account + paymaster validation |
| callGasLimit | ~200,000 | ~150,000 | Actual execution |
| paymasterPostOpGas | ~40,000 | ~30,000 | Token transfer |
| **Total** | ~440,000 | ~300,000 | - |

### 7.2 Cost Per UserOp (USD Estimates)

Assuming ETH = $3000, 30 gwei gas price (L1), 0.01 gwei (L2):

| Chain | Gas Used | Gas Price | ETH Cost | USD Cost |
|-------|----------|-----------|----------|----------|
| Ethereum L1 | 440,000 | 30 gwei | 0.0132 ETH | $39.60 |
| Base | 300,000 | 0.01 gwei | 0.000003 ETH | $0.009 |
| Arbitrum | 300,000 | 0.1 gwei | 0.00003 ETH | $0.09 |
| Polygon | 300,000 | 50 gwei | 0.015 MATIC | ~$0.01 |
| BNB Chain | 300,000 | 3 gwei | 0.0009 BNB | ~$0.54 |
| Linea | 300,000 | 0.05 gwei | 0.000015 ETH | $0.045 |

### 7.3 Monthly Cost for 600K Users

| Scenario | L1 % | L2 % | Avg Cost/Op | Total UserOps | Monthly Cost |
|----------|------|------|-------------|---------------|--------------|
| Conservative | 5% | 95% | $2.00 | 600,000 | $1,200,000 |
| L2 Focused | 1% | 99% | $0.50 | 600,000 | $300,000 |
| Pure L2 | 0% | 100% | $0.10 | 600,000 | $60,000 |

### 7.4 Revenue Model (5% Profit Margin)

| Scenario | Cost/Op | Charge/Op | Profit/Op | Monthly Profit |
|----------|---------|-----------|-----------|----------------|
| L2 Focused | $0.50 | $0.525 | $0.025 | $15,000 |
| Pure L2 | $0.10 | $0.105 | $0.005 | $3,000 |

### 7.5 Bundler API Costs

| Provider | Free Tier | Paid Plan | Est. Monthly (600K ops) |
|----------|-----------|-----------|-------------------------|
| Pimlico | 100 ops | $200/100K ops | $1,200 |
| Alchemy | 3M CU | $49/mo + overages | ~$500 |
| Self-hosted | N/A | Server cost | ~$300-500 |

---

## 8. Security Considerations

### 8.1 Smart Wallet Security

```typescript
// ✅ DO: Validate owner signatures
// ✅ DO: Use time-bounded validity for paymaster signatures
// ✅ DO: Implement rate limiting
// ✅ DO: Monitor for unusual activity patterns

// ❌ DON'T: Store private keys client-side (use passkeys)
// ❌ DON'T: Accept unbounded gas limits
// ❌ DON'T: Skip simulation before submission
```

### 8.2 Paymaster Security

```solidity
// Recommended paymaster configuration
PaymasterData memory secureConfig = PaymasterData({
    validUntil: uint48(block.timestamp + 5 minutes),  // Short expiry
    validAfter: uint48(block.timestamp),
    sponsorUUID: uniqueTrackingId,
    allowAnyBundler: false,        // Allowlist bundlers
    precheckBalance: true,         // Verify token balance
    prepaymentRequired: true,      // For new users
    token: USDC_ADDRESS,
    receiver: TREASURY_ADDRESS,
    exchangeRate: currentRate,
    postOpGas: 40000
});
```

### 8.3 Attack Mitigations

| Attack Vector | Mitigation |
|---------------|------------|
| Signature replay | ChainId + EntryPoint in hash, nonce system |
| Griefing (failed postOp) | prepaymentRequired flag |
| Exchange rate manipulation | Oracle + max slippage check |
| Bundler front-running | Allowlist trusted bundlers |
| Infinite approval | Use Permit2 with expiration |

### 8.4 ERC-7562 Validation Rules

During validation phase, smart accounts must NOT:
- Access other contracts' storage (except staked entities)
- Use forbidden opcodes: `CREATE`, `CREATE2` (in account), `SELFDESTRUCT`
- Access environment opcodes: `TIMESTAMP`, `BLOCKHASH`, `NUMBER`
- Use unbounded loops

---

## 9. Implementation Code Examples

### 9.1 Complete Dust Sweep Flow

```typescript
import { 
    createPublicClient, createWalletClient, http, encodeFunctionData,
    parseUnits, concat, pad, toHex, keccak256
} from 'viem';
import { createSmartAccountClient } from 'permissionless';
import { toCoinbaseSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';

async function sweepDustTokens(
    userAddress: Address,
    dustTokens: { token: Address; balance: bigint }[],
    chainId: number
) {
    const config = CHAIN_CONFIGS[chainId];
    
    // 1. Initialize clients
    const publicClient = createPublicClient({
        chain: chains[chainId],
        transport: http(config.rpcUrl),
    });
    
    const bundlerClient = createPimlicoClient({
        transport: http(config.bundlerUrl),
        entryPoint: { address: config.entryPoint, version: '0.7' },
    });
    
    // 2. Get or create smart wallet
    const smartAccount = await toCoinbaseSmartAccount({
        client: publicClient,
        owners: [userAddress],
        nonce: 0n,
    });
    
    // 3. Build batch swap calls
    const calls = dustTokens.map(({ token, balance }) => ({
        to: config.aggregator,
        value: 0n,
        data: encodeFunctionData({
            abi: aggregatorAbi,
            functionName: 'swap',
            args: [token, config.supportedTokens.USDC.address, balance, 0n],
        }),
    }));
    
    // 4. Get paymaster signature from backend
    const paymasterResponse = await fetch('/api/paymaster/sign', {
        method: 'POST',
        body: JSON.stringify({
            sender: smartAccount.address,
            callData: encodeFunctionData({
                abi: coinbaseSmartWalletAbi,
                functionName: 'executeBatch',
                args: [calls],
            }),
            chainId,
        }),
    }).then(r => r.json());
    
    // 5. Build UserOp with paymaster data
    const smartAccountClient = createSmartAccountClient({
        account: smartAccount,
        chain: chains[chainId],
        bundlerTransport: http(config.bundlerUrl),
        paymaster: {
            getPaymasterData: async () => ({
                paymasterAndData: paymasterResponse.paymasterAndData,
            }),
        },
    });
    
    // 6. Submit UserOp
    const hash = await smartAccountClient.sendUserOperation({
        calls,
    });
    
    // 7. Wait for confirmation
    const receipt = await bundlerClient.waitForUserOperationReceipt({ hash });
    
    return receipt;
}
```

### 9.2 Backend Paymaster Service

```typescript
import { Hono } from 'hono';
import { privateKeyToAccount } from 'viem/accounts';

const app = new Hono();

const paymasterSigner = privateKeyToAccount(process.env.PAYMASTER_SIGNER_KEY as Hex);

app.post('/api/paymaster/sign', async (c) => {
    const { sender, callData, chainId } = await c.req.json();
    const config = CHAIN_CONFIGS[chainId];
    
    // 1. Simulate UserOp to get gas estimates
    const publicClient = createPublicClient({
        chain: chains[chainId],
        transport: http(config.rpcUrl),
    });
    
    // 2. Get current exchange rate
    const ethPrice = await getEthPrice();
    const usdcPrice = 1; // Stablecoin
    const exchangeRate = calculateExchangeRate(ethPrice, usdcPrice, 6, 5);
    
    // 3. Build paymaster data
    const paymasterData: PaymasterData = {
        validUntil: Math.floor(Date.now() / 1000) + 300,
        validAfter: Math.floor(Date.now() / 1000),
        sponsorUUID: generateUUID(),
        allowAnyBundler: false,
        precheckBalance: true,
        prepaymentRequired: false,
        token: config.supportedTokens.USDC.address,
        receiver: TREASURY_ADDRESS,
        exchangeRate,
        postOpGas: 40000,
    };
    
    // 4. Create partial UserOp for hash computation
    const userOp = {
        sender,
        nonce: await getNonce(publicClient, sender),
        initCode: '0x',
        callData,
        accountGasLimits: packGasLimits(150000n, 200000n),
        preVerificationGas: 50000n,
        gasFees: packGasFees(1000000n, await publicClient.getGasPrice()),
        paymasterAndData: '0x',
        signature: '0x',
    };
    
    // 5. Sign paymaster data
    const paymasterHash = computePaymasterHash(
        userOp,
        paymasterData,
        100000n,
        50000n,
        config.paymasterAddress,
        chainId
    );
    
    const signature = await paymasterSigner.signMessage({
        message: { raw: paymasterHash },
    });
    
    // 6. Build complete paymasterAndData
    const paymasterAndData = buildPaymasterAndData(
        config.paymasterAddress,
        100000n,
        50000n,
        paymasterData,
        signature
    );
    
    return c.json({
        paymasterAndData,
        maxTokenCost: calculateMaxTokenCost(userOp, paymasterData),
    });
});

export default app;
```

### 9.3 Smart Wallet Deployment Script

```typescript
import { createWalletClient, http, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

async function deployWalletsMultiChain(
    ownerAddresses: Address[],
    targetChains: number[]
) {
    const deployments: Record<Address, Record<number, boolean>> = {};
    
    for (const owner of ownerAddresses) {
        const owners = [encodeAbiParameters([{ type: 'address' }], [owner])];
        
        // Compute deterministic address
        const walletAddress = await getSmartWalletAddress(owners, 0n);
        deployments[owner] = {};
        
        for (const chainId of targetChains) {
            const config = CHAIN_CONFIGS[chainId];
            const publicClient = createPublicClient({
                chain: chains[chainId],
                transport: http(config.rpcUrl),
            });
            
            // Check if already deployed
            const code = await publicClient.getBytecode({ address: walletAddress });
            if (code && code !== '0x') {
                deployments[owner][chainId] = true;
                continue;
            }
            
            // Deploy via UserOp
            const initCode = buildInitCode(owners, 0n);
            
            const bundlerClient = createPimlicoClient({
                transport: http(config.bundlerUrl),
                entryPoint: { address: config.entryPoint, version: '0.7' },
            });
            
            const userOp = {
                sender: walletAddress,
                nonce: 0n,
                initCode,
                callData: '0x',  // Empty call, just deploy
                // ... gas fields
            };
            
            // Get paymaster sponsorship for deployment
            const sponsored = await sponsorUserOp(userOp, chainId);
            
            // Sign and send
            const hash = await bundlerClient.sendUserOperation({
                userOperation: sponsored,
            });
            
            await bundlerClient.waitForUserOperationReceipt({ hash });
            deployments[owner][chainId] = true;
        }
    }
    
    return deployments;
}
```

---

## Summary: Recommended Implementation

### Phase 1: Foundation (Weeks 1-2)
1. Deploy Coinbase Smart Wallet Factory (verified on all chains)
2. Deploy VerifyingPaymaster with ERC-20 support
3. Set up Pimlico as primary bundler
4. Implement paymaster signature service

### Phase 2: Core Features (Weeks 3-4)
1. Passkey registration flow
2. Permit2 integration for gasless approvals
3. Multi-chain wallet deployment
4. Dust token detection and sweeping

### Phase 3: Scale & Optimize (Weeks 5-6)
1. Add Alchemy as failover bundler
2. Implement exchange rate oracle
3. Set up monitoring and alerting
4. Optimize gas estimates

### Phase 4: Production (Week 7+)
1. Self-hosted bundler for cost reduction
2. Rate limiting and abuse prevention
3. User analytics dashboard
4. Mobile SDK integration

---

## Key Contract Addresses

| Contract | Address | Networks |
|----------|---------|----------|
| EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | All EVM |
| CoinbaseSmartWalletFactory | `0xBA5ED110eFDBa3D005bfC882d75358ACBbB85842` | All EVM |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | All EVM |
| VerifyingPaymaster | Deploy per chain | - |

---

## References

- [EIP-4337 Specification](https://eips.ethereum.org/EIPS/eip-4337)
- [Coinbase Smart Wallet](https://github.com/coinbase/smart-wallet)
- [Coinbase Verifying Paymaster](https://github.com/coinbase/verifying-paymaster)
- [Uniswap Permit2](https://github.com/Uniswap/permit2)
- [Pimlico Documentation](https://docs.pimlico.io)
- [permissionless.js](https://docs.pimlico.io/permissionless)
