import React, { useEffect, useRef, useState } from 'react';
import {
  Save,
  Plus,
  Trash2,
  AlertTriangle,
  RotateCcw,
  RotateCw,
  CheckCircle2,
  Image as ImageIcon,
  Camera,
  X,
  Edit2,
  Check,
  Scale,
  DollarSign,
  ArrowRight,
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
  'Tongkol',
  'Layang',
  'Soret',
  'Cakalang',
  'Tuna',
  'Deho',
  'Madidihang',
  'Kembung',
  'Tenggiri',
  'Lemuru',
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

  // Initialize with 3 flexible fish slots: Tongkol, Layang, Soret (or initialData items)
  const [items, setItems] = useState<FishItem[]>(() => {
    if (initialData?.items && initialData.items.length > 0) {
      return initialData.items.map((it, idx) => ({
        id: it.id || `fish-${Date.now()}-${idx}`,
        namaIkan: it.namaIkan || `Ikan ${idx + 1}`,
        beratKg: it.beratKg || 0,
        hargaPerKg: it.hargaPerKg,
        subtotal: it.subtotal,
        confidence: 'high',
        weights: it.weights && it.weights.length > 0
          ? it.weights
          : (it.beratKg > 0 ? [it.beratKg] : []),
      }));
    }
    return [
      {
        id: `fish-1`,
        namaIkan: 'Tongkol',
        beratKg: 0,
        confidence: 'high',
        weights: [],
      },
      {
        id: `fish-2`,
        namaIkan: 'Layang',
        beratKg: 0,
        confidence: 'high',
        weights: [],
      },
      {
        id: `fish-3`,
        namaIkan: 'Soret',
        beratKg: 0,
        confidence: 'high',
        weights: [],
      },
    ];
  });

  // Active Fish Slot Index
  const [activeFishIndex, setActiveFishIndex] = useState<number>(0);

  // Box weight numeric input state
  const [weightInput, setWeightInput] = useState<string>('');
  const weightInputRef = useRef<HTMLInputElement>(null);

  // Inline editing of a single box weight
  const [editingWeightIndex, setEditingWeightIndex] = useState<number | null>(null);
  const [editingWeightValue, setEditingWeightValue] = useState<string>('');

  // Editing fish name
  const [isEditingFishName, setIsEditingFishName] = useState<boolean>(false);
  const [tempFishName, setTempFishName] = useState<string>('');

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

  // Hidden File Inputs for Camera & Gallery
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const activeFish = items[activeFishIndex] || items[0];

  // Auto focus input on mount & fish switch
  useEffect(() => {
    weightInputRef.current?.focus();
  }, [activeFishIndex]);

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

  // Rotate photo using canvas
  const handleRotatePhoto = (deg: number) => {
    if (!photoBase64) return;
    const img = new Image();
    img.src = photoBase64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (deg === 90 || deg === -90 || deg === 270) {
        canvas.width = img.height;
        canvas.height = img.width;
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((deg * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      const rotatedBase64 = canvas.toDataURL('image/jpeg', 0.9);
      setPhotoBase64(rotatedBase64);
    };
  };

  // Add Box Weight on Enter or Click
  const handleAddBoxWeight = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanStr = weightInput.trim().replace(',', '.');
    const val = parseFloat(cleanStr);

    if (isNaN(val) || val <= 0) {
      weightInputRef.current?.focus();
      return;
    }

    const roundedVal = Math.round(val * 10) / 10;

    setItems((prev) => {
      const updated = [...prev];
      const cur = updated[activeFishIndex];
      const nextWeights = [...(cur.weights || []), roundedVal];
      const totalKg = Math.round(nextWeights.reduce((a, b) => a + b, 0) * 10) / 10;
      const subtotal = cur.hargaPerKg ? Math.round(totalKg * cur.hargaPerKg) : undefined;

      updated[activeFishIndex] = {
        ...cur,
        weights: nextWeights,
        beratKg: totalKg,
        subtotal,
      };
      return updated;
    });

    setWeightInput('');
    // Ensure keyboard remains open and focus stays on input
    setTimeout(() => {
      weightInputRef.current?.focus();
    }, 10);
  };

  // Remove a single box weight
  const handleRemoveBoxWeight = (weightIndex: number) => {
    setItems((prev) => {
      const updated = [...prev];
      const cur = updated[activeFishIndex];
      const nextWeights = (cur.weights || []).filter((_, i) => i !== weightIndex);
      const totalKg = Math.round(nextWeights.reduce((a, b) => a + b, 0) * 10) / 10;
      const subtotal = cur.hargaPerKg ? Math.round(totalKg * cur.hargaPerKg) : undefined;

      updated[activeFishIndex] = {
        ...cur,
        weights: nextWeights,
        beratKg: totalKg,
        subtotal,
      };
      return updated;
    });
  };

  // Save edited single box weight
  const handleSaveEditedWeight = (weightIndex: number) => {
    const val = parseFloat(editingWeightValue.replace(',', '.'));
    if (!isNaN(val) && val > 0) {
      const roundedVal = Math.round(val * 10) / 10;
      setItems((prev) => {
        const updated = [...prev];
        const cur = updated[activeFishIndex];
        const nextWeights = [...(cur.weights || [])];
        nextWeights[weightIndex] = roundedVal;
        const totalKg = Math.round(nextWeights.reduce((a, b) => a + b, 0) * 10) / 10;
        const subtotal = cur.hargaPerKg ? Math.round(totalKg * cur.hargaPerKg) : undefined;

        updated[activeFishIndex] = {
          ...cur,
          weights: nextWeights,
          beratKg: totalKg,
          subtotal,
        };
        return updated;
      });
    }
    setEditingWeightIndex(null);
    setEditingWeightValue('');
    setTimeout(() => {
      weightInputRef.current?.focus();
    }, 10);
  };

  // Clear all box weights for current fish
  const handleClearCurrentFishWeights = () => {
    if (!activeFish.weights || activeFish.weights.length === 0) return;
    if (window.confirm(`Hapus semua angka timbangan untuk ${activeFish.namaIkan}?`)) {
      setItems((prev) => {
        const updated = [...prev];
        const cur = updated[activeFishIndex];
        updated[activeFishIndex] = {
          ...cur,
          weights: [],
          beratKg: 0,
          subtotal: undefined,
        };
        return updated;
      });
      setTimeout(() => {
        weightInputRef.current?.focus();
      }, 10);
    }
  };

  // Update Harga per kg for active fish
  const handleUpdateHargaPerKg = (hargaVal: number | undefined) => {
    setItems((prev) => {
      const updated = [...prev];
      const cur = updated[activeFishIndex];
      const h = hargaVal && hargaVal > 0 ? hargaVal : undefined;
      const subtotal = h && cur.beratKg > 0 ? Math.round(cur.beratKg * h) : undefined;

      updated[activeFishIndex] = {
        ...cur,
        hargaPerKg: h,
        subtotal,
      };
      return updated;
    });
  };

  // Save renamed fish
  const handleSaveFishName = () => {
    const trimmed = tempFishName.trim();
    if (trimmed) {
      setItems((prev) => {
        const updated = [...prev];
        updated[activeFishIndex] = {
          ...updated[activeFishIndex],
          namaIkan: trimmed,
        };
        return updated;
      });
    }
    setIsEditingFishName(false);
  };

  // Add new fish type slot
  const handleAddNewFishSlot = () => {
    const newIdx = items.length + 1;
    const defaultName = `Ikan ${newIdx}`;
    setItems((prev) => [
      ...prev,
      {
        id: `fish-${Date.now()}-${newIdx}`,
        namaIkan: defaultName,
        beratKg: 0,
        confidence: 'high',
        weights: [],
      },
    ]);
    setActiveFishIndex(items.length);
  };

  // Remove a fish type slot
  const handleRemoveFishSlot = (idxToRemove: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (items.length <= 1) {
      setErrorMessage('Minimal harus ada satu jenis ikan.');
      return;
    }
    const fishName = items[idxToRemove].namaIkan;
    if (window.confirm(`Hapus slot jenis ikan "${fishName}" beserta seluruh angka timbangannya?`)) {
      setItems((prev) => prev.filter((_, i) => i !== idxToRemove));
      if (activeFishIndex >= idxToRemove) {
        setActiveFishIndex(Math.max(0, activeFishIndex - 1));
      }
    }
  };

  // Calculations across all fish types
  const totalBeratKg = calculateTotalKg(items);
  const totalNilaiIkan = calculateItemsRevenue(items);

  const calc = calculateBookkeeping(
    totalBeratKg,
    totalNilaiIkan,
    {
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

  // Save Bookkeeping
  const handleSave = async () => {
    setErrorMessage(null);

    if (totalBeratKg <= 0 && items.every((i) => !i.beratKg)) {
      setErrorMessage('Masukkan angka timbangan minimal satu box sebelum menyimpan.');
      return;
    }

    setIsSaving(true);
    try {
      const recordId = initialData?.id || `rec-${Date.now()}`;
      // Filter out empty items if more than 1 item and has 0 kg, but keep at least active items
      const validItems = items.filter((it) => it.beratKg > 0 || (it.weights && it.weights.length > 0));
      const itemsToSave = validItems.length > 0 ? validItems : items;

      const record: BookkeepingRecord = {
        id: recordId,
        tanggal: tanggal || new Date().toISOString().split('T')[0],
        rumpon: rumpon.trim() || 'Rumpon Utama',
        items: itemsToSave,
        totalBeratKg: calc.totalBeratKg,
        totalTonase: calc.totalTonase,
        totalHarga: calc.totalHargaIkan,
        totalHargaIsManual: false,

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
      {/* Hidden file pickers for Camera & Gallery */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhotoSelect}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoSelect}
        className="hidden"
      />

      {/* Header Banner */}
      <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              {initialData?.id ? 'Edit Catatan Penimbangan' : 'Tambah Penimbangan Box (Manual)'}
            </h2>
            <p className="text-xs text-slate-400">
              Input berat per box dengan Enter cepat, fleksibel antarjenis ikan & hitung otomatis.
            </p>
          </div>
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
              Tanggal Penimbangan
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

      {/* ============================================================ */}
      {/* 2. TIGA JENIS IKAN FLEKSIBEL (TAB SELECTOR) */}
      {/* ============================================================ */}
      <div className="p-4 rounded-3xl bg-slate-900/95 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Pilih Jenis Ikan yang Ditimbang:
            </span>
            <span className="text-[11px] text-slate-500">
              Pindah jenis ikan kapan saja tanpa kehilangan angka sebelumnya.
            </span>
          </div>
          <button
            type="button"
            onClick={handleAddNewFishSlot}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-amber-400 border border-slate-700 text-xs font-bold active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Ikan</span>
          </button>
        </div>

        {/* Tab Buttons for Fish Types */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {items.map((it, idx) => {
            const isActive = idx === activeFishIndex;
            const count = it.weights?.length || 0;
            return (
              <div
                key={it.id}
                onClick={() => setActiveFishIndex(idx)}
                className={`relative p-3 rounded-2xl cursor-pointer transition-all border ${
                  isActive
                    ? 'bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-slate-950 border-amber-500/60 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/40'
                    : 'bg-slate-950/70 border-slate-800/80 hover:bg-slate-850/50'
                }`}
              >
                <div className="flex items-start justify-between gap-1 mb-1.5">
                  <span className={`text-xs font-black truncate ${isActive ? 'text-amber-300' : 'text-slate-200'}`}>
                    {it.namaIkan}
                  </span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => handleRemoveFishSlot(idx, e)}
                      className="text-slate-500 hover:text-red-400 p-0.5 rounded"
                      title="Hapus jenis ikan ini"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-mono font-bold text-sky-300">
                    {formatKg(it.beratKg)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {count} box
                  </span>
                </div>

                {it.hargaPerKg && it.subtotal ? (
                  <div className="mt-1 pt-1 border-t border-slate-800/60 text-[10px] text-emerald-400 font-mono font-bold">
                    {formatRupiah(it.subtotal)}
                  </div>
                ) : null}

                {isActive && (
                  <div className="absolute -top-1.5 right-3 px-2 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[9px] font-black uppercase tracking-wider shadow">
                    Aktif
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Active Fish Detail Header: Rename & Presets */}
        <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800/90 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Sedang menimbang:</span>
              {isEditingFishName ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={tempFishName}
                    onChange={(e) => setTempFishName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveFishName()}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-amber-500 text-xs font-bold text-white focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSaveFishName}
                    className="p-1 rounded bg-amber-500 text-slate-950"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingFishName(false)}
                    className="p-1 rounded bg-slate-800 text-slate-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <strong className="text-sm font-black text-amber-300">
                    {activeFish.namaIkan}
                  </strong>
                  <button
                    type="button"
                    onClick={() => {
                      setTempFishName(activeFish.namaIkan);
                      setIsEditingFishName(true);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-amber-400"
                    title="Ganti nama ikan"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Quick Fish Suggestions */}
            <div className="flex items-center gap-1 overflow-x-auto text-[10px] scrollbar-none">
              <span className="text-slate-500 shrink-0">Preset:</span>
              {COMMON_FISH.slice(0, 5).map((fish) => (
                <button
                  key={fish}
                  type="button"
                  onClick={() => {
                    setItems((prev) => {
                      const updated = [...prev];
                      updated[activeFishIndex] = { ...updated[activeFishIndex], namaIkan: fish };
                      return updated;
                    });
                  }}
                  className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                >
                  {fish}
                </button>
              ))}
            </div>
          </div>

          {/* ============================================================ */}
          {/* 3. HARGA CUKUP SEKALI PER JENIS IKAN */}
          {/* ============================================================ */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Harga per Kg {activeFish.namaIkan} (Rp):
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-mono text-slate-400">Rp</span>
                <input
                  type="number"
                  min="0"
                  step="500"
                  placeholder="Contoh: 20000"
                  value={activeFish.hargaPerKg || ''}
                  onChange={(e) =>
                    handleUpdateHargaPerKg(e.target.value ? parseFloat(e.target.value) : undefined)
                  }
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono font-bold focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="text-left sm:text-right space-y-0.5">
              <span className="text-[10px] text-slate-400 block font-medium">
                Total Nilai {activeFish.namaIkan}:
              </span>
              <div className="text-xs font-mono">
                <span className="text-slate-300">{formatKg(activeFish.beratKg)}</span>
                <span className="text-slate-500"> × </span>
                <span className="text-slate-300">
                  {activeFish.hargaPerKg ? formatRupiah(activeFish.hargaPerKg) : 'Rp 0'}
                </span>
                <span className="text-slate-500"> = </span>
                <strong className="text-emerald-400 text-sm font-black">
                  {formatRupiah(activeFish.subtotal || 0)}
                </strong>
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* 1. INPUT BERAT DENGAN ENTER */}
          {/* ============================================================ */}
          <div className="space-y-2 pt-1">
            <label className="block text-[11px] font-bold text-amber-300 uppercase tracking-wider">
              Input Berat Box (Kg):
            </label>

            <form
              onSubmit={handleAddBoxWeight}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <input
                  ref={weightInputRef}
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder="Ketik angka lalu Enter (cth: 71)"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border-2 border-amber-500/60 text-white font-mono text-base font-black tracking-wide placeholder:text-slate-600 focus:border-amber-400 focus:outline-none shadow-inner"
                />
              </div>

              <button
                type="submit"
                className="py-3 px-5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 active:scale-95 transition-all shrink-0"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>TAMBAH</span>
              </button>
            </form>

            <p className="text-[10px] text-slate-400">
              💡 Tekan <strong>Enter</strong> pada keyboard HP untuk langsung memasukkan angka berikutnya tanpa menutup keyboard.
            </p>
          </div>

          {/* ============================================================ */}
          {/* 4. DAFTAR ANGKA SAJA (TANPA TULISAN BOX 1, BOX 2) + EDIT / HAPUS */}
          {/* ============================================================ */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300">
                Daftar Angka {activeFish.namaIkan} ({activeFish.weights?.length || 0} box):
              </span>
              {(activeFish.weights?.length || 0) > 0 && (
                <button
                  type="button"
                  onClick={handleClearCurrentFishWeights}
                  className="text-[10px] text-red-400 hover:text-red-300 font-semibold"
                >
                  Bersihkan Angka
                </button>
              )}
            </div>

            {(!activeFish.weights || activeFish.weights.length === 0) ? (
              <div className="p-4 rounded-xl bg-slate-950/40 border border-dashed border-slate-800 text-center text-xs text-slate-500">
                Belum ada angka timbangan untuk {activeFish.namaIkan}. Ketik angka box di atas lalu tekan Enter.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2.5 bg-slate-950 rounded-2xl border border-slate-800/80">
                {activeFish.weights.map((w, wIdx) => {
                  const isEditingThis = editingWeightIndex === wIdx;
                  return isEditingThis ? (
                    <div
                      key={wIdx}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-amber-500/20 border border-amber-500 text-xs font-mono"
                    >
                      <input
                        type="number"
                        step="any"
                        inputMode="decimal"
                        value={editingWeightValue}
                        onChange={(e) => setEditingWeightValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEditedWeight(wIdx);
                          if (e.key === 'Escape') setEditingWeightIndex(null);
                        }}
                        className="w-14 px-1 py-0.5 rounded bg-slate-900 border border-amber-400 text-amber-200 text-xs font-bold focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEditedWeight(wIdx)}
                        className="p-0.5 text-emerald-400 hover:text-emerald-300"
                        title="Simpan"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingWeightIndex(null)}
                        className="p-0.5 text-slate-400 hover:text-red-400"
                        title="Batal"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span
                      key={wIdx}
                      className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/40 text-xs font-mono font-bold text-slate-100 shadow-sm transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setEditingWeightIndex(wIdx);
                          setEditingWeightValue(String(w));
                        }}
                        className="hover:text-amber-300"
                        title="Klik untuk mengedit angka ini"
                      >
                        {w}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveBoxWeight(wIdx)}
                        className="text-slate-500 hover:text-red-400 transition-colors p-0.5"
                        title="Hapus angka ini"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* RINGKASAN SELURUH JENIS IKAN */}
      {/* ============================================================ */}
      <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
        <span className="text-xs font-bold text-slate-200 uppercase tracking-wider block">
          Akumulasi Seluruh Jenis Ikan
        </span>

        <div className="space-y-1.5 text-xs">
          {items.map((it, idx) => (
            <div
              key={it.id}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 font-mono"
            >
              <div>
                <strong className="text-slate-200 font-sans">{it.namaIkan}</strong>
                <span className="text-[11px] text-slate-400 ml-2">
                  {formatKg(it.beratKg)} ({it.weights?.length || 0} box)
                </span>
                {it.hargaPerKg ? (
                  <span className="text-[10px] text-slate-500 ml-1.5">
                    @ {formatRupiah(it.hargaPerKg)}/kg
                  </span>
                ) : null}
              </div>
              <strong className="text-emerald-400">
                {it.subtotal ? formatRupiah(it.subtotal) : 'Rp 0'}
              </strong>
            </div>
          ))}
        </div>

        {/* Total Berat & Total Nilai Bar */}
        <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs pt-2">
          <div>
            <span className="text-slate-400 block text-[10px]">TOTAL BERAT IKAN:</span>
            <strong className="text-sky-300 font-mono text-sm">
              {formatKg(calc.totalBeratKg)} ({formatTon(calc.totalTonase)})
            </strong>
          </div>
          <div className="text-right">
            <span className="text-slate-400 block text-[10px]">TOTAL NILAI IKAN:</span>
            <strong className="text-emerald-400 font-mono text-base font-black">
              {formatRupiah(calc.totalHargaIkan)}
            </strong>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* ESTIMASI BIAYA-BIAYA RESMI & KOREKSI MANUAL */}
      {/* ============================================================ */}
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
        <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200">1. Pemikul</span>
              <span className="text-[10px] text-slate-500">
                (Rp300.000 / 1.000 kg)
              </span>
              {pemikulIsManual && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  Manual
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
                <span>Otomatis</span>
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
              min="0"
              step="10000"
              placeholder="Masukkan nominal manual..."
              value={manualPemikul}
              onChange={(e) => setManualPemikul(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs font-mono focus:border-amber-500 focus:outline-none"
            />
          ) : (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-mono">
                {formatKg(calc.totalBeratKg)} × Rp300 / kg
              </span>
              <span className="font-bold text-slate-200 tabular-nums">
                {formatRupiah(calc.biayaPemikul)}
              </span>
            </div>
          )}
        </div>

        {/* 2. ABK */}
        <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200">2. ABK</span>
              <span className="text-[10px] text-slate-500">
                (Rp1.000.000 / Rp20 Jt nilai ikan)
              </span>
              {abkIsManual && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  Manual
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
                <span>Otomatis</span>
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
              min="0"
              step="50000"
              placeholder="Masukkan nominal manual..."
              value={manualAbk}
              onChange={(e) => setManualAbk(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs font-mono focus:border-amber-500 focus:outline-none"
            />
          ) : (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-mono">
                {formatRupiah(calc.totalHargaIkan)} × 5%
              </span>
              <span className="font-bold text-slate-200 tabular-nums">
                {formatRupiah(calc.biayaAbk)}
              </span>
            </div>
          )}
        </div>

        {/* 3. BONGKAR */}
        <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200">3. Bongkar</span>
              <span className="text-[10px] text-slate-500">
                (&lt;1t Rp0, 1t Rp1,4 Jt, +Rp700rb/kelipatan ton)
              </span>
              {bongkarIsManual && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  Manual
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
                <span>Otomatis</span>
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
              min="0"
              step="100000"
              placeholder="Masukkan nominal manual..."
              value={manualBongkar}
              onChange={(e) => setManualBongkar(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs font-mono focus:border-amber-500 focus:outline-none"
            />
          ) : (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-mono">
                {calc.totalTonase < 1 ? '< 1 Ton (Rp0)' : `${formatTon(calc.totalTonase)} kelipatan penuh`}
              </span>
              <span className="font-bold text-slate-200 tabular-nums">
                {formatRupiah(calc.biayaBongkar)}
              </span>
            </div>
          )}
        </div>

        {/* 4. NYELAM */}
        <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200">4. Nyelam</span>
              <span className="text-[10px] text-slate-500">
                (&ge;2t: Rp600rb + Rp600rb/t)
              </span>
              {nyelamIsManual && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  Manual
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
                <span>Otomatis</span>
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
              min="0"
              step="50000"
              placeholder="Masukkan nominal manual..."
              value={manualNyelam}
              onChange={(e) => setManualNyelam(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs font-mono focus:border-amber-500 focus:outline-none"
            />
          ) : (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-mono">
                {calc.totalTonase < 2 ? '< 2 Ton (Rp0)' : `(${formatTon(calc.totalTonase)} - 1) × Rp600rb`}
              </span>
              <span className="font-bold text-slate-200 tabular-nums">
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

      {/* ============================================================ */}
      {/* 5. FOTO BUKU CATATAN WAJIB TETAP TERSEDIA */}
      {/* ============================================================ */}
      <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-200">Foto Asli Buku Catatan</h3>
            <p className="text-[11px] text-slate-400">
              Foto buku asli disertakan saat berbagi gambar atau PDF
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold active:scale-95 transition-all"
            >
              <Camera className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Kamera</span>
            </button>
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold active:scale-95 transition-all border border-slate-700"
            >
              <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
              <span>Galeri</span>
            </button>
          </div>
        </div>

        {photoBase64 && (
          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Pratinjau Foto Asli</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleRotatePhoto(-90)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="Putar Kiri"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleRotatePhoto(90)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="Putar Kanan"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoBase64(null)}
                  className="p-1.5 rounded-lg bg-red-950/60 border border-red-900/50 text-red-300 hover:text-red-200"
                  title="Hapus Foto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="relative rounded-xl overflow-hidden bg-black border border-slate-800 flex items-center justify-center p-1">
              <img
                src={photoBase64}
                alt="Lampiran Buku Catatan"
                className="max-h-56 object-contain rounded-lg"
              />
            </div>
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
