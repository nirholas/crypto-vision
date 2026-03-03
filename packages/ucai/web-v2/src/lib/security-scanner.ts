// Security Scanner - Detects common smart contract risks
// Analyzes source code and ABI for red flags

export interface SecurityRisk {
  id: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  line?: number;
  pattern?: string;
}

export interface SecurityReport {
  address: string;
  overallScore: number; // 0-100 (100 = safest)
  riskLevel: "safe" | "caution" | "warning" | "danger";
  risks: SecurityRisk[];
  positives: string[];
  contractName?: string;
  isVerified: boolean;
  isProxy: boolean;
  hasSourceCode: boolean;
}

// Pattern definitions for risk detection
const CRITICAL_PATTERNS = [
  {
    id: "selfdestruct",
    pattern: /selfdestruct|suicide/gi,
    title: "Self-Destruct Function",
    description: "Contract can be destroyed, potentially draining all funds",
  },
  {
    id: "delegatecall-arbitrary",
    pattern: /delegatecall\s*\(\s*[^)]*(?:data|calldata|msg\.data)/gi,
    title: "Arbitrary Delegatecall",
    description: "Can execute arbitrary code, leading to complete contract takeover",
  },
  {
    id: "tx-origin",
    pattern: /tx\.origin/gi,
    title: "tx.origin Authentication",
    description: "Vulnerable to phishing attacks - should use msg.sender instead",
  },
];

const HIGH_PATTERNS = [
  {
    id: "hidden-mint",
    pattern: /function\s+(?:_)?mint\s*\(|\.mint\s*\(/gi,
    title: "Mint Function Detected",
    description: "Owner may be able to create unlimited tokens (inflation risk)",
  },
  {
    id: "hidden-burn",
    pattern: /function\s+(?:_)?burn(?:From)?\s*\(/gi,
    title: "Burn Function Detected",
    description: "Tokens can be burned - check if owner-only",
  },
  {
    id: "pause-function",
    pattern: /function\s+(?:_)?pause\s*\(|whenNotPaused|Pausable/gi,
    title: "Pausable Contract",
    description: "Owner can pause all transfers - potential rug pull vector",
  },
  {
    id: "blacklist",
    pattern: /blacklist|blocklist|banned|frozen|freeze/gi,
    title: "Blacklist Mechanism",
    description: "Owner can freeze specific addresses from transacting",
  },
  {
    id: "fee-manipulation",
    pattern: /(?:set|update|change)(?:Tax|Fee|Rate)\s*\(|taxRate|feePercent/gi,
    title: "Adjustable Fees",
    description: "Transaction fees can be changed - watch for fee increases",
  },
  {
    id: "max-tx",
    pattern: /maxTx(?:Amount)?|maxWallet|maxBuy|maxSell/gi,
    title: "Transaction Limits",
    description: "May restrict how much you can buy/sell - honeypot indicator",
  },
  {
    id: "ownership-renounce-missing",
    pattern: /Ownable/gi,
    title: "Ownable Contract",
    description: "Contract has an owner - check if ownership is renounced",
  },
];

const MEDIUM_PATTERNS = [
  {
    id: "transfer-restriction",
    pattern: /require\s*\([^)]*(?:canTransfer|isAllowed|!(?:blacklist|banned))/gi,
    title: "Transfer Restrictions",
    description: "Transfers may be restricted under certain conditions",
  },
  {
    id: "hidden-owner",
    pattern: /(?:_)?owner\s*=\s*(?!msg\.sender)/gi,
    title: "Hardcoded Owner Address",
    description: "Owner is hardcoded - verify it's a trusted address",
  },
  {
    id: "external-call",
    pattern: /\.call\{|\.call\(|\.send\(|\.transfer\(/gi,
    title: "External Calls",
    description: "Makes external calls - potential reentrancy if not guarded",
  },
  {
    id: "assembly",
    pattern: /assembly\s*\{/gi,
    title: "Inline Assembly",
    description: "Uses low-level assembly code - harder to audit",
  },
  {
    id: "proxy-pattern",
    pattern: /Proxy|Upgradeable|implementation|_implementation/gi,
    title: "Proxy/Upgradeable Contract",
    description: "Logic can be changed - trust depends on upgrade mechanism",
  },
];

const LOW_PATTERNS = [
  {
    id: "timestamp-dependence",
    pattern: /block\.timestamp|now\s*[<>=]/gi,
    title: "Timestamp Dependence",
    description: "Uses block timestamp - minor manipulation possible by miners",
  },
  {
    id: "unchecked-math",
    pattern: /unchecked\s*\{/gi,
    title: "Unchecked Math",
    description: "Uses unchecked arithmetic - intentional gas optimization",
  },
];

// Positive indicators
const POSITIVE_PATTERNS = [
  {
    pattern: /ReentrancyGuard|nonReentrant/gi,
    message: "✓ Reentrancy protection enabled",
  },
  {
    pattern: /SafeMath|SafeERC20/gi,
    message: "✓ Uses safe math operations",
  },
  {
    pattern: /renounceOwnership/gi,
    message: "✓ Ownership can be renounced",
  },
  {
    pattern: /OpenZeppelin|@openzeppelin/gi,
    message: "✓ Uses OpenZeppelin (audited library)",
  },
  {
    pattern: /SPDX-License-Identifier/gi,
    message: "✓ Has SPDX license",
  },
  {
    pattern: /\/\*\*[\s\S]*?@notice|\/\/\/\s*@/gi,
    message: "✓ Has NatSpec documentation",
  },
];

export function analyzeSourceCode(sourceCode: string): {
  risks: SecurityRisk[];
  positives: string[];
} {
  const risks: SecurityRisk[] = [];
  const positives: string[] = [];

  // Check critical patterns
  for (const pattern of CRITICAL_PATTERNS) {
    const matches = sourceCode.match(pattern.pattern);
    if (matches) {
      risks.push({
        id: pattern.id,
        severity: "critical",
        title: pattern.title,
        description: pattern.description,
        pattern: matches[0],
      });
    }
  }

  // Check high patterns
  for (const pattern of HIGH_PATTERNS) {
    const matches = sourceCode.match(pattern.pattern);
    if (matches) {
      risks.push({
        id: pattern.id,
        severity: "high",
        title: pattern.title,
        description: pattern.description,
        pattern: matches[0],
      });
    }
  }

  // Check medium patterns
  for (const pattern of MEDIUM_PATTERNS) {
    const matches = sourceCode.match(pattern.pattern);
    if (matches) {
      risks.push({
        id: pattern.id,
        severity: "medium",
        title: pattern.title,
        description: pattern.description,
        pattern: matches[0],
      });
    }
  }

  // Check low patterns
  for (const pattern of LOW_PATTERNS) {
    const matches = sourceCode.match(pattern.pattern);
    if (matches) {
      risks.push({
        id: pattern.id,
        severity: "low",
        title: pattern.title,
        description: pattern.description,
        pattern: matches[0],
      });
    }
  }

  // Check positive patterns
  for (const pattern of POSITIVE_PATTERNS) {
    if (pattern.pattern.test(sourceCode)) {
      positives.push(pattern.message);
    }
  }

  // Dedupe risks by id
  const uniqueRisks = risks.filter(
    (risk, index, self) => index === self.findIndex((r) => r.id === risk.id)
  );

  return { risks: uniqueRisks, positives: [...new Set(positives)] };
}

export function analyzeAbi(abi: unknown[]): SecurityRisk[] {
  const risks: SecurityRisk[] = [];

  const abiString = JSON.stringify(abi);
  const functions = abi.filter((item: any) => item.type === "function");

  // Check for dangerous function names
  const dangerousFunctions = [
    { name: "setFee", risk: "Fee can be changed" },
    { name: "setTax", risk: "Tax can be changed" },
    { name: "setMaxTx", risk: "Max transaction can be changed" },
    { name: "setMaxWallet", risk: "Max wallet can be changed" },
    { name: "blacklist", risk: "Addresses can be blacklisted" },
    { name: "pause", risk: "Contract can be paused" },
    { name: "mint", risk: "New tokens can be minted" },
    { name: "withdraw", risk: "Funds can be withdrawn by owner" },
    { name: "setOwner", risk: "Ownership can be transferred" },
  ];

  for (const func of functions) {
    const funcName = (func as any).name?.toLowerCase() || "";
    for (const dangerous of dangerousFunctions) {
      if (funcName.includes(dangerous.name.toLowerCase())) {
        risks.push({
          id: `abi-${dangerous.name}`,
          severity: "medium",
          title: `${dangerous.name} Function`,
          description: dangerous.risk,
        });
      }
    }
  }

  // Check if there's no way to recover funds
  const hasWithdraw = abiString.toLowerCase().includes("withdraw");
  const hasRescue = abiString.toLowerCase().includes("rescue");
  if (!hasWithdraw && !hasRescue) {
    risks.push({
      id: "no-rescue",
      severity: "info",
      title: "No Rescue Function",
      description: "No withdraw/rescue function - stuck tokens cannot be recovered",
    });
  }

  return risks;
}

export function calculateScore(risks: SecurityRisk[]): {
  score: number;
  riskLevel: "safe" | "caution" | "warning" | "danger";
} {
  let score = 100;

  for (const risk of risks) {
    switch (risk.severity) {
      case "critical":
        score -= 30;
        break;
      case "high":
        score -= 15;
        break;
      case "medium":
        score -= 8;
        break;
      case "low":
        score -= 3;
        break;
      case "info":
        score -= 1;
        break;
    }
  }

  score = Math.max(0, Math.min(100, score));

  let riskLevel: "safe" | "caution" | "warning" | "danger";
  if (score >= 80) {
    riskLevel = "safe";
  } else if (score >= 60) {
    riskLevel = "caution";
  } else if (score >= 40) {
    riskLevel = "warning";
  } else {
    riskLevel = "danger";
  }

  return { score, riskLevel };
}

export function generateSecurityReport(
  address: string,
  sourceCode: string | null,
  abi: unknown[] | null,
  isVerified: boolean,
  contractName?: string
): SecurityReport {
  let risks: SecurityRisk[] = [];
  let positives: string[] = [];

  // Analyze source code if available
  if (sourceCode) {
    const sourceAnalysis = analyzeSourceCode(sourceCode);
    risks = [...risks, ...sourceAnalysis.risks];
    positives = [...positives, ...sourceAnalysis.positives];
  } else {
    risks.push({
      id: "no-source",
      severity: "high",
      title: "Source Code Not Available",
      description: "Contract source is not verified - cannot analyze for risks",
    });
  }

  // Analyze ABI
  if (abi) {
    const abiRisks = analyzeAbi(abi);
    risks = [...risks, ...abiRisks];
  }

  // Add verification status
  if (isVerified) {
    positives.push("✓ Contract is verified on block explorer");
  } else {
    risks.push({
      id: "not-verified",
      severity: "high",
      title: "Contract Not Verified",
      description: "Source code not verified - high risk of malicious code",
    });
  }

  // Check for proxy
  const isProxy = sourceCode
    ? /Proxy|Upgradeable|implementation/gi.test(sourceCode)
    : false;

  // Calculate score
  const { score, riskLevel } = calculateScore(risks);

  // Sort risks by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  risks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    address,
    overallScore: score,
    riskLevel,
    risks,
    positives,
    contractName,
    isVerified,
    isProxy,
    hasSourceCode: !!sourceCode,
  };
}
