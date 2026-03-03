"use client";

import { useState, useEffect } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ServerConfig {
  id: string;
  name: string;
  rpcUrl: string;
  abi: string;
  createdAt: string;
}

const getStorageKey = (address: string) => `ucai-servers-${address.toLowerCase()}`;

export default function Home() {
  const { address, isConnected } = useAccount();
  const [serverName, setServerName] = useState("");
  const [rpcUrl, setRpcUrl] = useState("");
  const [abi, setAbi] = useState("");
  const [servers, setServers] = useState<ServerConfig[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [generatedConfig, setGeneratedConfig] = useState<string | null>(null);

  // Load servers from localStorage when wallet connects
  useEffect(() => {
    if (address) {
      const stored = localStorage.getItem(getStorageKey(address));
      if (stored) {
        try {
          setServers(JSON.parse(stored));
        } catch {
          setServers([]);
        }
      }
    } else {
      setServers([]);
    }
  }, [address]);

  // Save servers to localStorage when they change
  useEffect(() => {
    if (address && servers.length > 0) {
      localStorage.setItem(getStorageKey(address), JSON.stringify(servers));
    }
  }, [servers, address]);

  const handleCreateServer = async () => {
    if (!serverName || !rpcUrl || !abi) return;
    
    setIsCreating(true);
    
    try {
      JSON.parse(abi);
    } catch {
      alert("Invalid ABI JSON");
      setIsCreating(false);
      return;
    }

    const newServer: ServerConfig = {
      id: crypto.randomUUID(),
      name: serverName,
      rpcUrl,
      abi,
      createdAt: new Date().toISOString(),
    };

    const mcpConfig = {
      mcpServers: {
        [serverName.toLowerCase().replace(/\s+/g, "-")]: {
          command: "python",
          args: ["server.py"],
          env: {
            RPC_URL: rpcUrl,
          },
        },
      },
    };

    setGeneratedConfig(JSON.stringify(mcpConfig, null, 2));
    setServers([newServer, ...servers]);
    setServerName("");
    setRpcUrl("");
    setAbi("");
    setIsCreating(false);
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="text-violet-400">UCAI</span> MCP Builder
            </h1>
            <p className="text-zinc-400 mt-1">
              Turn any smart contract into Claude tools
            </p>
          </div>
          <ConnectButton />
        </div>

        <Card className="bg-zinc-900 border-zinc-800 mb-8">
          <CardHeader>
            <CardTitle>Create MCP Server</CardTitle>
            <CardDescription>
              Provide your contract ABI to generate a Claude-compatible MCP server
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Server Name</Label>
              <Input
                id="name"
                placeholder="e.g., Uniswap Router"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                className="bg-zinc-800 border-zinc-700"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rpc">Chain RPC URL</Label>
              <Input
                id="rpc"
                placeholder="e.g., https://eth.llamarpc.com"
                value={rpcUrl}
                onChange={(e) => setRpcUrl(e.target.value)}
                className="bg-zinc-800 border-zinc-700"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="abi">Contract ABI</Label>
              <Textarea
                id="abi"
                placeholder='[{"inputs":[],"name":"name","outputs":[{"type":"string"}],"stateMutability":"view","type":"function"}]'
                value={abi}
                onChange={(e) => setAbi(e.target.value)}
                className="bg-zinc-800 border-zinc-700 min-h-[150px] font-mono text-sm"
              />
            </div>

            <Button
              onClick={handleCreateServer}
              disabled={!serverName || !rpcUrl || !abi || isCreating}
              className="w-full bg-violet-600 hover:bg-violet-700"
            >
              {isCreating ? "Creating..." : "Create Server"}
            </Button>
          </CardContent>
        </Card>

        {generatedConfig && (
          <Card className="bg-zinc-900 border-zinc-800 mb-8 border-violet-500/50">
            <CardHeader>
              <CardTitle className="text-violet-400">✓ Server Created!</CardTitle>
              <CardDescription>
                Add this to your Claude Desktop config
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-zinc-950 p-4 rounded-lg overflow-x-auto text-sm font-mono">
                {generatedConfig}
              </pre>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => navigator.clipboard.writeText(generatedConfig)}
              >
                Copy Config
              </Button>
            </CardContent>
          </Card>
        )}

        {isConnected && servers.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Your Servers</h2>
            <div className="space-y-4">
              {servers.map((server) => (
                <Card key={server.id} className="bg-zinc-900 border-zinc-800">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{server.name}</h3>
                        <p className="text-sm text-zinc-400">{server.rpcUrl}</p>
                      </div>
                      <span className="text-xs text-zinc-500">
                        {new Date(server.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {!isConnected && (
          <Card className="bg-zinc-900 border-zinc-800 border-dashed">
            <CardContent className="pt-6 text-center text-zinc-400">
              <p>Connect your wallet to save and manage your servers</p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
