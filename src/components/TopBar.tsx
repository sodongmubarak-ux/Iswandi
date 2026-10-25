import React from 'react';
import { WifiOff, Download, Sparkles, Github } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface TopBarProps {
  onOpenSettings: () => void;
  onOpenGitHub?: () => void;
  appName?: string;
}

export const TopBar: React.FC<TopBarProps> = ({ appName = 'CATATAN BY ISWANDI', onOpenGitHub }) => {
  const isOnline = useOnlineStatus();
  const { isInstallable, install } = usePWAInstall();

  return (
    <header
      className="sticky top-0 z-40 bg-[#0a0e17]/95 backdrop-blur-md border-b border-slate-800/80 px-4 pb-3"
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))',
      }}
    >
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Zone */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-bold text-sm shadow-md shadow-amber-500/20">
            <Sparkles className="w-4 h-4 fill-slate-950" />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-wide text-amber-400 whitespace-nowrap">
              {appName}
            </h1>
            <p className="text-[10px] text-slate-400 font-medium">Pembukuan Hasil Ikan Harian</p>
          </div>
        </div>

        {/* Right Status & Actions */}
        <div className="flex items-center gap-2">
          {!isOnline && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-950/80 border border-red-800/60 text-red-300 text-[11px] font-medium">
              <WifiOff className="w-3 h-3 text-red-400" />
              <span>Offline</span>
            </div>
          )}

          {isInstallable && (
            <button
              onClick={install}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold active:scale-95 transition-all"
              title="Pasang aplikasi di layar utama Android"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Pasang APK/App</span>
              <span className="sm:hidden">Install</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
