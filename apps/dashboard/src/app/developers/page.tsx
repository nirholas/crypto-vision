'use client';

import { useState } from 'react';
import { Key, Copy, Check, AlertCircle, Trash2 } from 'lucide-react';

interface ApiKeyInfo {
  id: string;
  keyPrefix: string;
  name: string;
  tier: string;
  rateLimit: number;
  createdAt: string;
  lastUsedAt?: string;
  active: boolean;
}

export default function DevelopersPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newKey, setNewKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [existingKeys, setExistingKeys] = useState<ApiKeyInfo[]>([]);
  const [showKeys, setShowKeys] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setNewKey('');

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name: name || 'Default' }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create API key');
        return;
      }

      setNewKey(data.key);
      // Refresh existing keys
      await loadExistingKeys();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingKeys = async () => {
    if (!email) return;

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, action: 'list' }),
      });

      const data = await res.json();
      if (data.keys) {
        setExistingKeys(data.keys);
        setShowKeys(true);
      }
    } catch {
      // Ignore errors for listing
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, keyId, action: 'revoke' }),
      });

      if (res.ok) {
        await loadExistingKeys();
      }
    } catch {
      setError('Failed to revoke key');
    }
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <div className="max-w-2xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-surface rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Key className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Developer API</h1>
          <p className="text-text-muted">
            Get your free API key to access cryptocurrency market data
          </p>
        </div>

        {/* Registration Form */}
        <div className="bg-surface rounded-2xl border border-surface-border p-8 mb-8">
          <h2 className="text-xl font-semibold mb-6">Get Your API Key</h2>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm text-text-muted mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@example.com"
                required
                className="w-full px-4 py-3 bg-background border border-surface-border rounded-lg focus:border-primary focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label htmlFor="name" className="block text-sm text-text-muted mb-2">
                Key Name (optional)
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My App"
                className="w-full px-4 py-3 bg-background border border-surface-border rounded-lg focus:border-primary focus:outline-none transition-colors"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating...' : 'Create Free API Key'}
            </button>
          </form>

          <button
            onClick={loadExistingKeys}
            className="w-full mt-4 py-2 text-text-muted text-sm hover:text-text-primary transition-colors"
          >
            Already have a key? View your existing keys
          </button>
        </div>

        {/* New Key Display */}
        {newKey && (
          <div className="bg-gain/20 border border-gain/50 rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-2 text-gain mb-4">
              <Check className="w-5 h-5" />
              <span className="font-medium">API Key Created Successfully</span>
            </div>

            <p className="text-sm text-text-muted mb-4">
              Save this key now. It will only be shown once!
            </p>

            <div className="flex items-center gap-2">
              <code className="flex-1 bg-background px-4 py-3 rounded-lg font-mono text-sm break-all">
                {newKey}
              </code>
              <button
                onClick={copyToClipboard}
                className="p-3 bg-surface rounded-lg hover:bg-surface-hover transition-colors"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-green-400" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Existing Keys */}
        {showKeys && existingKeys.length > 0 && (
          <div className="bg-surface rounded-2xl border border-surface-border p-6 mb-8">
            <h3 className="text-lg font-medium mb-4">Your API Keys</h3>

            <div className="space-y-3">
              {existingKeys.map((key) => (
                <div
                  key={key.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    key.active
                      ? 'bg-background border-surface-border'
                      : 'bg-surface-hover border-surface-border opacity-50'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono">{key.keyPrefix}...</code>
                      <span className="text-xs px-2 py-0.5 bg-surface-hover rounded">
                        {key.tier}
                      </span>
                      {!key.active && (
                        <span className="text-xs px-2 py-0.5 bg-loss/20 text-loss rounded">
                          Revoked
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-text-muted mt-1">
                      {key.name} • Created {new Date(key.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  {key.active && (
                    <button
                      onClick={() => handleRevoke(key.id)}
                      className="p-2 text-text-muted hover:text-loss transition-colors"
                      title="Revoke key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Usage Example */}
        <div className="bg-surface rounded-2xl border border-surface-border p-6">
          <h3 className="text-lg font-medium mb-4">Usage</h3>

          <div className="space-y-4 text-sm">
            <div>
              <p className="text-text-muted mb-2">Using header (recommended):</p>
              <code className="block bg-background p-3 rounded-lg font-mono text-xs overflow-x-auto">
                curl -H &quot;X-API-Key: YOUR_API_KEY&quot; \<br />
                &nbsp;&nbsp;https://crypto-data.vercel.app/api/v1/coins
              </code>
            </div>

            <div>
              <p className="text-text-muted mb-2">Using query parameter:</p>
              <code className="block bg-background p-3 rounded-lg font-mono text-xs overflow-x-auto">
                curl &quot;https://crypto-data.vercel.app/api/v1/coins?api_key=YOUR_API_KEY&quot;
              </code>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-surface-border">
            <h4 className="font-medium mb-3">Rate Limits</h4>
            <div className="grid grid-cols-3 gap-4 text-center text-sm">
              <div className="p-3 bg-background rounded-lg">
                <div className="text-2xl font-bold">100</div>
                <div className="text-text-muted">Free / day</div>
              </div>
              <div className="p-3 bg-background rounded-lg">
                <div className="text-2xl font-bold">10K</div>
                <div className="text-text-muted">Pro / day</div>
              </div>
              <div className="p-3 bg-background rounded-lg">
                <div className="text-2xl font-bold">∞</div>
                <div className="text-text-muted">Enterprise</div>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <a
              href="/docs/api"
              className="text-text-muted hover:text-text-primary transition-colors text-sm"
            >
              View full API documentation →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
