"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTheme } from "next-themes";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NETWORKS, fetchAbiFromExplorer } from "@/lib/networks";
import { parseAbi, generateServerPy, generateRequirementsTxt, generateReadme, extractTools, type GeneratedTool, type AbiItem } from "@/lib/generator";

function PreviewContent() {
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingAbi, setIsLoadingAbi] = useState(false);
  const [abi, setAbi] = useState<string>("");
  const [showPublishForm, setShowPublishForm] = useState(false);
  
  // Publish form state
  const [publishName, setPublishName] = useState("");
  const [publishDescription, setPublishDescription] = useState("");
  const [publishIcon, setPublishIcon] = useState("🔗");
  const [publishPrompts, setPublishPrompts] = useState("");

  // Get params from URL
  const address = searchParams.get("address") || "";
  const networkId = searchParams.get("network") || "ethereum";
  const name = searchParams.get("name") || `Contract ${address.slice(0, 8)}`;
  
  const network = NETWORKS.find(n => n.id === networkId) || NETWORKS[0];

  // Parse tools from ABI
  const tools: GeneratedTool[] = useMemo(() => {
    if (!abi) return [];
    try {
      const parsed = parseAbi(abi);
      return extractTools(parsed);
    } catch {
      return [];
    }
  }, [abi]);

  useEffect(() => {
    setMounted(true);
    setPublishName(name);
    
    // Auto-fetch ABI if we have address and network
    if (address && network.explorerApi) {
      loadAbi();
    }
  }, [address, networkId]);

  const loadAbi = async () => {
    if (!address || !network.explorerApi) return;
    
    setIsLoadingAbi(true);
    try {
      const fetchedAbi = await fetchAbiFromExplorer(address, network.explorerApi, network.chainId);
      setAbi(fetchedAbi);
    } catch (err) {
      console.error("Failed to fetch ABI:", err);
    } finally {
      setIsLoadingAbi(false);
    }
  };

  const handleGenerate = async () => {
    if (!abi || !address) {
      toast.error("Missing ABI or address");
      return;
    }

    setIsGenerating(true);

    try {
      const parsedAbi = parseAbi(abi) as AbiItem[];
      const serverPy = generateServerPy(name, address, network.rpcUrl, parsedAbi);
      const requirements = generateRequirementsTxt();
      const readme = generateReadme(name, network.rpcUrl);

      const zip = new JSZip();
      zip.file("server.py", serverPy);
      zip.file("requirements.txt", requirements);
      zip.file("README.md", readme);
      zip.file("abi.json", JSON.stringify(parsedAbi, null, 2));

      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `${name.toLowerCase().replace(/\s+/g, "-")}-mcp-server.zip`);
      toast.success("MCP server downloaded!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate";
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!publishName || !publishDescription) {
      toast.error("Please fill in name and description");
      return;
    }

    // In production, this would submit to an API
    const submission = {
      name: publishName,
      description: publishDescription,
      icon: publishIcon,
      contracts: [{
        name: name,
        address: address,
        network: networkId,
        description: publishDescription,
      }],
      samplePrompts: publishPrompts.split("\n").filter(p => p.trim()),
      abi: abi,
    };

    // For now, show what would be submitted
    console.log("Would submit:", submission);
    toast.success("Template submitted for review! (Demo - not actually saved)");
    setShowPublishForm(false);
  };

  const getShareLink = () => {
    const url = new URL(window.location.href);
    return url.toString();
  };

  if (!mounted) {
    return (
      <main className="min-h-screen bg-white dark:bg-slate-950">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Skeleton className="h-12 w-64 mb-4" />
          <Skeleton className="h-6 w-48 mb-8" />
        </div>
      </main>
    );
  }

  if (!address) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-4">No contract specified</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-6">Create a custom contract MCP from the home page</p>
          <Link href="/">
            <Button>Go to Home</Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl font-bold text-slate-800 dark:text-slate-100">
              UCAI
            </Link>
            <nav className="hidden md:flex items-center gap-4">
              <Link href="/" className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
                Templates
              </Link>
              <Link href="/community" className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
                Community
              </Link>
              <a href="https://docs.ucai.tech" target="_blank" className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
                Docs
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {theme === "dark" ? <span>☀️</span> : <span>🌙</span>}
            </button>
          </div>
        </div>
      </header>

      {/* Hero CTA */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center text-4xl shrink-0">
                🔗
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <h1 className="text-2xl font-bold">{name}</h1>
                  <Badge className="bg-white/20 text-white border-white/30">Custom</Badge>
                </div>
                <p className="text-white/80">Custom contract MCP on {network.name}</p>
              </div>
            </div>
            <div className="flex flex-col items-stretch md:items-end gap-2 w-full md:w-auto">
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !abi}
                size="lg"
                className="bg-white text-emerald-700 hover:bg-emerald-50 font-semibold px-8 shadow-lg"
              >
                {isGenerating ? "Generating..." : "Download MCP Bundle"}
              </Button>
              <p className="text-xs text-white/60 text-center md:text-right">
                {tools.length} tools • Ready for Claude Desktop
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
        <div className="max-w-6xl mx-auto px-6 py-2">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link href="/" className="hover:text-slate-700 dark:hover:text-slate-300">Home</Link>
            <span>/</span>
            <span className="text-slate-700 dark:text-slate-300">Preview</span>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-6xl mx-auto px-6 py-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-8">
          {/* Main Content */}
          <div className="space-y-8">
            <Tabs defaultValue="tools" className="w-full">
              <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <TabsTrigger value="tools" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 rounded-md">Tools ({tools.length})</TabsTrigger>
                <TabsTrigger value="contract" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 rounded-md">Contract</TabsTrigger>
              </TabsList>

              {/* Tools Tab */}
              <TabsContent value="tools" className="mt-6">
                <div className="p-6 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4">
                    Generated Claude Tools
                  </h3>
                  {isLoadingAbi ? (
                    <div className="space-y-3">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-3/4" />
                    </div>
                  ) : tools.length > 0 ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {tools.map((tool, idx) => (
                          <div 
                            key={idx}
                            className={`p-3 rounded-lg border text-sm ${
                              tool.type === "read" 
                                ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800" 
                                : tool.type === "write"
                                ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                                : "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                tool.type === "read" 
                                  ? "bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300" 
                                  : tool.type === "write"
                                  ? "bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300"
                                  : "bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-300"
                              }`}>
                                {tool.type}
                              </span>
                              <span className="font-mono text-slate-700 dark:text-slate-300">{tool.name}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-4 pt-4 border-t border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          Read: {tools.filter(t => t.type === "read").length}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                          Write: {tools.filter(t => t.type === "write").length}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                          Events: {tools.filter(t => t.type === "event").length}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      {isLoadingAbi ? "Loading ABI..." : "No tools found. ABI may not be available."}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Contract Tab */}
              <TabsContent value="contract" className="mt-6">
                <div className="p-6 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4">
                    Contract Details
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-slate-500 uppercase">Address</label>
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 mt-1">
                        <code className="flex-1 text-sm font-mono text-slate-600 dark:text-slate-300 truncate">
                          {address}
                        </code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(address);
                            toast.success("Copied!");
                          }}
                          className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 shrink-0"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 uppercase">Network</label>
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 mt-1">
                        <span className="text-lg">{network.icon}</span>
                        <span className="text-slate-700 dark:text-slate-300">{network.name}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-center">
                <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">{tools.filter(t => t.type === "read").length}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Read Tools</div>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-center">
                <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">{tools.filter(t => t.type === "write").length}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Write Tools</div>
              </div>
            </div>

            {/* Network */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Network</h3>
              <div className="flex items-center gap-2">
                <span className="text-xl">{network.icon}</span>
                <span className="text-slate-700 dark:text-slate-300">{network.name}</span>
              </div>
            </div>

            {/* Share */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Share</h3>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => {
                  navigator.clipboard.writeText(getShareLink());
                  toast.success("Link copied!");
                }}
              >
                Copy Share Link
              </Button>
            </div>

            {/* Publish to Community */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800">
              <h3 className="text-sm font-medium text-purple-800 dark:text-purple-300 mb-2">Share with Community</h3>
              <p className="text-xs text-purple-600 dark:text-purple-400 mb-3">
                Publish this template so others can discover and use it
              </p>
              <Button 
                size="sm" 
                className="w-full bg-purple-600 hover:bg-purple-700"
                onClick={() => setShowPublishForm(true)}
              >
                Publish Template
              </Button>
            </div>
          </div>
        </div>

        {/* Publish Form Modal */}
        {showPublishForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Publish to Community</h2>
              
              <div className="space-y-4">
                <div>
                  <Label>Template Name</Label>
                  <Input 
                    value={publishName} 
                    onChange={(e) => setPublishName(e.target.value)}
                    placeholder="e.g., My DeFi Protocol"
                  />
                </div>
                
                <div>
                  <Label>Icon (emoji)</Label>
                  <Input 
                    value={publishIcon} 
                    onChange={(e) => setPublishIcon(e.target.value)}
                    placeholder="🔗"
                    className="text-2xl"
                  />
                </div>
                
                <div>
                  <Label>Description</Label>
                  <Textarea 
                    value={publishDescription} 
                    onChange={(e) => setPublishDescription(e.target.value)}
                    placeholder="What does this contract do? What can Claude help with?"
                    rows={3}
                  />
                </div>
                
                <div>
                  <Label>Sample Prompts (one per line)</Label>
                  <Textarea 
                    value={publishPrompts} 
                    onChange={(e) => setPublishPrompts(e.target.value)}
                    placeholder="What's the current balance?&#10;Show me recent transactions&#10;Check the contract state"
                    rows={4}
                  />
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setShowPublishForm(false)}>
                    Cancel
                  </Button>
                  <Button className="flex-1 bg-purple-600 hover:bg-purple-700" onClick={handlePublish}>
                    Submit for Review
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-6">
              <Link href="/" className="font-semibold text-slate-800 dark:text-slate-200">UCAI</Link>
              <Link href="/" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Templates</Link>
              <Link href="/community" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Community</Link>
            </div>
            <div className="flex items-center gap-4">
              <a href="https://github.com/nirholas/UCAI" target="_blank" rel="noopener noreferrer" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">GitHub</a>
              <a href="https://x.com/nichxbt" target="_blank" rel="noopener noreferrer" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">𝕏</a>
              <span>Built by nich</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

export default function PreviewPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-white dark:bg-slate-950">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Skeleton className="h-12 w-64 mb-4" />
          <Skeleton className="h-6 w-48 mb-8" />
        </div>
      </main>
    }>
      <PreviewContent />
    </Suspense>
  );
}
