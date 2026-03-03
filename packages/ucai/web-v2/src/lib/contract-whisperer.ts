// Contract Whisperer - AI-powered contract explanation
// Uses Claude to explain smart contracts in plain English

export interface ContractExplanation {
  summary: string;
  purpose: string;
  mainFunctions: FunctionExplanation[];
  permissions: PermissionExplanation[];
  tokenomics?: TokenomicsExplanation;
  riskSummary: string;
}

export interface FunctionExplanation {
  name: string;
  type: "read" | "write" | "payable";
  description: string;
  userFacing: boolean;
}

export interface PermissionExplanation {
  role: string;
  capabilities: string[];
  riskLevel: "safe" | "moderate" | "dangerous";
}

export interface TokenomicsExplanation {
  totalSupply?: string;
  hasMaxSupply: boolean;
  canMint: boolean;
  canBurn: boolean;
  hasFees: boolean;
  feeDescription?: string;
}

// Generate a prompt for Claude to analyze the contract
export function generateAnalysisPrompt(
  sourceCode: string,
  abi: unknown[],
  contractName?: string
): string {
  return `You are an expert smart contract auditor. Analyze this Solidity contract and provide a clear, user-friendly explanation.

Contract Name: ${contractName || "Unknown"}

Source Code:
\`\`\`solidity
${sourceCode.slice(0, 15000)}${sourceCode.length > 15000 ? "\n// ... (truncated)" : ""}
\`\`\`

ABI (first 20 functions):
\`\`\`json
${JSON.stringify(abi.slice(0, 20), null, 2)}
\`\`\`

Provide your analysis in the following JSON format:
{
  "summary": "One sentence explaining what this contract does",
  "purpose": "2-3 sentences on the contract's main purpose and use case",
  "mainFunctions": [
    {
      "name": "functionName",
      "type": "read|write|payable",
      "description": "What this function does in plain English",
      "userFacing": true/false (is this meant for regular users?)
    }
  ],
  "permissions": [
    {
      "role": "Owner/Admin/Anyone",
      "capabilities": ["List of things this role can do"],
      "riskLevel": "safe|moderate|dangerous"
    }
  ],
  "tokenomics": {
    "totalSupply": "1,000,000 tokens" or null,
    "hasMaxSupply": true/false,
    "canMint": true/false,
    "canBurn": true/false,
    "hasFees": true/false,
    "feeDescription": "X% on buys, Y% on sells" or null
  },
  "riskSummary": "2-3 sentences summarizing the main risks users should be aware of"
}

Focus on:
1. What a regular user needs to know
2. Any hidden or dangerous owner powers
3. Token mechanics (fees, limits, blacklists)
4. Red flags for potential scams

Respond with ONLY the JSON, no other text.`;
}

// Parse the AI response
export function parseAIResponse(response: string): ContractExplanation | null {
  try {
    // Extract JSON from response (in case there's extra text)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed as ContractExplanation;
  } catch {
    return null;
  }
}

// Generate explanation without AI (fallback)
export function generateBasicExplanation(
  abi: unknown[],
  contractName?: string
): ContractExplanation {
  const functions = (abi as any[]).filter((item) => item.type === "function");
  const events = (abi as any[]).filter((item) => item.type === "event");

  // Detect contract type
  const isERC20 = functions.some(
    (f) => f.name === "transfer" || f.name === "approve"
  );
  const isERC721 = functions.some(
    (f) => f.name === "safeTransferFrom" || f.name === "ownerOf"
  );
  const isERC1155 = functions.some((f) => f.name === "balanceOfBatch");

  let purpose = "This is a smart contract on the blockchain.";
  if (isERC20) {
    purpose = "This is an ERC-20 token contract that implements a fungible token standard.";
  } else if (isERC721) {
    purpose = "This is an ERC-721 NFT contract that implements unique, non-fungible tokens.";
  } else if (isERC1155) {
    purpose = "This is an ERC-1155 multi-token contract supporting both fungible and non-fungible tokens.";
  }

  // Analyze functions
  const mainFunctions: FunctionExplanation[] = functions.slice(0, 10).map((f: any) => {
    const isView = f.stateMutability === "view" || f.stateMutability === "pure";
    const isPayable = f.stateMutability === "payable";
    
    return {
      name: f.name,
      type: isPayable ? "payable" : isView ? "read" : "write",
      description: describeFunction(f.name, f.inputs, f.outputs),
      userFacing: !f.name.startsWith("_") && !f.name.includes("admin"),
    };
  });

  // Detect permissions
  const permissions: PermissionExplanation[] = [];
  const ownerFunctions = functions.filter(
    (f: any) =>
      f.name.toLowerCase().includes("owner") ||
      f.name.toLowerCase().includes("admin") ||
      f.name.toLowerCase().includes("set")
  );

  if (ownerFunctions.length > 0) {
    permissions.push({
      role: "Owner/Admin",
      capabilities: ownerFunctions.map((f: any) => f.name),
      riskLevel: ownerFunctions.length > 5 ? "dangerous" : "moderate",
    });
  }

  permissions.push({
    role: "Anyone",
    capabilities: ["Can call public view functions", "Can interact if allowed"],
    riskLevel: "safe",
  });

  // Detect tokenomics
  const canMint = functions.some((f: any) => f.name.toLowerCase().includes("mint"));
  const canBurn = functions.some((f: any) => f.name.toLowerCase().includes("burn"));
  const hasFees = functions.some(
    (f: any) =>
      f.name.toLowerCase().includes("fee") || f.name.toLowerCase().includes("tax")
  );

  const tokenomics: TokenomicsExplanation | undefined = isERC20
    ? {
        hasMaxSupply: functions.some((f: any) => f.name === "maxSupply"),
        canMint,
        canBurn,
        hasFees,
        feeDescription: hasFees ? "Contract has configurable fees" : undefined,
      }
    : undefined;

  return {
    summary: contractName
      ? `${contractName} - ${isERC20 ? "ERC-20 Token" : isERC721 ? "ERC-721 NFT" : "Smart Contract"}`
      : `${isERC20 ? "ERC-20 Token" : isERC721 ? "ERC-721 NFT" : "Smart Contract"}`,
    purpose,
    mainFunctions,
    permissions,
    tokenomics,
    riskSummary: generateRiskSummary(canMint, canBurn, hasFees, ownerFunctions.length),
  };
}

function describeFunction(name: string, inputs: any[], outputs: any[]): string {
  const inputDesc = inputs?.length
    ? `Takes ${inputs.map((i) => i.name || i.type).join(", ")}`
    : "No parameters";
  const outputDesc = outputs?.length
    ? `Returns ${outputs.map((o) => o.type).join(", ")}`
    : "";

  // Common function descriptions
  const descriptions: Record<string, string> = {
    transfer: "Send tokens to another address",
    transferFrom: "Send tokens on behalf of another address (requires approval)",
    approve: "Allow another address to spend your tokens",
    allowance: "Check how many tokens an address can spend on your behalf",
    balanceOf: "Check the token balance of an address",
    totalSupply: "Get the total number of tokens in existence",
    name: "Get the token name",
    symbol: "Get the token symbol",
    decimals: "Get the number of decimal places",
    mint: "Create new tokens (usually admin only)",
    burn: "Destroy tokens permanently",
    pause: "Pause all transfers (admin only)",
    unpause: "Resume transfers (admin only)",
    owner: "Get the contract owner address",
    renounceOwnership: "Give up owner privileges permanently",
    transferOwnership: "Transfer owner privileges to another address",
  };

  return descriptions[name] || `${inputDesc}. ${outputDesc}`.trim();
}

function generateRiskSummary(
  canMint: boolean,
  canBurn: boolean,
  hasFees: boolean,
  ownerPowers: number
): string {
  const risks: string[] = [];

  if (canMint) {
    risks.push("tokens can be minted (potential inflation)");
  }
  if (hasFees) {
    risks.push("transaction fees may apply");
  }
  if (ownerPowers > 5) {
    risks.push("owner has significant control over the contract");
  }

  if (risks.length === 0) {
    return "No major risks detected. Always DYOR (Do Your Own Research) before interacting with any smart contract.";
  }

  return `Be aware that ${risks.join(", ")}. Always verify the contract source code and team before investing.`;
}
