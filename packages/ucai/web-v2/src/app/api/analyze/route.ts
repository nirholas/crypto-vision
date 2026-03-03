import { type NextRequest, NextResponse } from "next/server";
import { generateSecurityReport, SecurityReport } from "@/lib/security-scanner";
import { generateBasicExplanation, type ContractExplanation } from "@/lib/contract-whisperer";

interface ExplorerConfig {
  api: string;
  apiKey?: string;
}

const EXPLORERS: Record<string, ExplorerConfig> = {
  ethereum: { api: "https://api.etherscan.io/api" },
  polygon: { api: "https://api.polygonscan.com/api" },
  arbitrum: { api: "https://api.arbiscan.io/api" },
  base: { api: "https://api.basescan.org/api" },
  optimism: { api: "https://api-optimistic.etherscan.io/api" },
  bsc: { api: "https://api.bscscan.com/api" },
  avalanche: { api: "https://api.snowtrace.io/api" },
};

export async function POST(request: NextRequest) {
  try {
    const { address, network } = await request.json();

    if (!address || !network) {
      return NextResponse.json(
        { error: "Address and network are required" },
        { status: 400 }
      );
    }

    const explorer = EXPLORERS[network];
    if (!explorer) {
      return NextResponse.json(
        { error: "Unsupported network" },
        { status: 400 }
      );
    }

    // Fetch ABI
    const abiResponse = await fetch(
      `${explorer.api}?module=contract&action=getabi&address=${address}`
    );
    const abiData = await abiResponse.json();
    
    let abi: unknown[] | null = null;
    let isVerified = false;
    
    if (abiData.status === "1" && abiData.result) {
      try {
        abi = JSON.parse(abiData.result);
        isVerified = true;
      } catch {
        abi = null;
      }
    }

    // Fetch source code
    const sourceResponse = await fetch(
      `${explorer.api}?module=contract&action=getsourcecode&address=${address}`
    );
    const sourceData = await sourceResponse.json();

    let sourceCode: string | null = null;
    let contractName: string | undefined;
    let compilerVersion: string | undefined;
    let isProxy = false;
    let implementationAddress: string | undefined;

    if (sourceData.status === "1" && sourceData.result?.[0]) {
      const result = sourceData.result[0];
      sourceCode = result.SourceCode || null;
      contractName = result.ContractName || undefined;
      compilerVersion = result.CompilerVersion || undefined;
      
      // Check if it's a proxy
      if (result.Implementation && result.Implementation !== "") {
        isProxy = true;
        implementationAddress = result.Implementation;
      }

      // Handle JSON-formatted source code (multi-file contracts)
      if (sourceCode && sourceCode.startsWith("{")) {
        try {
          // Remove double braces if present (Etherscan format)
          let jsonSource = sourceCode;
          if (sourceCode.startsWith("{{")) {
            jsonSource = sourceCode.slice(1, -1);
          }
          const parsed = JSON.parse(jsonSource);
          
          // Combine all source files
          if (parsed.sources) {
            sourceCode = Object.values(parsed.sources)
              .map((file: any) => file.content)
              .join("\n\n");
          }
        } catch {
          // Keep original source code
        }
      }
    }

    // If it's a proxy, also fetch implementation source
    let implementationSource: string | null = null;
    if (isProxy && implementationAddress) {
      const implResponse = await fetch(
        `${explorer.api}?module=contract&action=getsourcecode&address=${implementationAddress}`
      );
      const implData = await implResponse.json();
      
      if (implData.status === "1" && implData.result?.[0]) {
        implementationSource = implData.result[0].SourceCode || null;
        
        // Handle JSON format
        if (implementationSource && implementationSource.startsWith("{")) {
          try {
            let jsonSource = implementationSource;
            if (implementationSource.startsWith("{{")) {
              jsonSource = implementationSource.slice(1, -1);
            }
            const parsed = JSON.parse(jsonSource);
            if (parsed.sources) {
              implementationSource = Object.values(parsed.sources)
                .map((file: any) => file.content)
                .join("\n\n");
            }
          } catch {
            // Keep original
          }
        }
        
        // Use implementation source for analysis
        if (implementationSource) {
          sourceCode = implementationSource;
        }
      }
    }

    // Generate security report
    const securityReport = generateSecurityReport(
      address,
      sourceCode,
      abi,
      isVerified,
      contractName
    );

    // Generate contract explanation
    let explanation: ContractExplanation | null = null;
    if (abi) {
      explanation = generateBasicExplanation(abi, contractName);
    }

    return NextResponse.json({
      success: true,
      address,
      network,
      contractName,
      compilerVersion,
      isVerified,
      isProxy,
      implementationAddress,
      hasSourceCode: !!sourceCode,
      sourceCodeLength: sourceCode?.length || 0,
      securityReport,
      explanation,
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze contract" },
      { status: 500 }
    );
  }
}
