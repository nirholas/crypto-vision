'use client';

import React, { useState, useRef } from 'react';
import { Download, Upload, FileJson, FileSpreadsheet, X, Check, AlertCircle } from 'lucide-react';
import { useWatchlist } from './WatchlistProvider';

interface WatchlistExportProps {
  onClose?: () => void;
}

export function WatchlistExport({ onClose }: WatchlistExportProps) {
  const { watchlist, exportWatchlist, exportWatchlistCSV, importWatchlist } = useWatchlist();
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success?: boolean; message: string } | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportJSON = () => {
    const data = exportWatchlist();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `watchlist-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const data = exportWatchlistCSV();
    const blob = new Blob([data], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `watchlist-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const result = importWatchlist(text);

      if (result.success) {
        setImportResult({
          success: true,
          message: `Successfully imported ${result.imported} coin${result.imported !== 1 ? 's' : ''}`,
        });
      } else {
        setImportResult({
          success: false,
          message: result.error || 'Failed to import watchlist',
        });
      }
    } catch {
      setImportResult({
        success: false,
        message: 'Failed to read file',
      });
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="bg-surface rounded-xl border border-surface-border shadow-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
        <h3 className="font-semibold text-text-primary">Export / Import Watchlist</h3>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-alt text-text-muted">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Export Section */}
        <div>
          <p className="text-sm text-text-secondary mb-3">
            Export your watchlist ({watchlist.length} coin{watchlist.length !== 1 ? 's' : ''})
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleExportJSON}
              disabled={watchlist.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-text-muted disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              <FileJson className="w-4 h-4" />
              Export JSON
            </button>
            <button
              onClick={handleExportCSV}
              disabled={watchlist.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-text-muted disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-surface-border" />

        {/* Import Section */}
        <div>
          <p className="text-sm text-text-secondary mb-3">
            Import a previously exported watchlist (JSON format only)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={handleImportClick}
            disabled={isImporting}
            className="flex items-center gap-2 px-4 py-2 bg-surface-hover hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed text-text-primary rounded-lg font-medium transition-colors"
          >
            <Upload className="w-4 h-4" />
            {isImporting ? 'Importing...' : 'Import JSON'}
          </button>

          {/* Import Result */}
          {importResult && (
            <div
              className={`mt-3 p-3 rounded-lg flex items-center gap-2 ${
                importResult.success
                  ? 'bg-gain/10 text-gain'
                  : 'bg-loss/10 text-loss'
              }`}
            >
              {importResult.success ? (
                <Check className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span className="text-sm">{importResult.message}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default WatchlistExport;
