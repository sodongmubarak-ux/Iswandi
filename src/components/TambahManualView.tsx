import React, { useEffect, useState } from 'react';
import {
  Save,
  Plus,
  Trash2,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Image as ImageIcon,
  Sparkles,
  Camera,
  X,
  Info,
} from 'lucide-react';
import { AppSettings, BookkeepingRecord, FishItem } from '../types';
import {
  calculateBookkeeping,
  calculateItemsRevenue,
  calculateTotalKg,
  formatKg,
  formatRupiah,
  formatTon,
} from '../utils/calculator';

const COMMON_FISH = [
  'Cakalang',
  'Tongkol',
  'Tuna',
  'Layang',
  'Deho',
  'Madidihang',
  'Kembung',
  'Tenggiri',
  'Lemuru',
  'Kuwe',
];

interface TambahManualViewProps {
  settings: AppSettings;
  initialData?: Partial<BookkeepingRecord> | null;
  initialPhotoBase64?: string | null;
  onSaveRecord: (record: BookkeepingRecord, photoBase64?: string) => Promise<void>;
  onCancel: () => void;
}

export const TambahManualView: React.FC<TambahManualViewProps> = ({
  settings,
  initialData,
  initialPhotoBase64,
  onSaveRecord,
  onCancel,
}) => {
  const [tanggal, setTanggal] = useState<string>(
    initialData?.tanggal || new Date().toISOString().split('T')[0]
  );
  const [rumpon, setRumpon] = useState<string>(initialData?.rumpon || '');
  const [items, setItems] = useState<FishItem[]>(
    initialData?.items && initialData.items.length > 0
      ? initialData.items
      : [
          {
            id: `item-${Date.now()}-1`,
            namaIkan: 'Cakalang',
            beratKg: 0,
            confidence: 'high',
          },
        ]
  );

  // Manual total revenue override
  const [useManualTotalHarga, setUseManualTotalHarga] = useState<boolean>(
    Boolean(initialData?.totalHargaIsManual)
  );
  const [manualTotalHarga, setManualTotalHarga] = useState<string>(
    initialData?.totalHarga ? String(initialData.totalHarga) : ''
  );

  // Fee Overrides
  const [pemikulIsManual, setPemikulIsManual] = useState<boolean>(
    Boolean(initialData?.biayaPemikulIsManual)
  );
  const [manualPemikul, setManualPemikul] = useState<string>(
    initialData?.biayaPemikul ? String(initialData.biayaPemikul) : ''
  );

  const [abkIsManual, setAbkIsManual] = useState<boolean>(
    Boolean(initialData?.biayaAbkIsManual)
  );
  const [manualAbk, setManualAbk] = useState<string>(
    initialData?.biayaAbk ? String(initialData.biayaAbk) : ''
  );

  const [bongkarIsManual, setBongkarIsManual] = useState<boolean>(
    Boolean(initialData?.biayaBongkarIsManual)
  );
  const [manualBongkar, setManualBongkar] = useState<string>(
    initialData?.biayaBongkar ? String(initialData.biayaBongkar) : ''
  );

  const [nyelamIsManual, setNyelamIsManual] = useState<boolean>(
    Boolean(initialData?.biayaNyelamIsManual)
  );
  const [manualNyelam, setManualNyelam] = useState<string>(
    initialData?.biayaNyelam ? String(initialData.biayaNyelam) : ''
  );

  const [keterangan, setKeterangan] = useState<string>(initialData?.keterangan || '');
  const [photoBase64, setPhotoBase64] = useState<string | null>(initialPhotoBase64 || null);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // File Input Ref
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Handle Photo selection
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoBase64(event.target?.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Row management
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${prev.length + 1}`,
        namaIkan: 'Tongkol',
        beratKg: 0,
        confidence: 'high',
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setErrorMessage('Harus ada setidaknya satu jenis ikan.');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, field: keyof FishItem, value: unknown) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      if (field === 'beratKg' || field === 'hargaPerKg') {
        const b = field === 'beratKg' ? Number(value) : next[index].beratKg;
        const h = field === 'hargaPerKg' ? Number(value) : next[index].hargaPerKg;
        if (b > 0 && h && h > 0) {
          next[index].subtotal = b * h;
        }
      }
      return next;
    });
  };

  // Dynamic calculations
  const totalBeratKg = calculateTotalKg(items);
  const computedRevenue = calculateItemsRevenue(items);
  const effectiveTotalHarga = useManualTotalHarga
    ? Number(manualTotalHarga) || 0
    : computedRevenue;

  const calc = calculateBookkeeping(
    totalBeratKg,
    effectiveTotalHarga,
    {
      totalHargaIsManual: useManualTotalHarga,
      manualTotalHarga: Number(manualTotalHarga) || 0,
      pemikulIsManual,
      manualPemikul: Number(manualPemikul) || 0,
      abkIsManual,
      manualAbk: Number(manualAbk) || 0,
      bongkarIsManual,
      manualBongkar: Number(manualBongkar) || 0,
      nyelamIsManual,
      manualNyelam: Number(manualNyelam) || 0,
    },
    settings
  );

  // Save handler
  const handleSave = async () => {
    setErrorMessage(null);

    if (totalBeratKg <= 0 && items.every((i) => !i.beratKg)) {
      setErrorMessage('Masukkan berat ikan yang valid.');
      return;
    }

    setIsSaving(true);
    try {
      const recordId = initialData?.id || `rec-${Date.now()}`;
      const record: BookkeepingRecord = {
        id: recordId,
        tanggal: tanggal || new Date().toISOString().split('T')[0],
        rumpon: rumpon.trim() || 'Rumpon Utama',
        items,
        totalBeratKg: calc.totalBeratKg,
        totalTonase: calc.totalTonase,
        totalHarga: calc.totalHargaIkan,
        totalHargaIsManual: useManualTotalHarga,

        biayaPemikul: calc.biayaPemikul,
        biayaPemikulIsManual: pemikulIsManual,

        biayaAbk: calc.biayaAbk,
        biayaAbkIsManual: abkIsManual,

        biayaBongkar: calc.biayaBongkar,
        biayaBongkarIsManual: bongkarIsManual,

        biayaNyelam: calc.biayaNyelam,
        biayaNyelamIsManual: nyelamIsManual,

        totalBiaya: calc.totalBiaya,
        bersih: calc.bersih,

        keterangan,
        createdAt: initialData?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await onSaveRecord(record, photoBase64 || undefined);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 2500);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal menyimpan pembukuan';
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-24">
      {/* Hidden file picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoSelect}
        className="hidden"
      />

      {/* Header Banner */}
      <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">
            {initialData?.id ? 'Edit Catatan Pembukuan' : 'Tambah Pembukuan Manual'}
          </h2>
          <p className="text-xs text-slate-400">
            Kalkulasi otomatis biaya pemikul, ABK, bongkar, nyelam & bersih.
          </p>
        </div>
        {initialData?.id && (
          <button
            onClick={onCancel}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
            title="Batal edit"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-red-950/80 border border-red-800/80 flex items-center gap-3 text-xs text-red-200">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Metadata Form: Tanggal & Rumpon */}
      <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Tanggal Pembukuan
            </label>
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm font-mono focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Nama Rumpon / Lokasi
            </label>
            <input
              type="text"
              placeholder="Contoh: Rumpon 02 Karang"
              value={rumpon}
              onChange={(e) => setRumpon(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:border-amber-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Fish Items Table */}
      <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-200">Rincian Hasil Ikan</h3>
            <p className="text-[11px] text-slate-400">Tambahkan setiap jenis ikan dan beratnya</p>
          </div>
          <button
            onClick={handleAddItem}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 text-xs font-bold active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Jenis Ikan</span>
          </button>
        </div>

        {/* Quick fish name suggestions */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 text-slate-400 text-[11px] scrollbar-none">
          <span className="shrink-0 text-slate-500">Pilihan cepat:</span>
          {COMMON_FISH.map((fish) => (
            <button
              key={fish}
              type="button"
              onClick={() => {
                setItems((prev) => [
                  ...prev,
                  {
                    id: `item-${Date.now()}-${prev.length + 1}`,
                    namaIkan: fish,
                    beratKg: 0,
                    confidence: 'high',
                  },
                ]);
              }}
              className="shrink-0 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700/80 text-slate-300 text-[10px] font-medium"
            >
              + {fish}
            </button>
          ))}
        </div>

        {/* Items Rows */}
        <div className="space-y-2.5">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs font-mono font-bold text-amber-400">#{idx + 1}</span>
                  <input
                    type="text"
                    placeholder="Nama Ikan (Cakalang, Tuna...)"
                    value={item.namaIkan}
                    onChange={(e) => handleUpdateItem(idx, 'namaIkan', e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs font-semibold focus:border-amber-500 focus:outline-none"
                  />
                </div>
                {items.length > 1 && (
                  <button
                    onClick={() => handleRemoveItem(idx)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                    title="Hapus baris"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Berat (kg)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={item.beratKg || ''}
                    onChange={(e) =>
                      handleUpdateItem(idx, 'beratKg', parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs font-mono tabular-nums focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Harga / kg (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="Opsional"
                    value={item.hargaPerKg || ''}
                    onChange={(e) =>
                      handleUpdateItem(idx, 'hargaPerKg', parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs font-mono tabular-nums focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Subtotal (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="0"
                    value={item.subtotal || ''}
                    onChange={(e) =>
                      handleUpdateItem(idx, 'subtotal', parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs font-mono tabular-nums focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tonnage summary badge */}
        <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-400">Total Berat: </span>
            <strong className="text-white font-mono">{formatKg(calc.totalBeratKg)}</strong>
          </div>
          <div>
            <span className="text-slate-400">Tonase: </span>
            <strong className="text-sky-300 font-mono text-sm">{formatTon(calc.totalTonase)}</strong>
          </div>
        </div>
      </div>

      {/* Total Gross Revenue & Mode Toggle */}
      <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-200">Total Nilai Ikan (Kotor)</h3>
            <p className="text-[11px] text-slate-400">
              {useManualTotalHarga
                ? 'Mode Manual: Nominal ditentukan langsung'
                : 'Mode Otomatis: Dihitung dari subtotal rincian ikan'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (useManualTotalHarga) {
                setUseManualTotalHarga(false);
                setManualTotalHarga('');
              } else {
                setUseManualTotalHarga(true);
                setManualTotalHarga(String(computedRevenue || ''));
              }
            }}
            className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1"
          >
            {useManualTotalHarga ? 'Hitung dari Rincian' : 'Koreksi Langsung'}
          </button>
        </div>

        {useManualTotalHarga ? (
          <div>
            <label className="block text-[10px] text-amber-400 mb-1">
              Nominal Total Nilai Ikan (Rp):
            </label>
            <input
              type="number"
              min="0"
              step="10000"
              value={manualTotalHarga}
              onChange={(e) => setManualTotalHarga(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-amber-500/50 text-amber-300 text-sm font-mono font-bold focus:border-amber-400 focus:outline-none"
            />
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
            <span className="text-xs text-slate-400">Akumulasi Harga Ikan:</span>
            <span className="text-base font-black text-emerald-400 font-mono tabular-nums">
              {formatRupiah(computedRevenue)}
            </span>
          </div>
        )}
      </div>

      {/* Breakdown Fees (Pemikul, ABK, Bongkar, Nyelam) with Manual Overrides */}
      <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-200">Rincian Potongan & Biaya</h3>
            <p className="text-[11px] text-slate-400">
              Kalkulasi rumus resmi dengan opsi koreksi manual per komponen
            </p>
          </div>
        </div>

        {/* 1. PEMIKUL */}
        <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200">1. Pemikul</span>
              <span className="text-[10px] text-slate-500">
                (Rp300.000 / 1.000 kg)
              </span>
              {pemikulIsManual && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  Koreksi Manual
                </span>
              )}
            </div>
            {pemikulIsManual ? (
              <button
                type="button"
                onClick={() => {
                  setPemikulIsManual(false);
                  setManualPemikul('');
                }}
                className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Kembali ke Otomatis</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setPemikulIsManual(true);
                  setManualPemikul(String(calc.biayaPemikul));
                }}
                className="text-[11px] text-slate-400 hover:text-slate-200 font-semibold"
              >
                Koreksi Manual
              </button>
            )}
          </div>

          {pemikulIsManual ? (
            <input
              type="number"
              value={manualPemikul}
              onChange={(e) => setManualPemikul(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-amber-500/50 text-slate-100 text-xs font-mono tabular-nums focus:border-amber-400 focus:outline-none"
            />
          ) : (
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-400 font-mono">
                ({formatKg(calc.totalBeratKg)} / 1.000) &times; Rp300.000
              </span>
              <span className="font-bold text-slate-100 font-mono tabular-nums">
                {formatRupiah(calc.biayaPemikul)}
              </span>
            </div>
          )}
        </div>

        {/* 2. ABK */}
        <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200">2. ABK (Estimasi)</span>
              <span className="text-[10px] text-slate-500">
                (Rp1.000.000 / Rp20 Juta)
              </span>
              {abkIsManual && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  Koreksi Manual
                </span>
              )}
            </div>
            {abkIsManual ? (
              <button
                type="button"
                onClick={() => {
                  setAbkIsManual(false);
                  setManualAbk('');
                }}
                className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Kembali ke Otomatis</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAbkIsManual(true);
                  setManualAbk(String(calc.biayaAbk));
                }}
                className="text-[11px] text-slate-400 hover:text-slate-200 font-semibold"
              >
                Koreksi Manual
              </button>
            )}
          </div>

          {abkIsManual ? (
            <input
              type="number"
              value={manualAbk}
              onChange={(e) => setManualAbk(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-amber-500/50 text-slate-100 text-xs font-mono tabular-nums focus:border-amber-400 focus:outline-none"
            />
          ) : (
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-400 font-mono">
                {settings.abkMetode === 'kelipatan_penuh' ? 'Kelipatan Penuh' : 'Proporsional'}{' '}
                dari {formatRupiah(calc.totalHargaIkan)}
              </span>
              <span className="font-bold text-slate-100 font-mono tabular-nums">
                {formatRupiah(calc.biayaAbk)}
              </span>
            </div>
          )}
        </div>

        {/* 3. BONGKAR */}
        <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200">3. Bongkar (Estimasi)</span>
              <span className="text-[10px] text-slate-500">
                (&le;2t Rp1,4 Jt, &gt;2t +Rp700rb/t)
              </span>
              {bongkarIsManual && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  Koreksi Manual
                </span>
              )}
            </div>
            {bongkarIsManual ? (
              <button
                type="button"
                onClick={() => {
                  setBongkarIsManual(false);
                  setManualBongkar('');
                }}
                className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Kembali ke Otomatis</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setBongkarIsManual(true);
                  setManualBongkar(String(calc.biayaBongkar));
                }}
                className="text-[11px] text-slate-400 hover:text-slate-200 font-semibold"
              >
                Koreksi Manual
              </button>
            )}
          </div>

          {bongkarIsManual ? (
            <input
              type="number"
              value={manualBongkar}
              onChange={(e) => setManualBongkar(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-amber-500/50 text-slate-100 text-xs font-mono tabular-nums focus:border-amber-400 focus:outline-none"
            />
          ) : (
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-400 font-mono">
                {calc.totalTonase <= 0
                  ? '0 tonase'
                  : calc.totalTonase <= 2
                  ? 'Tarif tetap 1 - 2 Ton'
                  : `Rp1,4 Jt + (${(calc.totalTonase - 2).toFixed(3)}t &times; Rp700rb)`}
              </span>
              <span className="font-bold text-slate-100 font-mono tabular-nums">
                {formatRupiah(calc.biayaBongkar)}
              </span>
            </div>
          )}
        </div>

        {/* 4. NYELAM */}
        <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200">4. Nyelam (Estimasi)</span>
              <span className="text-[10px] text-slate-500">
                (Mulai 2t: Rp600rb + Rp600rb/t)
              </span>
              {nyelamIsManual && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  Koreksi Manual
                </span>
              )}
            </div>
            {nyelamIsManual ? (
              <button
                type="button"
                onClick={() => {
                  setNyelamIsManual(false);
                  setManualNyelam('');
                }}
                className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Kembali ke Otomatis</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setNyelamIsManual(true);
                  setManualNyelam(String(calc.biayaNyelam));
                }}
                className="text-[11px] text-slate-400 hover:text-slate-200 font-semibold"
              >
                Koreksi Manual
              </button>
            )}
          </div>

          {nyelamIsManual ? (
            <input
              type="number"
              value={manualNyelam}
              onChange={(e) => setManualNyelam(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-amber-500/50 text-slate-100 text-xs font-mono tabular-nums focus:border-amber-400 focus:outline-none"
            />
          ) : (
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-400 font-mono">
                {calc.totalTonase < 2
                  ? '< 2 Ton (Bebas Biaya Nyelam)'
                  : `(${(calc.totalTonase - 1).toFixed(3)}t &times; Rp600rb)`}
              </span>
              <span className="font-bold text-slate-100 font-mono tabular-nums">
                {formatRupiah(calc.biayaNyelam)}
              </span>
            </div>
          )}
        </div>

        {/* Total Biaya Strip */}
        <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-400 font-semibold">Total Biaya Operasional:</span>
          <span className="font-extrabold text-rose-400 font-mono tabular-nums">
            {formatRupiah(calc.totalBiaya)}
          </span>
        </div>
      </div>

      {/* BERSIH CARD */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-transparent border-2 border-amber-500/50 shadow-xl space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-extrabold text-amber-300 uppercase tracking-widest block">
              TOTAL BERSIH (NETTO)
            </span>
            <span className="text-[11px] text-slate-400">
              Total Nilai Ikan dikurangi seluruh potongan biaya
            </span>
          </div>
          <span className="text-2xl sm:text-3xl font-black text-amber-400 tabular-nums">
            {formatRupiah(calc.bersih)}
          </span>
        </div>

        {calc.isNegativeNet && (
          <div className="p-3 rounded-xl bg-red-950/80 border border-red-800/80 flex items-start gap-2.5 text-xs text-red-200 mt-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-red-300">Peringatan: Nilai Bersih Negatif</p>
              <p className="mt-0.5">
                Total biaya operasional ({formatRupiah(calc.totalBiaya)}) melebihi total pendapatan
                ikan ({formatRupiah(calc.totalHargaIkan)}).
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Attach Photo (Optional) */}
      <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-200">Lampiran Foto Asli Buku Catatan</h3>
            <p className="text-[11px] text-slate-400">Tersimpan lokal & aman di perangkat Anda</p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold"
          >
            <Camera className="w-3.5 h-3.5 text-amber-400" />
            <span>{photoBase64 ? 'Ganti Foto' : 'Pilih Foto'}</span>
          </button>
        </div>

        {photoBase64 && (
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 p-1 flex items-center justify-center">
            <img
              src={photoBase64}
              alt="Lampiran Buku Catatan"
              className="max-h-48 object-contain rounded-xl"
            />
            <button
              type="button"
              onClick={() => setPhotoBase64(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-slate-900/80 text-slate-300 hover:text-red-400"
              title="Hapus lampiran foto"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Notes / Keterangan */}
      <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-2">
        <label className="block text-xs font-bold text-slate-200">Keterangan Tambahan</label>
        <textarea
          rows={3}
          placeholder="Catatan kondisi laut, pengeluaran bahan bakar/es, dll (opsional)..."
          value={keterangan}
          onChange={(e) => setKeterangan(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-amber-500 focus:outline-none"
        />
      </div>

      {/* Save Action */}
      <div className="pt-2">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 active:scale-95 disabled:opacity-50 transition-all"
        >
          {isSaving ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              Menyimpan ke Database Lokal...
            </span>
          ) : saveSuccess ? (
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-slate-950" />
              BERHASIL TERSIMPAN!
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Save className="w-5 h-5 fill-slate-950" />
              SIMPAN PEMBUKUAN
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
