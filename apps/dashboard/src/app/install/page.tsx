'use client';

import { useState, useEffect } from 'react';
import { usePWASafe } from '@/components/PWAProvider';
import { Download, Smartphone, Zap, Wifi, Bell, Share, Plus, Check } from 'lucide-react';

export default function InstallPage() {
  const pwa = usePWASafe();
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [installStatus, setInstallStatus] = useState<'idle' | 'installing' | 'installed'>('idle');

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    setIsAndroid(/android/.test(userAgent));
  }, []);

  const handleInstall = async () => {
    if (pwa?.installPrompt) {
      setInstallStatus('installing');
      const installed = await pwa.installPrompt();
      setInstallStatus(installed ? 'installed' : 'idle');
    }
  };

  const isInstalled = pwa?.isInstalled;
  const canInstall = pwa?.isInstallable && !isInstalled;

  return (
    <div className="min-h-screen bg-background text-white">
      <div className="max-w-2xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-6">
            <span className="text-4xl font-bold">₿</span>
          </div>
          <h1 className="text-3xl font-bold mb-3">Install Crypto Data Aggregator</h1>
          <p className="text-white/60">Add to your home screen for instant access</p>
        </div>

        {/* Already Installed */}
        {isInstalled && (
          <div className="mb-8 p-4 border border-white/20 rounded-lg flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
              <Check className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="font-medium">Already Installed</p>
              <p className="text-white/60 text-sm">You can open the app from your home screen</p>
            </div>
          </div>
        )}

        {/* Install Button (Desktop/Android) */}
        {canInstall && !isIOS && (
          <button
            onClick={handleInstall}
            disabled={installStatus === 'installing'}
            className="w-full mb-8 py-4 px-6 bg-white text-black font-semibold rounded-lg hover:bg-white/90 transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <Download className="w-5 h-5" />
            {installStatus === 'installing' ? 'Installing...' : 'Install App'}
          </button>
        )}

        {/* Features */}
        <div className="mb-12">
          <h2 className="text-lg font-semibold mb-4 text-white/80">Why install?</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-4 p-4 border border-white/10 rounded-lg">
              <Zap className="w-5 h-5 text-white/60" />
              <div>
                <p className="font-medium">Lightning Fast</p>
                <p className="text-white/50 text-sm">Native app performance</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 border border-white/10 rounded-lg">
              <Wifi className="w-5 h-5 text-white/60" />
              <div>
                <p className="font-medium">Works Offline</p>
                <p className="text-white/50 text-sm">Access cached data without internet</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 border border-white/10 rounded-lg">
              <Bell className="w-5 h-5 text-white/60" />
              <div>
                <p className="font-medium">Push Notifications</p>
                <p className="text-white/50 text-sm">Get alerts for price movements</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 border border-white/10 rounded-lg">
              <Smartphone className="w-5 h-5 text-white/60" />
              <div>
                <p className="font-medium">Home Screen Access</p>
                <p className="text-white/50 text-sm">One tap to open, no browser needed</p>
              </div>
            </div>
          </div>
        </div>

        {/* iOS Instructions */}
        {isIOS && !isInstalled && (
          <div className="mb-12">
            <h2 className="text-lg font-semibold mb-4 text-white/80">How to install on iOS</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 border border-white/10 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 font-semibold">
                  1
                </div>
                <div>
                  <p className="font-medium flex items-center gap-2">
                    Tap the Share button
                    <Share className="w-4 h-4 text-white/50" />
                  </p>
                  <p className="text-white/50 text-sm mt-1">Located at the bottom of Safari</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 border border-white/10 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 font-semibold">
                  2
                </div>
                <div>
                  <p className="font-medium flex items-center gap-2">
                    Tap &quot;Add to Home Screen&quot;
                    <Plus className="w-4 h-4 text-white/50" />
                  </p>
                  <p className="text-white/50 text-sm mt-1">
                    Scroll down in the share menu to find it
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 border border-white/10 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 font-semibold">
                  3
                </div>
                <div>
                  <p className="font-medium">Tap &quot;Add&quot;</p>
                  <p className="text-white/50 text-sm mt-1">
                    The app icon will appear on your home screen
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Android Instructions */}
        {isAndroid && !canInstall && !isInstalled && (
          <div className="mb-12">
            <h2 className="text-lg font-semibold mb-4 text-white/80">How to install on Android</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 border border-white/10 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 font-semibold">
                  1
                </div>
                <div>
                  <p className="font-medium">Open Chrome menu</p>
                  <p className="text-white/50 text-sm mt-1">Tap the three dots in the top right</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 border border-white/10 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 font-semibold">
                  2
                </div>
                <div>
                  <p className="font-medium">Tap &quot;Add to Home screen&quot;</p>
                  <p className="text-white/50 text-sm mt-1">
                    Or &quot;Install app&quot; if available
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 border border-white/10 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 font-semibold">
                  3
                </div>
                <div>
                  <p className="font-medium">Confirm installation</p>
                  <p className="text-white/50 text-sm mt-1">
                    The app will be added to your home screen
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Not installable message */}
        {!canInstall && !isInstalled && !isIOS && !isAndroid && (
          <div className="p-4 border border-white/10 rounded-lg text-center">
            <p className="text-white/60">
              To install, open this page in Chrome, Edge, or Safari on your mobile device.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
