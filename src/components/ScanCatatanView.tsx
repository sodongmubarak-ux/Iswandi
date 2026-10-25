import React, { useRef, useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import {
  Camera,
  Image as ImageIcon,
  RotateCw,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Save,
  RefreshCw,
  Eye,
  Trash2,
  Plus,
  Info,
  Zap,
  WifiOff,
  Scale,
  ListPlus,
  X,
} from 'lucide-react';
import { AppSettings, BookkeepingRecord, FishItem } from '../types';
import { calculateBookkeeping, calculateTotalKg, formatKg, formatRupiah, formatTon } from '../utils/calculator';
import { parseFishTallySheetOffline } from '../utils/tallyParser';

interface ScanCatatanViewProps {
  settings: AppSettings;
  onSaveRecord: (record: BookkeepingRecord, photoBase64?: string) => Promise<void>;
  onEditInForm: (partialRecord: Partial<BookkeepingRecord>, photoBase64?: string) => void;
}

export const ScanCatatanView: React.FC<ScanCatatanViewProps> = ({
  settings,
  onSaveRecord,
  onEditInForm,
}) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [scanMode, setScanMode] = useState<'gemini' | 'offline'>('gemini');
  const [rawPhoto, setRawPhoto] = useState<string | null>(null);
  const [photoRotation, setPhotoRotation] = useState<number>(0);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanStep, setScanStep] = useState<string>('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [isHighDemandError, setIsHighDemandError] = useState<boolean>(false);

  const [scanResult, setScanResult] = useState<{
    tanggal: string;
    rumpon: string;
    items: FishItem[];
    totalBeratKg?: number;
    totalHarga?: number;
    catatan?: string;
    unreadableNotes?: string[];
  } | null>(null);

  // Editable parsed fields
  const [tanggal, setTanggal] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [rumpon, setRumpon] = useState<string>('');
  const [items, setItems] = useState<FishItem[]>([]);
  const [catatan, setCatatan] = useState<string>('');
  const [totalHargaManual, setTotalHargaManual] = useState<string>('');
  const [activeTabPreview, setActiveTabPreview] = useState<'comparison' | 'photo' | 'data'>('comparison');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Detected individual tally weights (per keranjang)
  const [tallyWeights, setTallyWeights] = useState<number[]>([]);
  const [newBasketInput, setNewBasketInput] = useState<string>('');

  // File loading handler
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanError(null);
    setIsHighDemandError(false);
    setScanResult(null);
    setTallyWeights([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setRawPhoto(base64);
      setPhotoRotation(0);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Rotate photo using canvas
  const handleRotate = (deg: number) => {
    if (!rawPhoto) return;
    const newRotation = (photoRotation + deg + 360) % 360;
    setPhotoRotation(newRotation);

    const img = new Image();
    img.src = rawPhoto;
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
      setRawPhoto(rotatedBase64);
    };
  };

  // Perform Offline Scan via Tesseract.js directly on device
  const runOfflineScan = async (photoData: string) => {
    setScanStep('Mempersiapkan mesin pembaca offline (Tesseract OCR)...');
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          const pct = Math.round((m.progress || 0) * 100);
          setScanStep(`Membaca catatan tanpa internet: ${pct}%...`);
        }
      },
    });

    setScanStep('Memindai angka timbangan & teks catatan...');
    const ret = await worker.recognize(photoData);
    await worker.terminate();

    const ocrText = ret.data.text || '';
    const parsed = parseFishTallySheetOffline(ocrText);

    const detectedWeights = parsed.weights;
    setTallyWeights(detectedWeights);

    const mappedItems: FishItem[] = [
      {
        id: `item-${Date.now()}-0`,
        namaIkan: parsed.fishType || 'Tongkol',
        beratKg: parsed.totalKg,
        confidence: detectedWeights.length > 0 ? 'high' : 'uncertain',
        weights: detectedWeights,
      },
    ];

    const detectedTanggal = parsed.tanggal || new Date().toISOString().split('T')[0];
    const detectedRumpon = parsed.rumpon || 'Rumpon Utama';

    setScanResult({
      tanggal: detectedTanggal,
      rumpon: detectedRumpon,
      items: mappedItems,
      catatan: `Scan Offline: Terdeteksi ${detectedWeights.length} keranjang timbangan.`,
      unreadableNotes: parsed.unreadableNotes,
    });

    setTanggal(detectedTanggal);
    setRumpon(detectedRumpon);
    setItems(mappedItems);
    setCatatan(`Scan Offline: Terdeteksi ${detectedWeights.length} keranjang timbangan.`);
    setActiveTabPreview('comparison');
  };

  // Main Scan Trigger (Gemini or Offline based on selected mode)
  const handleProcessScan = async (overrideMode?: 'gemini' | 'offline') => {
    const currentMode = overrideMode || scanMode;

    if (!rawPhoto) {
      setScanError('Silakan ambil foto atau pilih foto dari galeri terlebih dahulu.');
      return;
    }

    setIsScanning(true);
    setScanError(null);
    setIsHighDemandError(false);

    // MODE OFFLINE
    if (currentMode === 'offline') {
      try {
        await runOfflineScan(rawPhoto);
      } catch (offlineErr: unknown) {
        console.error('Offline scan error:', offlineErr);
        const msg = offlineErr instanceof Error ? offlineErr.message : 'Gagal memproses OCR offline.';
        setScanError(`Scan Offline gagal: ${msg}. Anda dapat memasukkan data secara manual.`);
      } finally {
        setIsScanning(false);
        setScanStep('');
      }
      return;
    }

    // MODE GEMINI (ONLINE)
    setScanStep('Menghubungi model AI Gemini...');

    try {
      setScanStep('Menganalisis tulisan tangan catatan hasil ikan...');

      let parsed: {
        tanggal?: string;
        rumpon?: string;
        items?: Array<{ namaIkan?: string; beratKg?: number; hargaPerKg?: number; subtotal?: number; confidence?: string }>;
        totalHarga?: number;
        catatan?: string;
      } = {};

      let success = false;
      let lastErrorMessage = '';

      // 1. Coba lewat backend proxy /api/gemini/scan terlebih dahulu
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (settings.userApiKey?.trim()) {
          headers['x-gemini-api-key'] = settings.userApiKey.trim();
        }

        const res = await fetch('/api/gemini/scan', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            imageBase64: rawPhoto,
            mimeType: 'image/jpeg',
          }),
        });

        if (res.ok) {
          const data = await res.json();
          parsed = data.data || {};
          success = true;
        } else {
          const errData = await res.json().catch(() => ({}));
          lastErrorMessage = errData.error || `Server status ${res.status}`;
          if (res.status === 503 || lastErrorMessage.toLowerCase().includes('high demand') || lastErrorMessage.includes('503')) {
            setIsHighDemandError(true);
          }
        }
      } catch (fetchErr) {
        console.warn('Backend proxy scan tidak terjangkau (kemungkinan berjalan di APK native offline):', fetchErr);
      }

      // 2. Jika backend tidak sukses, coba langsung via GoogleGenAI client (misal di HP dengan user API key)
      if (!success) {
        const clientApiKey = settings.userApiKey?.trim();
        if (!clientApiKey) {
          if (isHighDemandError || lastErrorMessage.toLowerCase().includes('high demand') || lastErrorMessage.includes('503')) {
            setIsHighDemandError(true);
            throw new Error('Model Gemini sedang mengalami lonjakan beban tinggi (High Demand 503). Silakan beralih ke Mode Scan Offline di bawah.');
          }
          throw new Error(
            lastErrorMessage ||
            'Gagal menghubungi server scan AI. Jika menggunakan aplikasi APK di HP Android, silakan gunakan Mode Scan Offline atau masukkan API Key Google Gemini di Pengaturan.'
          );
        }

        setScanStep('Menganalisis langsung via Gemini di HP Android...');
        const cleanBase64 = rawPhoto.replace(/^data:image\/[a-z]+;base64,/, '');
        const ai = new GoogleGenAI({ apiKey: clientApiKey });

        const prompt = `Anda adalah asisten cerdas pembaca catatan hasil tangkapan ikan Indonesia.
Baca foto catatan tulisan tangan ini dan kembalikan HANYA format JSON valid:
{
  "tanggal": "YYYY-MM-DD atau tanggal terbaca",
  "rumpon": "Nama rumpon atau lokasi",
  "items": [
    {
      "namaIkan": "Nama jenis ikan (Tongkol, Layang, Soret, Kunyitan, Katombong, Baga-Baga, Ikan Kuning, Campur, Lainnya, dll)",
      "weights": [71, 72, 69.5, 70, 75],
      "beratKg": 357.5,
      "hargaPerKg": 25000,
      "subtotal": 8937500,
      "confidence": "high"
    }
  ],
  "totalHarga": 8937500,
  "catatan": "Keterangan tambahan"
}
Catatan Sangat Penting: Ekstrak SELURUH angka-angka timbangan yang tertulis di buku per keranjang/box ke dalam array "weights". Hitung "beratKg" dari penjumlahan angka-angka tersebut agar semua angka timbangan dapat dimunculkan di slip!`;

        // Coba model primary 3.8-flash, lalu fallback ke 3.1-flash-lite jika 503/429
        let geminiRes;
        try {
          geminiRes = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: [
              {
                role: 'user',
                parts: [
                  { text: prompt },
                  { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
                  { text: 'Digitalisasi catatan tulisan tangan ikan ini ke JSON.' },
                ],
              },
            ],
            config: { responseMimeType: 'application/json' },
          });
        } catch (directErr: unknown) {
          const errStr = String(directErr);
          if (errStr.includes('503') || errStr.includes('high demand') || errStr.includes('UNAVAILABLE') || errStr.includes('429')) {
            setScanStep('Gemini 3.8 sibuk, mencoba model alternatif Gemini Flash Lite...');
            try {
              geminiRes = await ai.models.generateContent({
                model: 'gemini-3.1-flash-lite',
                contents: [
                  {
                    role: 'user',
                    parts: [
                      { text: prompt },
                      { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
                      { text: 'Digitalisasi catatan tulisan tangan ikan ini ke JSON.' },
                    ],
                  },
                ],
                config: { responseMimeType: 'application/json' },
              });
            } catch (fallbackErr: unknown) {
              setIsHighDemandError(true);
              throw new Error('Layanan Gemini sedang mengalami lonjakan beban tinggi (High Demand 503). Silakan beralih ke Mode Scan Offline.');
            }
          } else {
            throw directErr;
          }
        }

        const text = geminiRes?.text || '{}';
        try {
          parsed = JSON.parse(text);
          success = true;
        } catch {
          const match = text.match(/\{[\s\S]*\}/);
          if (match) {
            parsed = JSON.parse(match[0]);
            success = true;
          } else {
            throw new Error('Gagal mengurai respons AI.');
          }
        }
      }

      // Map parsed items with full weights support
      const mappedItems: FishItem[] = Array.isArray(parsed.items)
        ? parsed.items.map((it: any, idx: number) => {
            let itemWeights: number[] = [];
            if (Array.isArray(it.weights) && it.weights.length > 0) {
              itemWeights = it.weights
                .map((n: any) => Math.round(Number(n) * 10) / 10)
                .filter((n: number) => !isNaN(n) && n > 0);
            } else if (it.beratKg && Number(it.beratKg) > 0) {
              itemWeights = [Math.round(Number(it.beratKg) * 10) / 10];
            }
            const itemTotalKg = itemWeights.length > 0
              ? Math.round(itemWeights.reduce((a, b) => a + b, 0) * 10) / 10
              : (Number(it.beratKg) || 0);

            return {
              id: `item-${Date.now()}-${idx}`,
              namaIkan: it.namaIkan || 'Ikan Campur',
              beratKg: itemTotalKg,
              hargaPerKg: it.hargaPerKg ? Number(it.hargaPerKg) : undefined,
              subtotal: it.subtotal ? Number(it.subtotal) : (it.hargaPerKg ? Math.round(itemTotalKg * Number(it.hargaPerKg)) : undefined),
              confidence: it.confidence === 'uncertain' || it.confidence === 'low' ? 'uncertain' : 'high',
              weights: itemWeights,
            };
          })
        : [];

      // Collect detected weights into tallyWeights if any
      const allDetectedWeights = mappedItems.flatMap((it) => it.weights || []);
      if (allDetectedWeights.length > 0) {
        setTallyWeights(allDetectedWeights);
      }

      setScanResult({
        tanggal: parsed.tanggal && parsed.tanggal.length >= 8 ? parsed.tanggal : new Date().toISOString().split('T')[0],
        rumpon: parsed.rumpon || '',
        items: mappedItems,
        totalHarga: parsed.totalHarga,
        catatan: parsed.catatan || '',
      });
      setTanggal(parsed.tanggal && parsed.tanggal.length >= 8 ? parsed.tanggal : new Date().toISOString().split('T')[0]);
      setRumpon(parsed.rumpon || '');
      setItems(mappedItems);
      setCatatan(parsed.catatan || '');
      if (parsed.totalHarga) {
        setTotalHargaManual(String(parsed.totalHarga));
      }

      setActiveTabPreview('comparison');
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan saat memproses scan AI.';
      setScanError(msg);
      if (msg.toLowerCase().includes('high demand') || msg.includes('503') || msg.includes('UNAVAILABLE')) {
        setIsHighDemandError(true);
      }
    } finally {
      setIsScanning(false);
      setScanStep('');
    }
  };

  // Switch to offline mode and run immediately
  const handleSwitchToOfflineAndScan = () => {
    setScanMode('offline');
    setScanError(null);
    setIsHighDemandError(false);
    handleProcessScan('offline');
  };

  // Add individual basket weight manually or edit
  const handleAddBasketWeight = () => {
    const val = parseFloat(newBasketInput);
    if (!val || val <= 0) return;

    const nextWeights = [...tallyWeights, Math.round(val * 10) / 10];
    setTallyWeights(nextWeights);
    setNewBasketInput('');

    // Update item weight and weights array
    const newTotal = Math.round(nextWeights.reduce((a, b) => a + b, 0) * 10) / 10;
    if (items.length > 0) {
      const nextItems = [...items];
      nextItems[0] = {
        ...nextItems[0],
        weights: nextWeights,
        beratKg: newTotal,
        subtotal: nextItems[0].hargaPerKg ? Math.round(newTotal * nextItems[0].hargaPerKg) : undefined,
      };
      setItems(nextItems);
    }
  };

  const handleRemoveBasketWeight = (idx: number) => {
    const nextWeights = tallyWeights.filter((_, i) => i !== idx);
    setTallyWeights(nextWeights);
    const newTotal = Math.round(nextWeights.reduce((a, b) => a + b, 0) * 10) / 10;
    if (items.length > 0) {
      const nextItems = [...items];
      nextItems[0] = {
        ...nextItems[0],
        weights: nextWeights,
        beratKg: newTotal,
        subtotal: nextItems[0].hargaPerKg ? Math.round(newTotal * nextItems[0].hargaPerKg) : undefined,
      };
      setItems(nextItems);
    }
  };

  // Fish row management
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

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        namaIkan: 'Cakalang',
        beratKg: 0,
        confidence: 'high',
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Dynamic calculations
  const totalBerat = calculateTotalKg(items);
  const itemsSubtotal = items.reduce((acc, it) => acc + (it.subtotal || 0), 0);
  const effectiveTotalHarga = totalHargaManual ? Number(totalHargaManual) || 0 : itemsSubtotal;
  const calc = calculateBookkeeping(totalBerat, effectiveTotalHarga, undefined, settings);

  // Save Bookkeeping Record
  const handleSaveBookkeeping = async () => {
    if (items.length === 0) {
      setScanError('Tambahkan minimal satu jenis ikan sebelum menyimpan.');
      return;
    }

    setIsSaving(true);
    setScanError(null);

    try {
      const recordId = `rec-${Date.now()}`;
      const newRecord: BookkeepingRecord = {
        id: recordId,
        tanggal: tanggal || new Date().toISOString().split('T')[0],
        rumpon: rumpon.trim() || 'Rumpon Utama',
        items,
        totalBeratKg: calc.totalBeratKg,
        totalTonase: calc.totalTonase,
        totalHarga: calc.totalHargaIkan,
        totalHargaIsManual: Boolean(totalHargaManual),

        biayaPemikul: calc.biayaPemikul,
        biayaPemikulIsManual: false,

        biayaAbk: calc.biayaAbk,
        biayaAbkIsManual: false,

        biayaBongkar: calc.biayaBongkar,
        biayaBongkarIsManual: false,

        biayaNyelam: calc.biayaNyelam,
        biayaNyelamIsManual: false,

        totalBiaya: calc.totalBiaya,
        bersih: calc.bersih,

        pembagianRumpon: calc.pembagianRumpon,
        pembagianKapal: calc.pembagianKapal,

        keterangan: catatan,
        unreadableNotes: scanResult?.unreadableNotes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await onSaveRecord(newRecord, rawPhoto || undefined);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal menyimpan pembukuan';
      setScanError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-24">
      {/* Hidden inputs for camera capture & gallery */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Header Info */}
      <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Scan Buku Catatan Ikan</h2>
            <p className="text-xs text-slate-400">
              Pindai foto buku catatan tulisan tangan hasil tangkapan nelayan dengan Mode AI Gemini atau Mode Offline.
            </p>
          </div>
        </div>
      </div>

      {/* Mode Switcher: AI Gemini vs Offline */}
      <div className="p-2 rounded-2xl bg-slate-900/95 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Pilih Mode Pemindaian:
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${scanMode === 'offline' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
            {scanMode === 'offline' ? 'Bebas Kuota / Anti Error' : 'Kecerdasan Cloud AI'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setScanMode('gemini');
              setScanError(null);
              setIsHighDemandError(false);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition-all ${
              scanMode === 'gemini'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/60'
            }`}
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>Mode AI Gemini</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setScanMode('offline');
              setScanError(null);
              setIsHighDemandError(false);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition-all ${
              scanMode === 'offline'
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/60'
            }`}
          >
            <Zap className="w-4 h-4 shrink-0 text-yellow-400" />
            <span>Mode Offline</span>
          </button>
        </div>

        <p className="text-[11px] text-slate-400 px-1 leading-relaxed">
          {scanMode === 'offline'
            ? '⚡ Mode Offline: Memindai langsung di HP Anda tanpa server/kuota internet. Sangat lancar, anti-gangguan, dan bebas error 503 saat traffic Gemini padat.'
            : '✨ Mode AI Gemini: Membaca tulisan tangan, tabel angka, dan rincian jenis ikan lengkap secara otomatis via model AI.'}
        </p>
      </div>

      {/* Photo Picker & Camera Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => cameraInputRef.current?.click()}
          className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/10 active:scale-95 transition-all"
        >
          <Camera className="w-4 h-4 stroke-[2.5]" />
          <span>AMBIL FOTO (KAMERA)</span>
        </button>
        <button
          onClick={() => galleryInputRef.current?.click()}
          className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 font-bold text-xs active:scale-95 transition-all"
        >
          <ImageIcon className="w-4 h-4 text-amber-400" />
          <span>PILIH DARI GALERI</span>
        </button>
      </div>

      {/* Photo Preview & Manipulation Card */}
      {rawPhoto ? (
        <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">Pratinjau Foto Buku Catatan</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleRotate(-90)}
                className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-amber-400 transition-colors"
                title="Putar Kiri 90°"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleRotate(90)}
                className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-amber-400 transition-colors"
                title="Putar Kanan 90°"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setRawPhoto(null);
                  setScanResult(null);
                  setTallyWeights([]);
                }}
                className="p-2 rounded-xl bg-red-950/60 border border-red-900/50 text-red-300 hover:text-red-200 transition-colors"
                title="Hapus Foto"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 max-h-72 flex items-center justify-center">
            <img
              src={rawPhoto}
              alt="Foto Catatan Ikan"
              className="max-h-72 w-full object-contain"
            />
          </div>

          {/* Trigger Scan Button */}
          {!scanResult && (
            <button
              onClick={() => handleProcessScan()}
              disabled={isScanning}
              className={`w-full py-3.5 px-4 rounded-2xl ${
                scanMode === 'offline'
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950'
              } font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 active:scale-95 disabled:opacity-50 transition-all`}
            >
              {isScanning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>{scanStep || 'Memproses Scan...'}</span>
                </>
              ) : (
                <>
                  {scanMode === 'offline' ? (
                    <Zap className="w-4 h-4 fill-slate-950" />
                  ) : (
                    <Sparkles className="w-4 h-4 fill-slate-950" />
                  )}
                  <span>{scanMode === 'offline' ? 'PROSES SCAN OFFLINE' : 'PROSES SCAN AI GEMINI'}</span>
                </>
              )}
            </button>
          )}
        </div>
      ) : (
        <div className="p-8 rounded-3xl bg-slate-900/50 border border-dashed border-slate-800 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-slate-800/80 flex items-center justify-center mx-auto text-amber-400">
            <Camera className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-300">Belum ada foto yang dipilih</p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Gunakan kamera untuk mengambil gambar buku catatan tulisan tangan atau unggah foto dari galeri HP Anda.
            </p>
          </div>
        </div>
      )}

      {/* Error Banner with Offline Quick Switch */}
      {scanError && (
        <div className="p-4 rounded-2xl bg-red-950/80 border border-red-800/80 space-y-2.5 text-xs text-red-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-red-300">Peringatan Scan</p>
              <p className="mt-0.5 leading-relaxed">{scanError}</p>
            </div>
          </div>

          {(isHighDemandError || scanMode === 'gemini') && rawPhoto && (
            <div className="pt-2 border-t border-red-900/60 flex items-center justify-between">
              <span className="text-[11px] text-amber-200">
                Solusi Cepat: Beralih ke Scan Offline tanpa server
              </span>
              <button
                type="button"
                onClick={handleSwitchToOfflineAndScan}
                className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black text-[11px] flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
              >
                <Zap className="w-3.5 h-3.5 fill-slate-950" />
                <span>Pindai Offline Sekarang</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Scan Results & Comparison Area */}
      {scanResult && (
        <div className="space-y-4">
          {/* Header tabs for visual comparison */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-800">
              <button
                onClick={() => setActiveTabPreview('comparison')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTabPreview === 'comparison'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Bandingkan
              </button>
              <button
                onClick={() => setActiveTabPreview('data')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTabPreview === 'data'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Data Digital
              </button>
              <button
                onClick={() => setActiveTabPreview('photo')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTabPreview === 'photo'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Foto Asli
              </button>
            </div>

            <button
              onClick={() => handleProcessScan()}
              disabled={isScanning}
              className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>ULANGI SCAN</span>
            </button>
          </div>

          {/* Unreadable / Warning items if any */}
          {scanResult.unreadableNotes && scanResult.unreadableNotes.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-200 space-y-1">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Perlu Diperiksa (Tulisan Samar / Angka Manual)</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-slate-300 pl-1 text-[11px]">
                {scanResult.unreadableNotes.map((n, idx) => (
                  <li key={idx}>{n}</li>
                ))}
              </ul>
            </div>
          )}

          {/* View Modes */}
          {activeTabPreview === 'photo' && rawPhoto && (
            <div className="rounded-3xl bg-slate-900 border border-slate-800 p-3 overflow-hidden">
              <img
                src={rawPhoto}
                alt="Foto Asli"
                className="w-full max-h-[450px] object-contain rounded-2xl"
              />
            </div>
          )}

          {(activeTabPreview === 'comparison' || activeTabPreview === 'data') && (
            <div className="space-y-4">
              {/* If comparison, show side-by-side or mini photo strip */}
              {activeTabPreview === 'comparison' && rawPhoto && (
                <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
                  <img
                    src={rawPhoto}
                    alt="Foto Asli Mini"
                    className="w-20 h-20 object-cover rounded-xl border border-slate-700 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-200">Perbandingan Visual Aktif</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Periksa apakah angka dan jenis ikan di bawah ini cocok dengan foto buku asli Anda.
                    </p>
                  </div>
                </div>
              )}

              {/* Form Metadata: Tanggal & Rumpon */}
              <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Tanggal
                    </label>
                    <input
                      type="date"
                      value={tanggal}
                      onChange={(e) => setTanggal(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Nama Rumpon / Lokasi
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Rumpon 03"
                      value={rumpon}
                      onChange={(e) => setRumpon(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Tally Basket Inspector (Interactive individual basket weights) */}
              {tallyWeights.length > 0 && (
                <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Scale className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-slate-200">
                        Keranjang Timbangan ({tallyWeights.length} Keranjang)
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      Total: {formatKg(tallyWeights.reduce((a, b) => a + b, 0))} ({formatTon(tallyWeights.reduce((a, b) => a + b, 0) / 1000)})
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1 bg-slate-950/80 rounded-2xl border border-slate-800/80">
                    {tallyWeights.map((w, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800/90 border border-slate-700/80 text-xs font-mono text-slate-200 shadow-sm"
                      >
                        <span className="text-[10px] text-slate-400">#{idx + 1}:</span>
                        <strong className="text-emerald-300 font-bold">{w} kg</strong>
                        <button
                          type="button"
                          onClick={() => handleRemoveBasketWeight(idx)}
                          className="text-slate-400 hover:text-red-400 ml-0.5 p-0.5 rounded"
                          title="Hapus keranjang ini"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>

                  {/* Add missing basket */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="number"
                      placeholder="Tambah berat keranjang (kg)..."
                      value={newBasketInput}
                      onChange={(e) => setNewBasketInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddBasketWeight()}
                      className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-amber-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddBasketWeight}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold text-xs flex items-center gap-1 border border-slate-700 active:scale-95 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-400" />
                      <span>Tambah Keranjang</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Fish Items Table */}
              <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">Daftar Jenis Ikan</span>
                  <button
                    onClick={handleAddItem}
                    className="flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Baris</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-2xl bg-slate-950/80 border ${
                        item.confidence === 'uncertain'
                          ? 'border-amber-500/50 bg-amber-950/10'
                          : 'border-slate-800/80'
                      } space-y-2`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <span className="text-xs font-mono font-bold text-amber-400">
                            #{idx + 1}
                          </span>
                          <input
                            type="text"
                            value={item.namaIkan}
                            onChange={(e) => handleUpdateItem(idx, 'namaIkan', e.target.value)}
                            className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 text-xs font-semibold focus:border-amber-500 focus:outline-none"
                          />
                        </div>

                        {item.confidence === 'uncertain' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 whitespace-nowrap">
                            Perlu Periksa
                          </span>
                        )}

                        <button
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 rounded-lg text-slate-500 hover:text-red-400"
                          title="Hapus baris ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">Berat (kg)</label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.beratKg || ''}
                            onChange={(e) =>
                              handleUpdateItem(idx, 'beratKg', parseFloat(e.target.value) || 0)
                            }
                            className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 text-xs font-mono focus:border-amber-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">Harga / kg (Rp)</label>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            placeholder="Opsional"
                            value={item.hargaPerKg || ''}
                            onChange={(e) =>
                              handleUpdateItem(idx, 'hargaPerKg', parseFloat(e.target.value) || 0)
                            }
                            className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 text-xs font-mono focus:border-amber-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">Subtotal (Rp)</label>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={item.subtotal || ''}
                            onChange={(e) =>
                              handleUpdateItem(idx, 'subtotal', parseFloat(e.target.value) || 0)
                            }
                            className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 text-xs font-mono focus:border-amber-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total Berat & Total Harga summary row */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400">Total Berat: </span>
                    <strong className="text-sky-300 font-mono">
                      {formatKg(calc.totalBeratKg)} ({formatTon(calc.totalTonase)})
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Total Harga: </span>
                    <strong className="text-emerald-400 font-mono">
                      {formatRupiah(calc.totalHargaIkan)}
                    </strong>
                  </div>
                </div>

                {/* Direct Total Harga override if notebook only writes total */}
                <div className="pt-1">
                  <label className="block text-[10px] text-slate-400 mb-1">
                    Atau isi Total Nilai Ikan Langsung (jika harga satuan tidak tertulis di buku):
                  </label>
                  <input
                    type="number"
                    placeholder="Contoh: 100000000"
                    value={totalHargaManual}
                    onChange={(e) => setTotalHargaManual(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Automatic Calculated Costs Breakdown Preview */}
              <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-2.5">
                <span className="text-xs font-bold text-slate-200">
                  Estimasi Potongan & Biaya Otomatis
                </span>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <div>
                      <span className="font-semibold text-slate-300">Pemikul</span>
                      <span className="text-[10px] text-slate-500 ml-1.5">
                        (Rp300.000 / 1.000 kg)
                      </span>
                    </div>
                    <span className="font-bold text-slate-200 tabular-nums">
                      {formatRupiah(calc.biayaPemikul)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <div>
                      <span className="font-semibold text-slate-300">ABK (Estimasi)</span>
                      <span className="text-[10px] text-slate-500 ml-1.5">
                        (Rp1.000.000 / Rp20 Jt)
                      </span>
                    </div>
                    <span className="font-bold text-slate-200 tabular-nums">
                      {formatRupiah(calc.biayaAbk)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <div>
                      <span className="font-semibold text-slate-300">Bongkar (Estimasi)</span>
                      <span className="text-[10px] text-slate-500 ml-1.5">
                        (&lt;1t Rp0, 1t Rp1,4 Jt, +Rp700rb/kelipatan ton)
                      </span>
                    </div>
                    <span className="font-bold text-slate-200 tabular-nums">
                      {formatRupiah(calc.biayaBongkar)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <div>
                      <span className="font-semibold text-slate-300">Nyelam (Estimasi)</span>
                      <span className="text-[10px] text-slate-500 ml-1.5">
                        (&ge;2t: Rp600rb + Rp600rb/t)
                      </span>
                    </div>
                    <span className="font-bold text-slate-200 tabular-nums">
                      {formatRupiah(calc.biayaNyelam)}
                    </span>
                  </div>
                </div>

                {/* Final Bersih Banner */}
                <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/20 to-amber-500/5 border border-amber-500/40 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider block">
                      Hasil Bersih
                    </span>
                    <span className="text-[11px] text-slate-400">Total Harga - Semua Biaya</span>
                  </div>
                  <span className="text-xl font-black text-amber-400 tabular-nums">
                    {formatRupiah(calc.bersih)}
                  </span>
                </div>

                {/* Pembagian Baru: Rumpon 1 Bagian & Kapal 2 Bagian */}
                <div className="p-3 rounded-2xl bg-slate-950/90 border border-amber-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                      ⚖️ Pembagian Bersih (Dibagi 3 Bagian)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                      Rumpon 1 : Kapal 2
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-amber-500/30">
                      <span className="text-[10px] text-amber-300/80 block font-bold uppercase">
                        Rumpon (1 Bagian)
                      </span>
                      <span className="text-base font-black text-amber-400 font-mono tabular-nums block mt-0.5">
                        {formatRupiah(calc.pembagianRumpon)}
                      </span>
                      <span className="text-[9px] text-slate-500">1/3 hasil bersih</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-emerald-500/30">
                      <span className="text-[10px] text-emerald-300/80 block font-bold uppercase">
                        Kapal (2 Bagian)
                      </span>
                      <span className="text-base font-black text-emerald-400 font-mono tabular-nums block mt-0.5">
                        {formatRupiah(calc.pembagianKapal)}
                      </span>
                      <span className="text-[9px] text-slate-500">2/3 hasil bersih</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Edit in full form or Save */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() =>
                    onEditInForm(
                      {
                        tanggal,
                        rumpon,
                        items,
                        totalHarga: effectiveTotalHarga,
                        totalHargaIsManual: Boolean(totalHargaManual),
                        keterangan: catatan,
                      },
                      rawPhoto || undefined
                    )
                  }
                  className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                >
                  <Edit3 className="w-4 h-4 text-amber-400" />
                  <span>EDIT HASIL LENGKAP</span>
                </button>

                <button
                  onClick={handleSaveBookkeeping}
                  disabled={isSaving}
                  className="py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 active:scale-95 disabled:opacity-50 transition-all"
                >
                  {isSaving ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  ) : saveSuccess ? (
                    <CheckCircle2 className="w-4 h-4 text-slate-950" />
                  ) : (
                    <Save className="w-4 h-4 fill-slate-950" />
                  )}
                  <span>{saveSuccess ? 'TERSIPAN!' : 'SIMPAN PEMBUKUAN'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
