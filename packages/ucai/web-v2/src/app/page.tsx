"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useTheme } from "next-themes";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NETWORKS, fetchAbiFromExplorer, verifyRpcConnection, detectContractName } from "@/lib/networks";
import { parseAbi, extractTools, generateServerPy, generateRequirementsTxt, generateReadme, type GeneratedTool, AbiItem } from "@/lib/generator";
import { TEMPLATES, Template, getTemplatesByCategory } from "@/lib/templates";
import { ContractAnalyzer } from "@/components/contract-analyzer";

interface ServerConfig {
  id: string;
  name: string;
  networkId: string;
  rpcUrl: string;
  contractAddress: string;
  abi: string;
  createdAt: string;
}

const getStorageKey = (address: string) => `ucai-servers-${address.toLowerCase()}`;

function HomeContent() {
  const { address, isConnected } = useAccount();
  const { theme, setTheme } = useTheme();
  const searchParams = useSearchParams();
  
  const [serverName, setServerName] = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState("ethereum");
  const [customRpcUrl, setCustomRpcUrl] = useState("");
  const [contractAddress, setContractAddress] = useState("");
  const [abi, setAbi] = useState("");
  const [servers, setServers] = useState<ServerConfig[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isFetchingAbi, setIsFetchingAbi] = useState(false);
  const [generatedConfig, setGeneratedConfig] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"custom" | "templates">("templates");
  const [isDragging, setIsDragging] = useState(false);
  const [isVerifyingRpc, setIsVerifyingRpc] = useState(false);
  const [rpcVerified, setRpcVerified] = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const network = NETWORKS.find(n => n.id === selectedNetwork) || NETWORKS[0];
  const rpcUrl = selectedNetwork === "custom" ? customRpcUrl : network.rpcUrl;
  const templatesByCategory = getTemplatesByCategory(TEMPLATES);

  // Handle hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Parse tools from ABI for preview
  const tools: GeneratedTool[] = useMemo(() => {
    if (!abi) return [];
    try {
      const parsed = parseAbi(abi);
      return extractTools(parsed);
    } catch {
      return [];
    }
  }, [abi]);

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
    } else if (address) {
      localStorage.removeItem(getStorageKey(address));
    }
  }, [servers, address]);

  // Auto-fetch ABI when contract address changes
  const handleFetchAbi = useCallback(async () => {
    if (!contractAddress || contractAddress.length !== 42) {
      toast.error("Enter a valid contract address (0x...)");
      return;
    }
    
    if (!network.explorerApi) {
      toast.error("Custom networks require manual ABI entry");
      return;
    }

    setIsFetchingAbi(true);
    setError(null);
    
    try {
      const fetchedAbi = await fetchAbiFromExplorer(contractAddress, network.explorerApi, network.chainId);
      setAbi(fetchedAbi);
      toast.success("ABI fetched! Running security scan...");
      
      // Auto-show scanner after fetching ABI
      setShowScanner(true);
      
      // Try to detect contract name
      if (!serverName) {
        const detectedName = await detectContractName(contractAddress, rpcUrl);
        if (detectedName) {
          setServerName(detectedName);
          toast.success(`Detected contract: ${detectedName}`);
        } else {
          setServerName(`Contract ${contractAddress.slice(0, 8)}`);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch ABI";
      toast.error(message);
      setError(message);
    } finally {
      setIsFetchingAbi(false);
    }
  }, [contractAddress, network.explorerApi, serverName, rpcUrl]);

  // Parse URL params for sharing
  useEffect(() => {
    const sharedAddress = searchParams.get("address");
    const sharedNetwork = searchParams.get("network");
    const tab = searchParams.get("tab");
    
    if (tab === "custom") {
      setActiveTab("custom");
    }
    
    if (sharedAddress) {
      setContractAddress(sharedAddress);
      setActiveTab("custom");
      if (sharedNetwork) {
        const net = NETWORKS.find(n => n.id === sharedNetwork);
        if (net) setSelectedNetwork(sharedNetwork);
      }
    }
  }, [searchParams]);

  // Verify RPC when network changes
  useEffect(() => {
    const verifyRpc = async () => {
      if (!rpcUrl || selectedNetwork === "custom") {
        setRpcVerified(null);
        return;
      }
      setIsVerifyingRpc(true);
      const verified = await verifyRpcConnection(rpcUrl);
      setRpcVerified(verified);
      setIsVerifyingRpc(false);
    };
    verifyRpc();
  }, [rpcUrl, selectedNetwork]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".json")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          // Validate it's valid JSON
          JSON.parse(content);
          setAbi(content);
          toast.success("ABI file loaded successfully!");
        } catch {
          toast.error("Invalid JSON file");
        }
      };
      reader.readAsText(file);
    } else {
      toast.error("Please drop a .json file");
    }
  }, []);

  // Copy contract address to clipboard
  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    toast.success("Address copied!");
  };

  // Generate share link
  const getShareLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("address", contractAddress);
    url.searchParams.set("network", selectedNetwork);
    return url.toString();
  };

  const copyShareLink = () => {
    if (!contractAddress) {
      toast.error("Enter a contract address first");
      return;
    }
    navigator.clipboard.writeText(getShareLink());
    toast.success("Share link copied!");
  };

  // Delete server from list
  const deleteServer = (serverId: string) => {
    setServers(prev => prev.filter(s => s.id !== serverId));
    toast.success("Server removed");
  };

  // Re-download server
  const redownloadServer = async (server: ServerConfig) => {
    try {
      const parsedAbi = parseAbi(server.abi);
      const serverPy = generateServerPy(server.name, server.contractAddress, server.rpcUrl, parsedAbi);
      const requirements = generateRequirementsTxt();
      const readme = generateReadme(server.name, server.rpcUrl);
      
      const zip = new JSZip();
      zip.file("server.py", serverPy);
      zip.file("requirements.txt", requirements);
      zip.file("README.md", readme);
      zip.file("abi.json", JSON.stringify(parsedAbi, null, 2));
      
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `${server.name.toLowerCase().replace(/\s+/g, "-")}-mcp-server.zip`);
      toast.success("Server downloaded!");
    } catch {
      toast.error("Failed to generate download");
    }
  };

  // Export servers as JSON
  const exportServers = () => {
    const data = JSON.stringify(servers, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    saveAs(blob, `ucai-servers-${new Date().toISOString().split("T")[0]}.json`);
    toast.success("Servers exported!");
  };

  // Import servers from JSON
  const importServers = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          setServers(prev => [...imported, ...prev]);
          toast.success(`Imported ${imported.length} servers!`);
        } else {
          toast.error("Invalid server list format");
        }
      } catch {
        toast.error("Failed to parse import file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleCreateServer = async () => {
    if (!serverName || !rpcUrl || !abi || !contractAddress) {
      toast.error("Please fill in all fields");
      return;
    }
    
    setIsCreating(true);
    setError(null);
    
    try {
      const parsedAbi = parseAbi(abi);
      
      // Generate files
      const serverPy = generateServerPy(serverName, contractAddress, rpcUrl, parsedAbi);
      const requirements = generateRequirementsTxt();
      const readme = generateReadme(serverName, rpcUrl);
      
      // Create ZIP
      const zip = new JSZip();
      zip.file("server.py", serverPy);
      zip.file("requirements.txt", requirements);
      zip.file("README.md", readme);
      zip.file("abi.json", JSON.stringify(parsedAbi, null, 2));
      
      // Download ZIP
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `${serverName.toLowerCase().replace(/\s+/g, "-")}-mcp-server.zip`);
      
      // Build preview URL
      const previewUrl = `/preview?address=${contractAddress}&network=${selectedNetwork}&name=${encodeURIComponent(serverName)}`;
      
      toast.success("Server generated and downloaded!", {
        action: {
          label: "View Preview Page",
          onClick: () => window.open(previewUrl, "_blank")
        }
      });

      // Create config for display
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
      
      // Save to server list
      const newServer: ServerConfig = {
        id: crypto.randomUUID(),
        name: serverName,
        networkId: selectedNetwork,
        rpcUrl,
        contractAddress,
        abi,
        createdAt: new Date().toISOString(),
      };
      setServers([newServer, ...servers]);
      
      // Reset form
      setServerName("");
      setContractAddress("");
      setAbi("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate server";
      toast.error(message);
      setError(message);
    } finally {
      setIsCreating(false);
    }
  };

  // Show skeleton while mounting
  if (!mounted) {
    return (
      <main className="min-h-screen p-8 bg-white dark:bg-slate-950">
        <div className="max-w-5xl mx-auto">
          <Skeleton className="h-12 w-64 mb-4" />
          <Skeleton className="h-6 w-48 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="text-slate-800 dark:text-slate-100">UCAI</span> MCP Builder
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Turn any smart contract into Claude tools
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Docs Link */}
            <a 
              href="https://docs.ucai.tech" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              Docs
            </a>
            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <span className="text-xl">☀️</span>
              ) : (
                <span className="text-xl">🌙</span>
              )}
            </button>
            <ConnectButton />
          </div>
        </div>

        {/* Hero Banner */}
        <div className="relative mb-8 p-6 rounded-2xl bg-slate-800 dark:bg-slate-800 text-white overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.05%22%3E%3Ccircle cx=%2230%22 cy=%2230%22 r=%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50"></div>
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">Zero to MCP in 30 Seconds</h2>
              <p className="text-white/90">Generate AI-ready interfaces for DeFi, NFTs, tokens & more</p>
            </div>
            <div className="hidden md:flex gap-3">
              <a 
                href="https://docs.ucai.tech/getting-started/quickstart/" 
                target="_blank"
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-medium transition-colors backdrop-blur-sm"
              >
                Quick Start
              </a>
              <a 
                href="https://docs.ucai.tech/guides/" 
                target="_blank"
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-medium transition-colors backdrop-blur-sm"
              >
                Guides
              </a>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === "templates" ? "default" : "outline"}
            onClick={() => setActiveTab("templates")}
            className={activeTab === "templates" 
              ? "bg-slate-800 dark:bg-slate-700 text-white shadow-lg" 
              : "border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"}
          >
            Templates
          </Button>
          <Button
            variant={activeTab === "custom" ? "default" : "outline"}
            onClick={() => setActiveTab("custom")}
            className={activeTab === "custom" 
              ? "bg-slate-800 dark:bg-slate-700 text-white shadow-lg" 
              : "border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"}
          >
            Custom Contract
          </Button>
        </div>

        {/* Template Gallery */}
        {activeTab === "templates" && (
          <div className="space-y-8 mb-8">
            {Object.entries(templatesByCategory).map(([category, templates]) => (
              <div key={category}>
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
                  {category}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {templates.map((template) => (
                    <Link key={template.id} href={`/templates/${template.id}`}>
                      <Card 
                        className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-xl hover:scale-[1.02] hover:border-slate-400 dark:hover:border-slate-500 transition-all duration-200 cursor-pointer group h-full"
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                                <span className="text-2xl group-hover:scale-110 transition-transform">{template.icon}</span>
                                {template.name}
                              </CardTitle>
                              <CardDescription className="mt-1 dark:text-slate-400">
                                {template.description}
                              </CardDescription>
                            </div>
                            <Badge 
                              variant="outline"
                              className={
                                template.difficulty === "beginner" ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" :
                                template.difficulty === "intermediate" ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800" :
                                "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800"
                              }
                            >
                              {template.difficulty}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {/* Contracts list */}
                            <div className="flex flex-wrap gap-1">
                              {template.contracts.map((contract, idx) => (
                                <Badge key={idx} variant="secondary" className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs">
                                  {contract.name}
                                </Badge>
                              ))}
                            </div>
                            
                            {/* Sample prompts preview */}
                            <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                              &ldquo;{template.samplePrompts[0]}&rdquo;
                            </div>
                            
                            {/* View Details link */}
                            <div className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors">
                              View details →
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Custom Contract Form */}
        {activeTab === "custom" && (
        <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200 dark:border-slate-700 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-slate-800 dark:text-slate-100">Create MCP Server</CardTitle>
                <CardDescription className="dark:text-slate-400">
                  Enter a contract address or drag & drop an ABI file
                </CardDescription>
              </div>
              {contractAddress && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyShareLink}
                  className="text-slate-500 hover:text-slate-700"
                >
                  Share
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Server Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-700 dark:text-slate-300">Server Name</Label>
              <Input
                id="name"
                placeholder="e.g., Uniswap Router"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                className="bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600 focus:border-slate-400 focus:ring-slate-400"
              />
            </div>

            {/* Network Selection */}
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300">Network</Label>
              <div className="flex items-center gap-2">
                <Select value={selectedNetwork} onValueChange={setSelectedNetwork}>
                  <SelectTrigger className="bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600">
                    <SelectValue placeholder="Select network" />
                  </SelectTrigger>
                  <SelectContent>
                    {NETWORKS.map((net) => (
                      <SelectItem key={net.id} value={net.id}>
                        <span className="flex items-center gap-2">
                          <span>{net.icon}</span>
                          <span>{net.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* RPC Status Indicator */}
                {isVerifyingRpc ? (
                  <span className="text-sm text-slate-400">⏳</span>
                ) : rpcVerified === true ? (
                  <span className="text-sm text-emerald-500" title="RPC Connected">✓</span>
                ) : rpcVerified === false ? (
                  <span className="text-sm text-red-500" title="RPC Failed">✗</span>
                ) : null}
              </div>
            </div>

            {/* Custom RPC (only if custom selected) */}
            {selectedNetwork === "custom" && (
              <div className="space-y-2">
                <Label htmlFor="customRpc" className="text-slate-700 dark:text-slate-300">Custom RPC URL</Label>
                <Input
                  id="customRpc"
                  placeholder="https://..."
                  value={customRpcUrl}
                  onChange={(e) => setCustomRpcUrl(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600 focus:border-slate-400 focus:ring-slate-400"
                />
              </div>
            )}

            {/* Contract Address with Fetch Button */}
            <div className="space-y-2">
              <Label htmlFor="address" className="text-slate-700 dark:text-slate-300">Contract Address</Label>
              <div className="flex gap-2">
                <Input
                  id="address"
                  placeholder="0x..."
                  value={contractAddress}
                  onChange={(e) => setContractAddress(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600 focus:border-slate-400 focus:ring-slate-400 flex-1"
                />
                {contractAddress && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyAddress(contractAddress)}
                    title="Copy address"
                    className="shrink-0"
                  >
                    📋
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={handleFetchAbi}
                  disabled={isFetchingAbi || !contractAddress || selectedNetwork === "custom"}
                  className="border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  {isFetchingAbi ? "Fetching..." : "Fetch ABI"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowScanner(true)}
                  disabled={!contractAddress || selectedNetwork === "custom"}
                  className="border-purple-300 dark:border-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                >
                  Scan
                </Button>
              </div>
            </div>

            {/* Security Scanner */}
            {showScanner && contractAddress && selectedNetwork !== "custom" && (
              <ContractAnalyzer
                address={contractAddress}
                network={selectedNetwork}
                onClose={() => setShowScanner(false)}
              />
            )}

            {/* ABI Textarea with Drag & Drop */}
            <div className="space-y-2">
              <Label htmlFor="abi" className="text-slate-700 dark:text-slate-300">Contract ABI</Label>
              <div
                className={`relative ${isDragging ? "ring-2 ring-slate-400 ring-offset-2" : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Textarea
                  id="abi"
                  placeholder='Drop a .json file here or paste ABI...'
                  value={abi}
                  onChange={(e) => setAbi(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600 focus:border-slate-400 focus:ring-slate-400 min-h-[120px] font-mono text-sm"
                />
                {isDragging && (
                  <div className="absolute inset-0 bg-slate-100/90 dark:bg-slate-800/90 flex items-center justify-center rounded-lg border-2 border-dashed border-slate-400">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">Drop ABI file here</span>
                  </div>
                )}
              </div>
            </div>

            {/* Tool Preview */}
            {tools.length > 0 && (
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Generated Tools ({tools.length})</Label>
                <div className="flex flex-wrap gap-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 max-h-[150px] overflow-y-auto">
                  {tools.map((tool, idx) => (
                    <Badge
                      key={idx}
                      variant={tool.type === "read" ? "secondary" : tool.type === "write" ? "default" : "outline"}
                      className={
                        tool.type === "read" 
                          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200" 
                          : tool.type === "write"
                          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200"
                          : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200"
                      }
                    >
                      {tool.name}
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-4 text-xs text-slate-500 dark:text-slate-400">
                  <span>Read: {tools.filter(t => t.type === "read").length}</span>
                  <span>Write: {tools.filter(t => t.type === "write").length}</span>
                  <span>Events: {tools.filter(t => t.type === "event").length}</span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <Button
              onClick={handleCreateServer}
              disabled={!serverName || !rpcUrl || !abi || !contractAddress || isCreating}
              className="w-full bg-gradient-to-r from-slate-600 via-slate-500 to-slate-600 hover:from-slate-700 hover:via-slate-600 hover:to-slate-700 text-white shadow-lg shadow-slate-300/50 dark:shadow-slate-900/50"
            >
              {isCreating ? "Generating..." : "Generate & Download Server"}
            </Button>
          </CardContent>
        </Card>
        )}

        {/* Generated Config */}
        {generatedConfig && (
          <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-300 dark:border-slate-700 mb-8 shadow-xl shadow-emerald-100/50 dark:shadow-emerald-900/30 border-l-4 border-l-emerald-400">
            <CardHeader>
              <CardTitle className="text-emerald-600 dark:text-emerald-400">✓ Server Downloaded!</CardTitle>
              <CardDescription className="dark:text-slate-400">
                Unzip the file and add this to your Claude Desktop config
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm font-mono max-h-[300px]">
                {generatedConfig}
              </pre>
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  className="border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedConfig);
                    toast.success("Config copied!");
                  }}
                >
                  Copy Config
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Server List */}
        {isConnected && servers.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">Your Servers ({servers.length})</h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportServers}
                  className="border-slate-300 dark:border-slate-600"
                >
                  Export
                </Button>
                <label>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="border-slate-300 dark:border-slate-600 cursor-pointer"
                  >
                    <span>Import</span>
                  </Button>
                  <input
                    type="file"
                    accept=".json"
                    onChange={importServers}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
            <div className="space-y-4">
              {servers.map((server) => {
                const serverNetwork = NETWORKS.find(n => n.id === server.networkId);
                return (
                  <Card key={server.id} className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-slate-200 dark:border-slate-700 shadow-md hover:shadow-lg transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {serverNetwork && <span>{serverNetwork.icon}</span>}
                            <h3 className="font-medium text-slate-800 dark:text-slate-200">{server.name}</h3>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-mono truncate">{server.contractAddress}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyAddress(server.contractAddress)}
                              className="h-6 w-6 p-0 text-slate-400 hover:text-slate-600"
                            >
                              Copy
                            </Button>
                          </div>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{server.rpcUrl}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <span className="text-xs text-slate-400 dark:text-slate-500">
                            {new Date(server.createdAt).toLocaleDateString()}
                          </span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                ⋮
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => redownloadServer(server)}>
                                Re-download
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => deleteServer(server.id)}
                                className="text-red-600 dark:text-red-400"
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Not Connected State */}
        {!isConnected && (
          <Card className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-sm border-slate-200 dark:border-slate-700 border-dashed">
            <CardContent className="pt-6 text-center text-slate-500 dark:text-slate-400">
              <p>Connect your wallet to save and manage your servers</p>
            </CardContent>
          </Card>
        )}

        {/* Share & Community Section */}
        <div className="mt-8 mb-8 p-6 rounded-2xl bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Share UCAI</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Help others discover AI-powered smart contract tools</p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-300 dark:border-slate-600 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
                onClick={() => {
                  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent("🚀 Just discovered UCAI - turn any smart contract into Claude AI tools in seconds!\n\n🛡️ Security scanner\n⚡ 10+ networks\n📦 One-click MCP servers\n\nTry it: mcp.ucai.tech")}&url=${encodeURIComponent("https://mcp.ucai.tech")}`, "_blank");
                }}
              >
                𝕏 Tweet
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-slate-300 dark:border-slate-600 hover:bg-slate-600 hover:text-white hover:border-slate-600 transition-all"
                onClick={() => {
                  navigator.clipboard.writeText("https://mcp.ucai.tech");
                  toast.success("Link copied!");
                }}
              >
                Copy Link
              </Button>
              <a 
                href="https://github.com/nirholas/UCAI" 
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-300 dark:border-slate-600 hover:bg-slate-800 hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
                >
                  Star on GitHub
                </Button>
              </a>
            </div>
          </div>
        </div>

        {/* Feature Pills */}
        <div className="flex flex-wrap justify-center gap-3 mt-8 mb-6">
          <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full text-sm font-medium">50+ Security Checks</span>
          <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full text-sm font-medium">10+ Networks</span>
          <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full text-sm font-medium">100% Open Source</span>
        </div>

        {/* Footer */}
        <footer className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-4">
              <a href="https://docs.ucai.tech" target="_blank" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Documentation</a>
              <a href="https://docs.ucai.tech/cli/" target="_blank" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">CLI Reference</a>
              <a href="https://docs.ucai.tech/api/" target="_blank" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Python API</a>
            </div>
            <div className="flex items-center gap-4">
              <a href="https://github.com/nirholas/UCAI" target="_blank" rel="noopener noreferrer" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">GitHub</a>
              <a href="https://x.com/nichxbt" target="_blank" rel="noopener noreferrer" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">𝕏</a>
              <span>Built by nich</span>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <main className="min-h-screen p-8 bg-white dark:bg-slate-950">
        <div className="max-w-5xl mx-auto">
          <Skeleton className="h-12 w-64 mb-4" />
          <Skeleton className="h-6 w-48 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </main>
    }>
      <HomeContent />
    </Suspense>
  );
}
