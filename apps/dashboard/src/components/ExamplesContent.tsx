'use client';

import { useState } from 'react';

interface Example {
  id: string;
  name: string;
  icon: string;
  description: string;
  language: string;
  filename: string;
  code: string;
  setup?: string;
  envVars?: string[];
}

interface ExamplesContentProps {
  examples: Example[];
}

export function ExamplesContent({ examples }: ExamplesContentProps) {
  const [selectedExample, setSelectedExample] = useState(examples[0]?.id);
  const [copied, setCopied] = useState(false);

  const currentExample = examples.find((e) => e.id === selectedExample) || examples[0];

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLanguageColor = (lang: string) => {
    const colors: Record<string, string> = {
      javascript: 'bg-yellow-500',
      typescript: 'bg-blue-500',
      python: 'bg-green-500',
      bash: 'bg-surface-hover',
    };
    return colors[lang] || 'bg-surface-hover';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      {/* Sidebar - Example Selection */}
      <div className="lg:col-span-1">
        <div className="sticky top-4 bg-surface rounded-xl shadow-sm border p-4">
          <h3 className="font-semibold text-text-primary mb-4">Examples</h3>
          <nav className="space-y-1">
            {examples.map((example) => (
              <button
                key={example.id}
                onClick={() => setSelectedExample(example.id)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  selectedExample === example.id
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'hover:bg-surface-hover text-text-secondary'
                }`}
              >
                <span className="text-lg">{example.icon}</span>
                <span className="truncate">{example.name}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content - Code Display */}
      <div className="lg:col-span-3">
        {currentExample && (
          <div className="bg-surface rounded-xl shadow-sm border border-surface-border overflow-hidden">
            {/* Header */}
            <div className="border-b border-surface-border px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{currentExample.icon}</span>
                  <div>
                    <h2 className="text-xl font-semibold text-text-primary">
                      {currentExample.name}
                    </h2>
                    <p className="text-text-muted text-sm">{currentExample.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 rounded text-xs text-white ${getLanguageColor(currentExample.language)}`}
                  >
                    {currentExample.language}
                  </span>
                </div>
              </div>
            </div>

            {/* Setup Instructions */}
            {(currentExample.setup || currentExample.envVars) && (
              <div className="border-b border-surface-border px-6 py-3 bg-surface-alt">
                <div className="flex flex-wrap gap-4 text-sm">
                  {currentExample.setup && (
                    <div className="flex items-center gap-2">
                      <span className="text-text-muted">Setup:</span>
                      <code className="bg-surface-hover px-2 py-0.5 rounded text-text-primary">
                        {currentExample.setup}
                      </code>
                    </div>
                  )}
                  {currentExample.envVars && currentExample.envVars.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-text-muted">Required:</span>
                      {currentExample.envVars.map((envVar) => (
                        <code
                          key={envVar}
                          className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded"
                        >
                          {envVar}
                        </code>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Code Block */}
            <div className="relative">
              <button
                onClick={() => copyToClipboard(currentExample.code)}
                className="absolute top-3 right-3 px-3 py-1.5 bg-surface-hover hover:bg-surface-alt text-text-primary text-sm rounded-md transition-colors flex items-center gap-1"
              >
                {copied ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    Copy
                  </>
                )}
              </button>
              <pre className="overflow-x-auto p-6 bg-surface-alt text-text-primary text-sm leading-relaxed">
                <code>{currentExample.code}</code>
              </pre>
            </div>

            {/* File Name */}
            <div className="border-t border-surface-border px-6 py-3 bg-surface-alt flex justify-between items-center">
              <span className="text-sm text-text-muted">{currentExample.filename}</span>
              <a
                href={`https://github.com/nirholas/free-crypto-news/tree/main/examples/${currentExample.filename}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
              >
                View on GitHub
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
