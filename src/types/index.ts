export interface FishItem {
  id: string;
  namaIkan: string;
  beratKg: number;
  hargaPerKg?: number;
  subtotal?: number;
  confidence?: 'high' | 'low' | 'uncertain';
}

export interface BookkeepingRecord {
  id: string;
  tanggal: string; // YYYY-MM-DD
  rumpon: string;
  items: FishItem[];
  totalBeratKg: number;
  totalTonase: number; // totalBeratKg / 1000
  totalHarga: number;
  totalHargaIsManual?: boolean;

  // Biaya-biaya
  biayaPemikul: number;
  biayaPemikulIsManual: boolean;

  biayaAbk: number;
  biayaAbkIsManual: boolean;

  biayaBongkar: number;
  biayaBongkarIsManual: boolean;

  biayaNyelam: number;
  biayaNyelamIsManual: boolean;

  totalBiaya: number;
  bersih: number;

  keterangan: string;
  fotoAsliId?: string; // ID reference in indexedDB foto store
  fotoAsliBase64?: string; // Optional cached base64 or objectUrl
  
  unreadableNotes?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  appName: string;
  reportTitle: string;
  ownerName: string;

  // Rumus Pemikul
  tarifPemikulPer1000Kg: number; // default: 300,000

  // Rumus Bongkar
  bongkarTarifDasar: number; // default: 1,400,000
  bongkarKenaikanPerTon: number; // default: 700,000
  bongkarBatasTon: number; // default: 2

  // Rumus Nyelam
  nyelamBatasMinimumTon: number; // default: 2
  nyelamPengurangTon: number; // default: 1
  nyelamTarifKenaikan: number; // default: 600,000

  // Rumus ABK
  abkKelipatanNilai: number; // default: 20,000,000
  abkTarifDasar: number; // default: 1,000,000
  abkMetode: 'proporsional' | 'kelipatan_penuh'; // default: 'proporsional'

  // Teks & Laporan
  teksCatatanOtomatis: string;
  linkDownloadAplikasi: string;

  // Media Sosial
  mediaSosial: {
    tiktok: string;
    facebook: string;
    instagram: string;
    linkLain: string;
  };

  // Konfigurasi Gemini API pribadi jika diperlukan di APK
  userApiKey: string;

  // Preferensi
  sertakanFotoLaporan: boolean;
  satuanBeratDefault: 'kg' | 'ton';
}

export interface CalculationResult {
  totalBeratKg: number;
  totalTonase: number;
  totalHargaIkan: number;
  biayaPemikul: number;
  biayaAbk: number;
  biayaBongkar: number;
  biayaNyelam: number;
  totalBiaya: number;
  bersih: number;
  isNegativeNet: boolean;
}
