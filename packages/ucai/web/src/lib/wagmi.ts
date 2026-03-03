import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, polygon, arbitrum, base, optimism } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "UCAI - MCP Server Builder",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo",
  chains: [mainnet, polygon, arbitrum, base, optimism],
  ssr: true,
});
