export interface Network {
  id: string;
  name: string;
  icon: string;
  rpcUrl: string;
  explorerApi: string;
  chainId: number;
}

export const NETWORKS: Network[] = [
  {
    id: "ethereum",
    name: "Ethereum Mainnet",
    icon: "🔷",
    rpcUrl: "https://eth.llamarpc.com",
    explorerApi: "https://api.etherscan.io/api",
    chainId: 1,
  },
  {
    id: "polygon",
    name: "Polygon",
    icon: "🟣",
    rpcUrl: "https://polygon.llamarpc.com",
    explorerApi: "https://api.polygonscan.com/api",
    chainId: 137,
  },
  {
    id: "arbitrum",
    name: "Arbitrum One",
    icon: "🔵",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    explorerApi: "https://api.arbiscan.io/api",
    chainId: 42161,
  },
  {
    id: "base",
    name: "Base",
    icon: "🔵",
    rpcUrl: "https://mainnet.base.org",
    explorerApi: "https://api.basescan.org/api",
    chainId: 8453,
  },
  {
    id: "optimism",
    name: "Optimism",
    icon: "🔴",
    rpcUrl: "https://mainnet.optimism.io",
    explorerApi: "https://api-optimistic.etherscan.io/api",
    chainId: 10,
  },
  {
    id: "bsc",
    name: "BNB Smart Chain",
    icon: "🟡",
    rpcUrl: "https://bsc-dataseed.binance.org",
    explorerApi: "https://api.bscscan.com/api",
    chainId: 56,
  },
  {
    id: "avalanche",
    name: "Avalanche C-Chain",
    icon: "🔺",
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
    explorerApi: "https://api.snowtrace.io/api",
    chainId: 43114,
  },
  {
    id: "custom",
    name: "Custom RPC",
    icon: "⚙️",
    rpcUrl: "",
    explorerApi: "",
    chainId: 0,
  },
];

export async function fetchAbiFromExplorer(
  address: string,
  explorerApi: string,
  chainId?: number
): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || "";
  
  // Use Etherscan V2 API for Etherscan-family explorers (requires chainid)
  const isEtherscanFamily = explorerApi.includes("etherscan.io") || 
                            explorerApi.includes("polygonscan.com") ||
                            explorerApi.includes("arbiscan.io") ||
                            explorerApi.includes("basescan.org") ||
                            explorerApi.includes("bscscan.com") ||
                            explorerApi.includes("snowtrace.io");
  
  let url: string;
  if (isEtherscanFamily && chainId) {
    // Etherscan V2 API format
    const baseUrl = "https://api.etherscan.io/v2/api";
    url = `${baseUrl}?chainid=${chainId}&module=contract&action=getabi&address=${address}`;
    if (apiKey) url += `&apikey=${apiKey}`;
  } else {
    // Fallback to original explorer API
    url = `${explorerApi}?module=contract&action=getabi&address=${address}`;
    if (apiKey) url += `&apikey=${apiKey}`;
  }
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.status === "1" && data.result) {
    return data.result;
  }
  
  throw new Error(data.message || "Failed to fetch ABI");
}

// Verify RPC connection is working
export async function verifyRpcConnection(rpcUrl: string): Promise<boolean> {
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_chainId",
        params: [],
        id: 1,
      }),
    });
    const data = await response.json();
    return !!data.result;
  } catch {
    return false;
  }
}

// Detect contract name from chain
export async function detectContractName(
  address: string,
  rpcUrl: string
): Promise<string | null> {
  try {
    // Call name() function - selector 0x06fdde03
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_call",
        params: [
          { to: address, data: "0x06fdde03" },
          "latest",
        ],
        id: 1,
      }),
    });
    const data = await response.json();
    
    if (data.result && data.result !== "0x") {
      // Decode the string from ABI-encoded response
      const hex = data.result.slice(2);
      if (hex.length >= 128) {
        const length = parseInt(hex.slice(64, 128), 16);
        const nameHex = hex.slice(128, 128 + length * 2);
        const name = Buffer.from(nameHex, "hex").toString("utf8");
        return name || null;
      }
    }
    return null;
  } catch {
    return null;
  }
}
