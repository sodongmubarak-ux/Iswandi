import React, { useState } from 'react';
import {
  X,
  Github,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Download,
  Key,
  FolderGit2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';

interface GitHubPushModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GitHubPushModal: React.FC<GitHubPushModalProps> = ({ isOpen, onClose }) => {
  const [repoUrl, setRepoUrl] = useState('');
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showTokenGuide, setShowTokenGuide] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    repoUrl?: string;
    actionsUrl?: string;
  } | null>(null);

  if (!isOpen) return null;

  const handlePush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim() || !token.trim()) {
      setResult({
        success: false,
        message: 'Mohon isi URL repositori GitHub dan Token (PAT) Anda.',
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/github/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repoUrl: repoUrl.trim(),
          token: token.trim(),
          username: username.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengirim berkas ke GitHub.');
      }

      setResult({
        success: true,
        message: data.message || 'Semua berkas dan folder berhasil dikirim ke GitHub!',
        repoUrl: data.repoUrl,
        actionsUrl: data.actionsUrl,
      });
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Terjadi kegagalan saat push ke GitHub.';
      setResult({
        success: false,
        message: msg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-5 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Github className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">
                Kirim Berkas ke GitHub (Langsung dari HP)
              </h3>
              <p className="text-xs text-slate-400">
                Solusi otomatis tanpa PC & tanpa perlu upload folder manual
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Box */}
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>Mengapa Perlu Fitur Ini?</span>
          </div>
          <p className="text-[11px] leading-relaxed text-amber-100/90">
            Browser HP Android (Chrome) tidak mengizinkan unggah folder bersarang (seperti <code>.github/workflows</code> & <code>android/</code>). Melalui fitur ini, server kami akan langsung mengirimkan <strong>seluruh file & struktur folder lengkap</strong> ke repositori GitHub Anda hanya dengan 1 kali klik!
          </p>
        </div>

        {/* Success Alert */}
        {result?.success && (
          <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 space-y-3">
            <div className="flex items-start gap-2.5 text-emerald-300">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold text-xs block">BERHASIL DIKIRIM KE GITHUB!</span>
                <p className="text-[11px] text-emerald-200/90 mt-0.5">{result.message}</p>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              {result.actionsUrl && (
                <a
                  href={result.actionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors shadow-lg shadow-emerald-500/20"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Lihat Proses Build APK di GitHub Actions</span>
                </a>
              )}
              {result.repoUrl && (
                <a
                  href={result.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold text-xs transition-colors"
                >
                  <Github className="w-4 h-4" />
                  <span>Buka Repositori GitHub Anda</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Error Alert */}
        {result && !result.success && (
          <div className="p-3.5 rounded-2xl bg-rose-950/80 border border-rose-500/50 flex items-start gap-2.5 text-rose-300 text-xs">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
            <div>
              <span className="font-bold block">Gagal Melakukan Push</span>
              <p className="text-[11px] text-rose-200 mt-0.5">{result.message}</p>
            </div>
          </div>
        )}

        {/* Form */}
        {!result?.success && (
          <form onSubmit={handlePush} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <FolderGit2 className="w-3.5 h-3.5 text-amber-400" />
                <span>URL Repositori GitHub Baru Anda</span>
              </label>
              <input
                type="text"
                placeholder="https://github.com/username/catatan-ikan"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-amber-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Buat repositori baru kosong di{' '}
                <a
                  href="https://github.com/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 underline font-semibold"
                >
                  github.com/new
                </a>{' '}
                lalu tempel link-nya di sini.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>GitHub Personal Access Token (PAT)</span>
              </label>
              <input
                type="password"
                placeholder="ghp_..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono focus:border-amber-500 focus:outline-none"
              />

              {/* Token Guide Accordion */}
              <button
                type="button"
                onClick={() => setShowTokenGuide(!showTokenGuide)}
                className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Cara dapat Token dalam 1 menit di HP Android</span>
                {showTokenGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {showTokenGuide && (
                <div className="mt-2 p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] space-y-1.5 text-slate-300">
                  <ol className="list-decimal list-inside space-y-1 text-slate-400">
                    <li>
                      Buka tautan pembuatan token resmi GitHub:{' '}
                      <a
                        href="https://github.com/settings/tokens/new"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-400 underline font-semibold"
                      >
                        github.com/settings/tokens/new
                      </a>
                    </li>
                    <li>Isi <strong>Note</strong>: misal <code>build-apk</code>.</li>
                    <li>
                      Centang kotak <strong>repo</strong> (Full control of private repositories).
                    </li>
                    <li>Gulir ke paling bawah dan klik tombol hijau <strong>Generate token</strong>.</li>
                    <li>Salin token yang berawalan <code>ghp_...</code> lalu tempel di kolom ini!</li>
                  </ol>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <UploadCloud className="w-4 h-4 animate-bounce" />
                  <span>Sedang Mengirim Semua Berkas ke GitHub...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4 stroke-[2.5]" />
                  <span>🚀 PUSH SEMUA FILE & FOLDER KE GITHUB SEKARANG</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Fallback Direct Download */}
        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-400 text-[11px]">Atau unduh berkas ZIP langsung ke HP:</span>
          <a
            href="/catatan-by-iswandi-source.zip"
            download="catatan-by-iswandi-source.zip"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 font-semibold text-[11px] transition-colors shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Unduh ZIP (750 KB)</span>
          </a>
        </div>
      </div>
    </div>
  );
};
