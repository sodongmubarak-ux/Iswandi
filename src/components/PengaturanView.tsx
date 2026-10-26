import React, { useState } from 'react';
import {
  Settings,
  Save,
  RotateCcw,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Play,
  Shield,
  Smartphone,
  ExternalLink,
  HelpCircle,
  FileSpreadsheet,
  Github,
  UploadCloud,
  FileArchive,
  Loader2,
  User,
  Heart,
  MessageCircle,
  Mail,
  Sparkles,
  Tag,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { AppSettings } from '../types';
import { DEFAULT_SETTINGS, DEFAULT_FISH_PRESETS, formatRupiah, runFormulaVerificationTests, TestVerificationResult } from '../utils/calculator';
import { exportBackupArchive, importBackupArchive } from '../db/indexedDB';

interface PengaturanViewProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => Promise<void>;
  onReloadRecords: () => Promise<void>;
  onOpenGitHub?: () => void;
}

export const PengaturanView: React.FC<PengaturanViewProps> = ({
  settings: initialSettings,
  onSaveSettings,
  onReloadRecords,
  onOpenGitHub,
}) => {
  const [formData, setFormData] = useState<AppSettings>(() => ({
    ...initialSettings,
    linkDownloadAplikasi:
      initialSettings.linkDownloadAplikasi ||
      'https://github.com/sodongmubarak-ux/Iswandi/releases/latest/download/Catatan-by-Iswandi.apk',
    fishPresets: initialSettings.fishPresets && initialSettings.fishPresets.length > 0
      ? initialSettings.fishPresets
      : [...DEFAULT_FISH_PRESETS],
  }));
  const [activeTab, setActiveTab] = useState<'preset' | 'rumus' | 'identitas' | 'sosial' | 'cadangan' | 'pengujian' | 'about'>('about');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Preset management state
  const [newPresetName, setNewPresetName] = useState<string>('');
  const [presetError, setPresetError] = useState<string | null>(null);

  // Preset management handlers
  const handleAddPreset = () => {
    const trimmed = newPresetName.trim();
    if (!trimmed) {
      setPresetError('Nama jenis ikan tidak boleh kosong.');
      return;
    }
    const currentPresets = formData.fishPresets || DEFAULT_FISH_PRESETS;
    const exists = currentPresets.some((p) => p.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setPresetError(`Preset "${trimmed}" sudah ada di dalam daftar.`);
      return;
    }
    const updated = [...currentPresets, trimmed];
    setFormData((prev) => ({ ...prev, fishPresets: updated }));
    setNewPresetName('');
    setPresetError(null);
    setMessage({ text: `Preset "${trimmed}" berhasil ditambahkan. Klik Simpan Pengaturan di bawah untuk menyimpan.`, type: 'success' });
  };

  const handleRemovePreset = (indexToRemove: number) => {
    const currentPresets = formData.fishPresets || DEFAULT_FISH_PRESETS;
    if (currentPresets.length <= 1) {
      setPresetError('Minimal harus ada 1 jenis preset ikan.');
      return;
    }
    const removedName = currentPresets[indexToRemove];
    const updated = currentPresets.filter((_, idx) => idx !== indexToRemove);
    setFormData((prev) => ({ ...prev, fishPresets: updated }));
    setPresetError(null);
    setMessage({ text: `Preset "${removedName}" berhasil dihapus.`, type: 'success' });
  };

  const handleMovePreset = (index: number, direction: 'up' | 'down') => {
    const currentPresets = [...(formData.fishPresets || DEFAULT_FISH_PRESETS)];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentPresets.length) return;
    const temp = currentPresets[index];
    currentPresets[index] = currentPresets[targetIndex];
    currentPresets[targetIndex] = temp;
    setFormData((prev) => ({ ...prev, fishPresets: currentPresets }));
  };

  const handleResetPresetsToDefault = () => {
    setFormData((prev) => ({ ...prev, fishPresets: [...DEFAULT_FISH_PRESETS] }));
    setPresetError(null);
    setMessage({ text: 'Daftar preset ikan berhasil dikembalikan ke 9 preset standar.', type: 'success' });
  };

  // Formula test state
  const [testResults, setTestResults] = useState<{ allPassed: boolean; results: TestVerificationResult[] } | null>(null);

  // Restore file input ref
  const restoreFileRef = React.useRef<HTMLInputElement>(null);
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState<boolean>(false);
  const [pendingArchive, setPendingArchive] = useState<any>(null);

  const handleChange = (field: keyof AppSettings, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSocialChange = (field: keyof AppSettings['mediaSosial'], value: string) => {
    setFormData((prev) => ({
      ...prev,
      mediaSosial: {
        ...prev.mediaSosial,
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      await onSaveSettings(formData);
      setSaveSuccess(true);
      setMessage({ text: 'Pengaturan berhasil disimpan!', type: 'success' });
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal menyimpan';
      setMessage({ text: msg, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefault = () => {
    if (window.confirm('Pulihkan semua parameter rumus dan pengaturan ke standar resmi?')) {
      setFormData(DEFAULT_SETTINGS);
      setMessage({ text: 'Pengaturan dikembalikan ke nilai default. Jangan lupa klik Simpan.', type: 'success' });
    }
  };

  // Run official formula verification test suite
  const handleRunTests = () => {
    const res = runFormulaVerificationTests();
    setTestResults(res);
  };

  // Download complete project ZIP with verified Blob (~750 KB)
  const handleDownloadFullZip = async () => {
    setIsDownloadingZip(true);
    setMessage(null);
    try {
      const res = await fetch('/catatan-by-iswandi-source.zip');
      if (!res.ok) {
        throw new Error(`Gagal mengunduh berkas (Status HTTP: ${res.status})`);
      }
      const blob = await res.blob();
      const sizeKb = Math.round(blob.size / 1024);
      if (blob.size < 100000) {
        throw new Error(`Ukuran file tidak wajar (${sizeKb} KB). Mengalihkan ke unduhan langsung...`);
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'catatan-by-iswandi-source.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      setMessage({
        text: `Berkas ZIP lengkap berhasil diunduh (${sizeKb} KB)! Seluruh folder android, src, dan workflow siap di-build.`,
        type: 'success',
      });
    } catch (err: unknown) {
      console.warn('Blob download warning, using direct link fallback:', err);
      window.location.href = '/catatan-by-iswandi-source.zip';
      setMessage({
        text: 'Mengunduh langsung berkas ZIP (750 KB) lewat peramban...',
        type: 'success',
      });
    } finally {
      setIsDownloadingZip(false);
    }
  };

  // Export Backup
  const handleExportBackup = async () => {
    try {
      const archive = await exportBackupArchive();
      const jsonStr = JSON.stringify(archive, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Cadangan_Catatan_Iswandi_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setMessage({ text: 'Berkas cadangan berhasil diekspor!', type: 'success' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal mengekspor data';
      setMessage({ text: msg, type: 'error' });
    }
  };

  // Trigger restore file picker
  const handleSelectRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        setPendingArchive(parsed);
        setConfirmRestoreOpen(true);
      } catch {
        setMessage({ text: 'Format berkas cadangan tidak valid (harus JSON).', type: 'error' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmRestore = async () => {
    if (!pendingArchive) return;
    try {
      const res = await importBackupArchive(pendingArchive);
      setConfirmRestoreOpen(false);
      setPendingArchive(null);
      await onReloadRecords();
      if (pendingArchive.settings) {
        setFormData(pendingArchive.settings);
      }
      setMessage({
        text: `Berhasil memulihkan ${res.recordsCount} catatan pembukuan dan pengaturan!`,
        type: 'success',
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal memulihkan data';
      setMessage({ text: msg, type: 'error' });
    }
  };

  return (
    <div className="space-y-5 pb-24">
      {/* Hidden file picker for restore */}
      <input
        ref={restoreFileRef}
        type="file"
        accept=".json"
        onChange={handleSelectRestoreFile}
        className="hidden"
      />


      {message && (
        <div
          className={`p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-semibold ${
            message.type === 'success'
              ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
              : 'bg-red-950/80 border border-red-800 text-red-300'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Settings Navigation Tabs (About Me first) */}
      <div className="flex items-center gap-1.5 overflow-x-auto p-1.5 rounded-2xl bg-slate-900 border border-slate-800 scrollbar-none text-xs font-semibold">
        <button
          onClick={() => setActiveTab('about')}
          className={`px-3.5 py-2 rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 font-bold ${
            activeTab === 'about' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>About Me</span>
        </button>
        <button
          onClick={() => setActiveTab('preset')}
          className={`px-3 py-2 rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 font-bold ${
            activeTab === 'preset' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          <span>Preset Ikan</span>
        </button>
        <button
          onClick={() => setActiveTab('rumus')}
          className={`px-3 py-2 rounded-xl whitespace-nowrap transition-all ${
            activeTab === 'rumus' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          Rumus & Tarif
        </button>
        <button
          onClick={() => setActiveTab('identitas')}
          className={`px-3 py-2 rounded-xl whitespace-nowrap transition-all ${
            activeTab === 'identitas' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          Identitas & Teks
        </button>
        <button
          onClick={() => setActiveTab('sosial')}
          className={`px-3 py-2 rounded-xl whitespace-nowrap transition-all ${
            activeTab === 'sosial' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          Media Sosial
        </button>
        <button
          onClick={() => setActiveTab('pengujian')}
          className={`px-3 py-2 rounded-xl whitespace-nowrap transition-all ${
            activeTab === 'pengujian' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          Uji Validasi Rumus
        </button>
        <button
          onClick={() => setActiveTab('cadangan')}
          className={`px-3 py-2 rounded-xl whitespace-nowrap transition-all ${
            activeTab === 'cadangan' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          Cadangkan Data
        </button>
      </div>

      {/* TAB PRESET IKAN */}
      {activeTab === 'preset' && (
        <div className="space-y-4">
          <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
                    Kelola Preset Jenis Ikan
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold">
                      {(formData.fishPresets || DEFAULT_FISH_PRESETS).length} Preset
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Tombol preset cepat nama ikan saat penimbangan & rekomendasi deteksi AI
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleResetPresetsToDefault}
                className="self-start sm:self-center px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all"
                title="Kembalikan ke 9 preset default resmi"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Reset ke Standar (9 Ikan)</span>
              </button>
            </div>

            {/* Form Input Tambah Preset Baru */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/90 space-y-2.5">
              <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider">
                + Tambah Jenis Ikan Baru
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Contoh: Cakalang, Tenggiri, Madidihang..."
                    value={newPresetName}
                    onChange={(e) => {
                      setNewPresetName(e.target.value);
                      if (presetError) setPresetError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPreset();
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs font-medium focus:border-amber-500 focus:outline-none placeholder:text-slate-600"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddPreset}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-lg shadow-amber-500/20 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Preset</span>
                </button>
              </div>
              {presetError && (
                <p className="text-[11px] text-rose-400 font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{presetError}</span>
                </p>
              )}
            </div>

            {/* List Preset Aktif */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold uppercase tracking-wider text-[11px]">
                  Daftar Preset Aktif
                </span>
                <span className="text-[10px] text-slate-500">
                  Gunakan panah untuk mengubah urutan tombol
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(formData.fishPresets || DEFAULT_FISH_PRESETS).map((preset, idx) => {
                  const list = formData.fishPresets || DEFAULT_FISH_PRESETS;
                  const total = list.length;
                  return (
                    <div
                      key={`${preset}-${idx}`}
                      className="p-3 rounded-2xl bg-slate-950 border border-slate-800/90 flex items-center justify-between gap-2.5 group hover:border-slate-700 transition-all shadow-sm"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-slate-900 text-amber-400 text-[11px] font-mono font-bold flex items-center justify-center shrink-0 border border-slate-800">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-100 truncate">
                          {preset}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Up button */}
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMovePreset(idx, 'up')}
                          className="p-1 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-900 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                          title="Geser ke atas"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        {/* Down button */}
                        <button
                          type="button"
                          disabled={idx === total - 1}
                          onClick={() => handleMovePreset(idx, 'down')}
                          className="p-1 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-900 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                          title="Geser ke bawah"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => handleRemovePreset(idx)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors ml-1"
                          title={`Hapus preset ${preset}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Info Box */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200/90 text-xs flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-300">Preset Standar Resmi:</p>
                <p className="text-[11px] text-slate-300 font-mono">
                  Tongkol, Layang, Soret, Kunyitan, Katombong, Baga-Baga, Ikan Kuning, Campur, Lainnya
                </p>
                <p className="text-[10px] text-amber-400/80">
                  Tip: Anda juga dapat menambah atau menghapus preset langsung saat menimbang di menu Catat Manual.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: RUMUS & TARIF */}
      {activeTab === 'rumus' && (
        <div className="space-y-4">
          <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                1. Rumus Pemikul
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                Proporsional per kilogram
              </span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tarif Pemikul per 1.000 kg (Rp)
              </label>
              <input
                type="number"
                step="10000"
                value={formData.tarifPemikulPer1000Kg}
                onChange={(e) =>
                  handleChange('tarifPemikulPer1000Kg', parseInt(e.target.value) || 0)
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono tabular-nums focus:border-amber-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Standar: Rp300.000. Contoh: 500 kg = Rp150.000; 2.500 kg = Rp750.000.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                2. Rumus Bongkar (Estimasi)
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                &lt;1 Ton: Rp0 · 1 Ton: Rp1,4 Jt · +Rp700rb/kelipatan ton
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tarif Dasar Bongkar (1 Ton)
                </label>
                <input
                  type="number"
                  step="10000"
                  value={formData.bongkarTarifDasar}
                  onChange={(e) =>
                    handleChange('bongkarTarifDasar', parseInt(e.target.value) || 0)
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono tabular-nums focus:border-amber-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">Standar: Rp1.400.000 (Di bawah 1 Ton = Rp 0)</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Kenaikan per Ton Kelipatan (&gt; 1 Ton)
                </label>
                <input
                  type="number"
                  step="10000"
                  value={formData.bongkarKenaikanPerTon}
                  onChange={(e) =>
                    handleChange('bongkarKenaikanPerTon', parseInt(e.target.value) || 0)
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono tabular-nums focus:border-amber-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">Kelipatan penuh: 2t=2,1Jt | 2,4t=2,8Jt</p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                3. Rumus Nyelam (Estimasi)
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                Dimulai saat mencapai 2 Ton
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Batas Minimum Tonase (Ton)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.nyelamBatasMinimumTon}
                  onChange={(e) =>
                    handleChange('nyelamBatasMinimumTon', parseFloat(e.target.value) || 0)
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono tabular-nums focus:border-amber-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">Standar: 2 ton</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tarif Kenaikan per Ton (Rp)
                </label>
                <input
                  type="number"
                  step="10000"
                  value={formData.nyelamTarifKenaikan}
                  onChange={(e) =>
                    handleChange('nyelamTarifKenaikan', parseInt(e.target.value) || 0)
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono tabular-nums focus:border-amber-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Standar: Rp600.000. Rumus: (Tonase - 1) &times; Rp600rb
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                4. Rumus ABK (Estimasi)
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                Berdasarkan Total Nilai Ikan
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Kelipatan Nilai Ikan (Rp)
                </label>
                <input
                  type="number"
                  step="1000000"
                  value={formData.abkKelipatanNilai}
                  onChange={(e) =>
                    handleChange('abkKelipatanNilai', parseInt(e.target.value) || 0)
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono tabular-nums focus:border-amber-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">Standar: Rp20.000.000</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tarif Dasar ABK (Rp)
                </label>
                <input
                  type="number"
                  step="100000"
                  value={formData.abkTarifDasar}
                  onChange={(e) =>
                    handleChange('abkTarifDasar', parseInt(e.target.value) || 0)
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono tabular-nums focus:border-amber-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">Standar: Rp1.000.000</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Metode Perhitungan
                </label>
                <select
                  value={formData.abkMetode}
                  onChange={(e) =>
                    handleChange('abkMetode', e.target.value as 'proporsional' | 'kelipatan_penuh')
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-amber-500 focus:outline-none"
                >
                  <option value="proporsional">Proporsional (Default)</option>
                  <option value="kelipatan_penuh">Kelipatan Penuh (Floor)</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Contoh Rp30 Jt: Proporsional = 1,5 Jt; Kelipatan Penuh = 1 Jt
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={handleResetDefault}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-medium flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Pulihkan Nilai Default</span>
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Simpan Pengaturan Rumus</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: IDENTITAS & TEKS */}
      {activeTab === 'identitas' && (
        <div className="space-y-4">
          <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              Identitas Aplikasi & Laporan
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nama Aplikasi
                </label>
                <input
                  type="text"
                  value={formData.appName}
                  onChange={(e) => handleChange('appName', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nama Pengelola / Pemilik
                </label>
                <input
                  type="text"
                  value={formData.ownerName}
                  onChange={(e) => handleChange('ownerName', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Judul Kepala Slip / Laporan (PDF & Dokumen)
                </label>
                <input
                  type="text"
                  value={formData.reportTitle}
                  onChange={(e) => handleChange('reportTitle', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Judul Khusus Slip Gambar (Bagian Atas Tulisan Standar)
                </label>
                <input
                  type="text"
                  placeholder="PEMBUKUAN HASIL IKAN"
                  value={formData.slipTitle || ''}
                  onChange={(e) => handleChange('slipTitle', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Catatan Bawah Slip Gambar (Footer)
                </label>
                <input
                  type="text"
                  placeholder="Catatan: Ini merupakan hitungan sementara dan bukan hitungan pasti."
                  value={formData.slipFooterNote || ''}
                  onChange={(e) => handleChange('slipFooterNote', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              Catatan Otomatis & Link Download
            </h3>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Teks Catatan Otomatis pada Slip & PDF
              </label>
              <textarea
                rows={3}
                value={formData.teksCatatanOtomatis}
                onChange={(e) => handleChange('teksCatatanOtomatis', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-amber-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Gunakan tag <code>[LINK DOWNLOAD APLIKASI]</code> untuk disubstitusikan otomatis.
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tautan Download Aplikasi
              </label>
              <input
                type="text"
                placeholder="https://... atau kosongkan jika belum tersedia"
                value={formData.linkDownloadAplikasi}
                onChange={(e) => handleChange('linkDownloadAplikasi', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-amber-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Jika belum diisi, placeholder aman akan ditampilkan tanpa membuat link palsu.
              </p>
            </div>
          </div>

          {/* Gemini API Key Configuration Section with Privacy Notice */}
          <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                Konfigurasi Gemini API Pribadi (Opsional)
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Jika Anda mengekspor atau menjalankan aplikasi ini secara mandiri di luar server Google AI Studio,
              Anda dapat memasukkan Google Gemini API Key Anda di sini. Kunci ini hanya disimpan di IndexedDB
              perangkat Anda dan digunakan khusus saat Anda menekan tombol "PROSES SCAN AI".
            </p>
            <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-900/50 text-[11px] text-amber-300 space-y-1">
              <span className="font-bold block">Pemberitahuan Keamanan & Privasi:</span>
              <span>
                Data pembukuan dan foto Anda 100% tersimpan secara lokal di perangkat. Foto hanya dikirim ke
                layanan AI Google saat Anda secara sadar menekan tombol scan. Kunci API yang disimpan di perangkat
                lokal berisiko diekstrak jika file aplikasi dibagikan ke orang lain.
              </span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Custom Gemini API Key
              </label>
              <input
                type="password"
                placeholder="AIzaSy..."
                value={formData.userApiKey || ''}
                onChange={(e) => handleChange('userApiKey', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Simpan Identitas & Teks</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: MEDIA SOSIAL */}
      {activeTab === 'sosial' && (
        <div className="space-y-4">
          <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              Akun Media Sosial Pemilik
            </h3>
            <p className="text-xs text-slate-400">
              Akun yang diisi akan ditampilkan pada slip laporan dan berkas PDF.
            </p>

            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">TikTok</label>
                <input
                  type="text"
                  placeholder="@username atau link"
                  value={formData.mediaSosial?.tiktok || ''}
                  onChange={(e) => handleSocialChange('tiktok', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Facebook</label>
                <input
                  type="text"
                  placeholder="Nama Halaman / Akun Facebook"
                  value={formData.mediaSosial?.facebook || ''}
                  onChange={(e) => handleSocialChange('facebook', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Instagram</label>
                <input
                  type="text"
                  placeholder="@username"
                  value={formData.mediaSosial?.instagram || ''}
                  onChange={(e) => handleSocialChange('instagram', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tautan Tambahan / WhatsApp
                </label>
                <input
                  type="text"
                  placeholder="Nomor WA / Link website lain"
                  value={formData.mediaSosial?.linkLain || ''}
                  onChange={(e) => handleSocialChange('linkLain', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Simpan Media Sosial</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: UJI VALIDASI RUMUS (MANDATORY TEST SUITE) */}
      {activeTab === 'pengujian' && (
        <div className="space-y-4">
          <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Pengujian Wajib Rumus Matematika
                </h3>
                <p className="text-xs text-slate-400">
                  Verifikasi otomatis seluruh aturan resmi dari spesifikasi teknis
                </p>
              </div>
              <button
                onClick={handleRunTests}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md active:scale-95"
              >
                <Play className="w-3.5 h-3.5 fill-slate-950" />
                <span>Jalankan Pengujian</span>
              </button>
            </div>

            {testResults ? (
              <div className="space-y-3 pt-2">
                <div
                  className={`p-3 rounded-2xl flex items-center justify-between font-bold text-xs ${
                    testResults.allPassed
                      ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                      : 'bg-red-950/80 border border-red-800 text-red-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>
                      {testResults.allPassed
                        ? '100% PENGUJIAN LULUS (Semua Rumus Akurat Sesuai Spesifikasi)'
                        : 'Ada Pengujian yang Gagal'}
                    </span>
                  </div>
                  <span className="font-mono">
                    {testResults.results.filter((r) => r.passed).length} /{' '}
                    {testResults.results.length} Lulus
                  </span>
                </div>

                <div className="space-y-1.5 max-h-80 overflow-y-auto">
                  {testResults.results.map((test, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            test.passed ? 'bg-emerald-400' : 'bg-red-400'
                          }`}
                        />
                        <span className="font-semibold text-slate-200">{test.title}</span>
                        <span className="text-[10px] text-slate-500">({test.inputDesc})</span>
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-slate-400">Hasil: </span>
                        <strong className="text-amber-400">{formatRupiah(test.actual)}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-center space-y-2">
                <FileSpreadsheet className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-300 font-semibold">
                  Klik tombol di atas untuk menjalankan pengujian otomatis seluruh rumus
                </p>
                <p className="text-[11px] text-slate-500">
                  Termasuk simulasi 2,5 Ton & Rp100.000.000 menghasilkan Bersih Rp91.600.000.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: CADANGKAN & PULIHKAN DATA */}
      {activeTab === 'cadangan' && (
        <div className="space-y-4">
          <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              Cadangkan & Pulihkan Pembukuan
            </h3>
            <p className="text-xs text-slate-400">
              Ekspor seluruh catatan pembukuan, pengaturan, dan arsip foto asli ke file JSON untuk disimpan
              sebagai cadangan atau dipindahkan ke perangkat lain.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleExportBackup}
                className="py-3.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <Download className="w-4 h-4 text-amber-400" />
                <span>CADANGKAN DATA (EKSPOR)</span>
              </button>

              <button
                onClick={() => restoreFileRef.current?.click()}
                className="py-3.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <Upload className="w-4 h-4 text-sky-400" />
                <span>PULIHKAN DATA (IMPOR)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: ABOUT ME (TENTANG PEMBUAT) */}
      {activeTab === 'about' && (
        <div className="space-y-4">
          <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-6">
            {/* Header Profile */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden shrink-0 border-2 border-amber-400 shadow-xl shadow-amber-500/25 bg-slate-950 group">
                <img
                  src="/assets/aistudio/IMG_20261026_003856_174_7262942a.png"
                  alt="Iswandi - Foto Profil"
                  className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-3xl pointer-events-none" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h3 className="text-xl font-black text-white tracking-tight">Iswandi</h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                    Creator & Tech Enthusiast
                  </span>
                </div>
                <p className="text-xs text-amber-400 font-medium">
                  Pengembang & Inisiator Aplikasi Catatan Hasil Ikan
                </p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 pt-1">
                  <span className="px-2 py-0.5 rounded-md bg-slate-950 text-slate-400 text-[10px] font-mono border border-slate-800">
                    #AndroidModder
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950 text-slate-400 text-[10px] font-mono border border-slate-800">
                    #CustomROM
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950 text-slate-400 text-[10px] font-mono border border-slate-800">
                    #AIAppBuilder
                  </span>
                </div>
              </div>
            </div>

            {/* User Story & Bio */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
                <Sparkles className="w-4 h-4" />
                <span>CERITA DI BALIK APLIKASI</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                Aplikasi ini adalah aplikasi pertama yang saya buat dengan bantuan AI. Saya bukan seorang Developer Aplikasi, saya hanya suka Teknologi yang saat ini sangat cepat berkembang.
              </p>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Sejak tahun 2013 saya suka me-modif aplikasi dan game Android. Bahkan pecinta custom rom Android pada masa jayanya cusrom.
              </p>
            </div>

            {/* Contact Cards Section */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Hubungi & Terhubung Langsung
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* WhatsApp */}
                <a
                  href="https://wa.me/6285179709543?text=Halo%20Bang%20Iswandi,%20saya%20pengguna%20aplikasi%20Catatan%20Ikan"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-950/20 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                      <MessageCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">WhatsApp</span>
                      <span className="text-xs font-bold text-slate-100 group-hover:text-emerald-300 font-mono">
                        085179709543
                      </span>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-emerald-400" />
                </a>

                {/* Email */}
                <a
                  href="mailto:afiqahnaylaputrii@gmail.com?subject=Catatan%20by%20Iswandi"
                  className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-sky-500/50 hover:bg-sky-950/20 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Email</span>
                      <span className="text-xs font-bold text-slate-100 group-hover:text-sky-300 truncate max-w-[170px] block">
                        afiqahnaylaputrii@gmail.com
                      </span>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-sky-400" />
                </a>

                {/* Facebook */}
                <a
                  href="https://www.facebook.com/1swandi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-blue-500/50 hover:bg-blue-950/20 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm">
                      FB
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Facebook</span>
                      <span className="text-xs font-bold text-slate-100 group-hover:text-blue-300">
                        1swandi
                      </span>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-blue-400" />
                </a>

                {/* Instagram */}
                <a
                  href="https://instagram.com/1swandi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-pink-500/50 hover:bg-pink-950/20 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center font-bold text-sm">
                      IG
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Instagram</span>
                      <span className="text-xs font-bold text-slate-100 group-hover:text-pink-300">
                        @1swandi
                      </span>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-pink-400" />
                </a>

                {/* TikTok */}
                <a
                  href="https://tiktok.com/@1swandi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 hover:bg-amber-950/20 transition-all flex items-center justify-between group sm:col-span-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">
                      TT
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">TikTok</span>
                      <span className="text-xs font-bold text-slate-100 group-hover:text-amber-300">
                        @1swandi
                      </span>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-amber-400" />
                </a>
              </div>
            </div>

            {/* Quick APK Download Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-950 to-slate-950 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-center sm:text-left">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">Catatan by Iswandi APK (Versi Android)</span>
                  <span className="text-[10px] text-slate-400">Unduh langsung ke HP Android · 100% Offline & Cepat</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-center">
                <a
                  href="https://github.com/sodongmubarak-ux/Iswandi/releases/latest/download/Catatan-by-Iswandi.apk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Unduh APK Terbaru</span>
                </a>
                <a
                  href="https://github.com/sodongmubarak-ux/Iswandi/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-semibold text-xs flex items-center gap-1.5 border border-slate-700 active:scale-95 transition-all whitespace-nowrap"
                  title="Lihat seluruh daftar rilis dan versi APK di GitHub"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  <span>Semua Versi</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Restore */}
      {confirmRestoreOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-5 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-950/80 border border-amber-800/80 flex items-center justify-center text-amber-400 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white">Konfirmasi Pemulihan Data</h3>
              <p className="text-xs text-slate-400">
                Memulihkan data akan menggabungkan atau memperbarui catatan pembukuan dan pengaturan dari file cadangan.
                Apakah Anda ingin melanjutkan?
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => {
                  setConfirmRestoreOpen(false);
                  setPendingArchive(null);
                }}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmRestore}
                className="py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
              >
                Ya, Pulihkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
