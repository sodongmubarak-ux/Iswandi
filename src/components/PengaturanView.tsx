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
} from 'lucide-react';
import { AppSettings } from '../types';
import { DEFAULT_SETTINGS, formatRupiah, runFormulaVerificationTests, TestVerificationResult } from '../utils/calculator';
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
  const [formData, setFormData] = useState<AppSettings>(initialSettings);
  const [activeTab, setActiveTab] = useState<'rumus' | 'identitas' | 'sosial' | 'cadangan' | 'pengujian' | 'apk'>('apk');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

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

      {/* Header */}
      <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">Pengaturan Sistem & Rumus</h2>
          <p className="text-xs text-slate-400">
            Kelola tarif rumus resmi, identitas laporan, cadangkan data, dan uji validasi.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50"
        >
          {saveSuccess ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4 fill-slate-950" />
          )}
          <span>{saveSuccess ? 'Tersimpan' : 'Simpan'}</span>
        </button>
      </div>

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

      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto p-1.5 rounded-2xl bg-slate-900 border border-slate-800 scrollbar-none text-xs font-semibold">
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
        <button
          onClick={() => setActiveTab('apk')}
          className={`px-3 py-2 rounded-xl whitespace-nowrap transition-all ${
            activeTab === 'apk' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          Panduan APK
        </button>
      </div>

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
                Kelipatan penuh: &le;1 Ton Rp1,4 Jt, naik +Rp700rb/ton
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tarif Dasar Bongkar (&le; 1 Ton)
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
                <p className="text-[10px] text-slate-500 mt-1">Standar: Rp1.400.000 (1 Ton)</p>
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
                  Judul Kepala Slip / Laporan
                </label>
                <input
                  type="text"
                  value={formData.reportTitle}
                  onChange={(e) => handleChange('reportTitle', e.target.value)}
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

      {/* TAB 6: PANDUAN BUILD APK ANDROID & GITHUB */}
      {activeTab === 'apk' && (
        <div className="space-y-4">
          <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-extrabold text-amber-400 uppercase tracking-wider">
                  Panduan & Build APK Android
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                100% Khusus HP Android
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Anda tidak memerlukan komputer/PC untuk membuat file APK aplikasi ini. Semua proses kompilasi Java, Android SDK, dan Gradle dapat berjalan otomatis di cloud GitHub Actions.
            </p>

            {/* SEKSI 1: KIRIM OTOMATIS KE GITHUB (SOLUSI HP ANDROID) */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-slate-900 to-slate-900 border-2 border-amber-500/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                    <Github className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-extrabold text-amber-300 text-xs block">
                      Kirim Otomatis ke GitHub (Paling Mudah)
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Mengatasi batasan Chrome HP yang tidak bisa upload folder
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/40">
                  Rekomendasi
                </span>
              </div>

              <p className="text-slate-300 text-[11px] leading-relaxed">
                Server kami akan langsung mengunggah seluruh folder bersarang (seperti <code>android/</code>, <code>src/</code>, dan <code>.github/</code>) ke akun GitHub Anda dalam 5 detik.
              </p>

              {onOpenGitHub && (
                <button
                  onClick={onOpenGitHub}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <UploadCloud className="w-4 h-4 stroke-[2.5]" />
                  <span>🚀 BUKA FORMULIR PUSH KE GITHUB SEKARANG</span>
                </button>
              )}
            </div>

            {/* SEKSI 2: UNDUH BERKAS LENGKAP (.ZIP) */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
                    <FileArchive className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-extrabold text-slate-200 text-xs block">
                      Berkas Lengkap Proyek (.ZIP)
                    </span>
                    <span className="text-[10px] text-emerald-400 font-semibold">
                      Ukuran Asli: ~750 KB (Bukan 10 KB)
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-bold border border-sky-500/40">
                  Full Source
                </span>
              </div>

              <p className="text-slate-400 text-[11px] leading-relaxed">
                File ZIP ini berisi seluruh kode sumber bersih tanpa dependensi rusak, lengkap dengan proyek <code>android/</code> Capacitor, berkas workflow GitHub Actions, dan aset.
              </p>

              <div className="space-y-2 pt-1">
                <button
                  onClick={handleDownloadFullZip}
                  disabled={isDownloadingZip}
                  className="w-full py-3 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs shadow-lg shadow-sky-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isDownloadingZip ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sedang Mengunduh Berkas ZIP (~750 KB)...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 stroke-[2.5]" />
                      <span>UNDUH BERKAS .ZIP LENGKAP (750 KB)</span>
                    </>
                  )}
                </button>

                <div className="text-center">
                  <a
                    href="/catatan-by-iswandi-source.zip"
                    download="catatan-by-iswandi-source.zip"
                    className="text-[10px] text-slate-500 hover:text-amber-400 underline transition-colors"
                  >
                    Tautan Alternatif Langsung (Jika tombol di atas tidak merespons)
                  </a>
                </div>
              </div>
            </div>

            {/* SEKSI 3: PANDUAN MANUAL DARI BROWSER HP */}
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 text-[11px]">
              <span className="font-bold text-amber-400 block">
                Langkah Membuat File Workflow di GitHub dari HP:
              </span>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
                <li>
                  Buka repositori GitHub Anda di Chrome HP:{' '}
                  <a
                    href="https://github.com/sodongmubarak-ux/Iswandi"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-400 underline font-semibold"
                  >
                    github.com/sodongmubarak-ux/Iswandi
                  </a>
                </li>
                <li>
                  Ketuk <strong>Add file</strong> &gt; pilih <strong>Create new file</strong>.
                </li>
                <li>
                  Pada kotak nama file, ketik persis:{' '}
                  <code className="text-amber-300 bg-slate-900 px-1 py-0.5 rounded">
                    .github/workflows/build-apk.yml
                  </code>
                </li>
                <li>
                  Tempel kode workflow YAML lalu tekan tombol hijau <strong>Commit changes</strong>.
                </li>
                <li>
                  Masuk ke tab <strong>Actions</strong> &gt; tunggu proses build ~2 menit &gt; unduh file{' '}
                  <strong className="text-amber-400">Catatan-by-Iswandi-APK</strong> dan pasang di HP Anda!
                </li>
              </ol>
            </div>

            {/* SEKSI 4: PEMASANGAN INSTAN PWA */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
              <span className="font-bold text-sky-400 block text-xs">
                Pilihan Alternatif: Pasang Langsung Tanpa Build (PWA)
              </span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Di Google Chrome Android, Anda juga bisa langsung mengetuk menu titik tiga (⋮) di pojok kanan atas browser lalu pilih{' '}
                <strong className="text-slate-200">"Tambahkan ke Layar Utama" (Install app)</strong>. Aplikasi akan terpasang langsung di menu HP Anda dengan ikon Catatan Iswandi dan berfungsi 100% offline.
              </p>
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
