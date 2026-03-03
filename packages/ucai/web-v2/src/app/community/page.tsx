"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { NETWORKS } from "@/lib/networks";

// Community template type (simplified version of Template)
interface CommunityTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  author: string;
  authorAddress?: string;
  contracts: {
    name: string;
    address: string;
    network: string;
    description: string;
  }[];
  samplePrompts: string[];
  createdAt: string;
  downloads: number;
}

// Mock community templates - in production this would come from a database
const COMMUNITY_TEMPLATES: CommunityTemplate[] = [
  // Empty for now - will be populated by community submissions
];

export default function CommunityPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [templates, setTemplates] = useState<CommunityTemplate[]>(COMMUNITY_TEMPLATES);

  useEffect(() => {
    setMounted(true);
    // In production, fetch from API
    // fetchCommunityTemplates().then(setTemplates);
  }, []);

  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              <Link href="/community" className="text-sm text-slate-800 dark:text-slate-200 font-medium">
                Community
              </Link>
              <a href="https://docs.ucai.tech" target="_blank" className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
                Docs
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <a href="https://github.com/nirholas/UCAI" target="_blank" className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
              GitHub
            </a>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {theme === "dark" ? <span>☀️</span> : <span>🌙</span>}
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <h1 className="text-3xl font-bold mb-2">Community Templates</h1>
          <p className="text-white/80 mb-6">MCP templates created and shared by the community</p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50 max-w-md"
            />
            <Link href="/?tab=custom">
              <Button variant="outline" className="border-white/30 text-white hover:bg-white/10">
                Submit Your Template
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-6xl mx-auto px-6 py-8 w-full">
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🌱</div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">
              Be the First to Share
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
              The community registry is just getting started. Create a custom contract MCP and publish it to help others!
            </p>
            <Link href="/?tab=custom">
              <Button size="lg">
                Create Your First Template
              </Button>
            </Link>

            {/* How it works */}
            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              <Card className="bg-white/80 dark:bg-slate-800/80">
                <CardHeader>
                  <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xl mb-2">1</div>
                  <CardTitle className="text-lg">Create a Custom MCP</CardTitle>
                  <CardDescription>
                    Use the Custom Contract form to generate an MCP server for any smart contract
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="bg-white/80 dark:bg-slate-800/80">
                <CardHeader>
                  <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xl mb-2">2</div>
                  <CardTitle className="text-lg">Preview & Test</CardTitle>
                  <CardDescription>
                    A shareable page is automatically created. Test your MCP with Claude Desktop
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="bg-white/80 dark:bg-slate-800/80">
                <CardHeader>
                  <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xl mb-2">3</div>
                  <CardTitle className="text-lg">Publish to Community</CardTitle>
                  <CardDescription>
                    Click &ldquo;Publish&rdquo; to add your template to the community registry for others to discover
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((template) => (
              <Link key={template.id} href={`/community/${template.id}`}>
                <Card className="h-full bg-white/80 dark:bg-slate-800/80 hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{template.icon}</span>
                        <div>
                          <CardTitle className="text-lg">{template.name}</CardTitle>
                          <p className="text-xs text-slate-500 dark:text-slate-400">by {template.author}</p>
                        </div>
                      </div>
                    </div>
                    <CardDescription className="mt-2">
                      {template.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {template.contracts.map((contract, idx) => {
                        const network = NETWORKS.find(n => n.id === contract.network);
                        return (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {network?.icon} {contract.name}
                          </Badge>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{template.downloads} downloads</span>
                      <span>{new Date(template.createdAt).toLocaleDateString()}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
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
              <a href="https://docs.ucai.tech" target="_blank" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Documentation</a>
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
