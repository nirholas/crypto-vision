'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import Link from 'next/link';

/**
 * Interactive API Documentation Page with Swagger UI
 * 
 * Renders OpenAPI 3.1 specification with interactive "Try it out" functionality.
 * Provides documentation for all v2 API endpoints.
 * 
 * @route /docs/swagger
 */
export default function SwaggerDocsPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [apiKey, setApiKey] = useState('');
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  
  useEffect(() => {
    // Load saved API key
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem('crypto_api_key') || '';
      setApiKey(savedKey);
    }
  }, []);
  
  useEffect(() => {
    // Initialize Swagger UI when script loads
    const initSwagger = () => {
      if (typeof window !== 'undefined' && (window as any).SwaggerUIBundle && containerRef.current) {
        (window as any).SwaggerUIBundle({
          url: '/api/v2/openapi.json',
          dom_id: '#swagger-ui',
          deepLinking: true,
          presets: [
            (window as any).SwaggerUIBundle.presets.apis,
            (window as any).SwaggerUIStandalonePreset,
          ],
          plugins: [
            (window as any).SwaggerUIBundle.plugins.DownloadUrl,
          ],
          layout: 'StandaloneLayout',
          tryItOutEnabled: true,
          requestInterceptor: (req: any) => {
            // Add API key from localStorage if available
            const storedKey = localStorage.getItem('crypto_api_key');
            if (storedKey) {
              req.headers['X-API-Key'] = storedKey;
            }
            return req;
          },
        });
      }
    };
    
    if (scriptsLoaded) {
      initSwagger();
    }
  }, [scriptsLoaded]);
  
  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('crypto_api_key', value);
    }
  };
  
  return (
    <div className="min-h-screen bg-background">
      {/* Swagger UI CSS */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css"
      />
      
      {/* Custom styles for dark mode */}
      <style jsx global>{`
        body {
          background: #0a0a0a;
        }
        
        .swagger-ui {
          font-family: var(--font-geist-sans), system-ui, sans-serif;
        }
        
        .swagger-ui .topbar {
          display: none;
        }
        
        .swagger-ui .info {
          margin: 20px 0;
        }
        
        .swagger-ui .info .title {
          font-size: 2rem;
          font-weight: 700;
          color: #fafafa !important;
        }
        
        .swagger-ui .info .description,
        .swagger-ui .info .description p,
        .swagger-ui .info .description li {
          color: #a3a3a3 !important;
        }
        
        .swagger-ui .info .description h1,
        .swagger-ui .info .description h2,
        .swagger-ui .info .description h3 {
          color: #fafafa !important;
        }
        
        .swagger-ui .info .description code {
          background: #262626;
          color: #22d3ee;
          padding: 2px 6px;
          border-radius: 4px;
        }
        
        .swagger-ui .info .description pre {
          background: #171717;
          border: 1px solid #262626;
          border-radius: 8px;
        }
        
        .swagger-ui .opblock.opblock-get {
          border-color: #22d3ee;
          background: rgba(34, 211, 238, 0.05);
        }
        
        .swagger-ui .opblock.opblock-get .opblock-summary-method {
          background: #0891b2;
        }
        
        .swagger-ui .opblock.opblock-post {
          border-color: #4ade80;
          background: rgba(74, 222, 128, 0.05);
        }
        
        .swagger-ui .opblock.opblock-post .opblock-summary-method {
          background: #16a34a;
        }
        
        .swagger-ui .opblock .opblock-summary-path,
        .swagger-ui .opblock .opblock-summary-description {
          color: #d4d4d4 !important;
        }
        
        .swagger-ui .opblock .opblock-section-header {
          background: #171717;
          border-color: #262626;
        }
        
        .swagger-ui .opblock .opblock-section-header h4 {
          color: #fafafa;
        }
        
        .swagger-ui .parameter__name,
        .swagger-ui .parameter__type,
        .swagger-ui .parameter__in {
          color: #a3a3a3 !important;
        }
        
        .swagger-ui .parameter__name.required::after {
          color: #f87171;
        }
        
        .swagger-ui table thead tr th,
        .swagger-ui table thead tr td {
          color: #d4d4d4;
          border-color: #262626;
        }
        
        .swagger-ui table tbody tr td {
          color: #a3a3a3;
          border-color: #262626;
          padding: 10px;
        }
        
        .swagger-ui .responses-inner h4,
        .swagger-ui .responses-inner h5 {
          color: #fafafa;
        }
        
        .swagger-ui .response-col_status {
          color: #22d3ee !important;
        }
        
        .swagger-ui .response-col_description {
          color: #a3a3a3 !important;
        }
        
        .swagger-ui .model-title,
        .swagger-ui .model {
          color: #d4d4d4 !important;
        }
        
        .swagger-ui .model-box {
          background: #171717;
        }
        
        .swagger-ui .prop-type {
          color: #4ade80 !important;
        }
        
        .swagger-ui .prop-format {
          color: #a78bfa !important;
        }
        
        .swagger-ui .renderedMarkdown p {
          color: #a3a3a3;
        }
        
        .swagger-ui input[type="text"],
        .swagger-ui textarea,
        .swagger-ui select {
          background: #171717;
          color: #fafafa;
          border: 1px solid #262626;
          border-radius: 6px;
        }
        
        .swagger-ui input[type="text"]:focus,
        .swagger-ui textarea:focus,
        .swagger-ui select:focus {
          border-color: #0891b2;
          outline: none;
          box-shadow: 0 0 0 2px rgba(8, 145, 178, 0.2);
        }
        
        .swagger-ui .btn {
          border-radius: 6px;
          font-weight: 500;
        }
        
        .swagger-ui .btn.execute {
          background: #0891b2;
          border-color: #0891b2;
          color: white;
        }
        
        .swagger-ui .btn.execute:hover {
          background: #0e7490;
        }
        
        .swagger-ui .btn.cancel {
          background: transparent;
          border-color: #525252;
          color: #a3a3a3;
        }
        
        .swagger-ui .opblock-body pre.microlight {
          background: #0a0a0a !important;
          color: #d4d4d4 !important;
          border: 1px solid #262626;
          border-radius: 8px;
          font-family: var(--font-geist-mono), monospace;
        }
        
        .swagger-ui .highlight-code > .microlight code {
          color: #d4d4d4 !important;
        }
        
        .swagger-ui .scheme-container {
          background: #171717;
          border: 1px solid #262626;
          border-radius: 8px;
          box-shadow: none;
        }
        
        .swagger-ui .scheme-container .schemes > label {
          color: #a3a3a3;
        }
        
        .swagger-ui section.models {
          border: 1px solid #262626;
          border-radius: 8px;
        }
        
        .swagger-ui section.models h4 {
          color: #fafafa;
          border-color: #262626;
        }
        
        .swagger-ui section.models .model-container {
          background: #0a0a0a;
          border-color: #262626;
        }
        
        .swagger-ui .opblock-tag {
          color: #fafafa;
          border-color: #262626;
        }
        
        .swagger-ui .opblock-tag:hover {
          background: rgba(255, 255, 255, 0.02);
        }
        
        .swagger-ui .loading-container {
          background: #0a0a0a;
        }
        
        .swagger-ui .loading-container .loading::after {
          color: #a3a3a3;
        }
        
        /* Response codes */
        .swagger-ui .responses-table .response-col_status {
          font-weight: 600;
        }
        
        .swagger-ui .response-col_status .response-undocumented {
          color: #fbbf24 !important;
        }
        
        /* Copy button */
        .swagger-ui .copy-to-clipboard {
          background: #262626;
          border: 1px solid #404040;
        }
        
        .swagger-ui .copy-to-clipboard button {
          background: #262626;
        }
        
        /* x-price extension */
        .swagger-ui [class*="x-price"] {
          color: #4ade80;
          font-weight: 500;
        }
        
        /* Scrollbar */
        .swagger-ui ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        .swagger-ui ::-webkit-scrollbar-track {
          background: #171717;
        }
        
        .swagger-ui ::-webkit-scrollbar-thumb {
          background: #404040;
          border-radius: 4px;
        }
        
        .swagger-ui ::-webkit-scrollbar-thumb:hover {
          background: #525252;
        }
        
        /* Download button */
        .swagger-ui .download-contents {
          background: #262626;
          color: #d4d4d4;
          border: 1px solid #404040;
          border-radius: 6px;
        }
        
        .swagger-ui .download-contents:hover {
          background: #404040;
        }
      `}</style>
      
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-surface-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/" 
              className="text-xl font-bold text-white hover:text-cyan-400 transition-colors"
            >
              🪙 Crypto Data API
            </Link>
            <span className="px-2 py-0.5 text-xs font-medium bg-cyan-500/10 text-cyan-400 rounded-full border border-cyan-500/20">
              v2.0
            </span>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="/docs/api"
              className="text-sm text-text-secondary hover:text-white transition-colors"
            >
              Quick Reference
            </Link>
            <a
              href="/api/v2/openapi.json"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-1.5 text-sm font-medium text-text-secondary hover:text-white border border-surface-border rounded-lg hover:bg-surface-hover transition-colors"
            >
              OpenAPI Spec ↗
            </a>
            <Link
              href="/"
              className="px-4 py-1.5 text-sm font-medium bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors"
            >
              Back to App
            </Link>
          </nav>
        </div>
      </header>
      
      {/* API Key Input */}
      <div className="border-b border-surface-border bg-background-secondary/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex-1">
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                🔑 API Key
              </label>
              <input
                type="password"
                placeholder="Enter your API key for authenticated requests..."
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                className="w-full max-w-md px-4 py-2 bg-background-secondary border border-surface-border rounded-lg text-white placeholder:text-text-muted focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              />
            </div>
            <div className="text-sm text-text-muted">
              <p>API key will be included in all &quot;Try it out&quot; requests.</p>
              <p>
                Don&apos;t have a key?{' '}
                <Link href="/settings" className="text-cyan-400 hover:text-cyan-300">
                  Get one free →
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Swagger UI Container */}
      <div id="swagger-ui" ref={containerRef} className="container mx-auto px-4 py-8" />
      
      {/* Swagger UI Scripts */}
      <Script
        src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"
        strategy="afterInteractive"
      />
      <Script
        src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js"
        strategy="afterInteractive"
        onLoad={() => setScriptsLoaded(true)}
      />
    </div>
  );
}
