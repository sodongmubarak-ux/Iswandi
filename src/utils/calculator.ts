import { AppSettings, CalculationResult, FishItem } from '../types';

export const DEFAULT_SETTINGS: AppSettings = {
  appName: 'CATATAN BY ISWANDI',
  reportTitle: 'CATATAN BY ISWANDI',
  ownerName: 'Iswandi',

  // Rumus Pemikul: Setiap 1.000 kg = Rp300.000
  tarifPemikulPer1000Kg: 300000,

  // Rumus Bongkar:
  // <= 2 ton = Rp1.400.000
  // > 2 ton = Rp1.400.000 + ((Tonase - 2) * Rp700.000)
  bongkarTarifDasar: 1400000,
  bongkarKenaikanPerTon: 700000,
  bongkarBatasTon: 2,

  // Rumus Nyelam:
  // < 2 ton = Rp0
  // >= 2 ton = (Tonase - 1) * Rp600.000
  nyelamBatasMinimumTon: 2,
  nyelamPengurangTon: 1,
  nyelamTarifKenaikan: 600000,

  // Rumus ABK:
  // Setiap Rp20.000.000 total harga ikan menghasilkan estimasi ABK Rp1.000.000
  abkKelipatanNilai: 20000000,
  abkTarifDasar: 1000000,
  abkMetode: 'proporsional',

  teksCatatanOtomatis:
    'Ini hanya estimasi digital dan bisa saja ada kesalahan karena dilakukan secara otomatis. Apabila ingin mencoba aplikasi buatan saya, silakan download: [LINK DOWNLOAD APLIKASI]',
  linkDownloadAplikasi: '',

  mediaSosial: {
    tiktok: '',
    facebook: '',
    instagram: '',
    linkLain: '',
  },

  userApiKey: '',
  sertakanFotoLaporan: true,
  satuanBeratDefault: 'kg',
};

/**
 * Format number into Indonesian Rupiah (e.g. Rp 1.500.000)
 */
export function formatRupiah(value: number): string {
  if (isNaN(value) || value === null || value === undefined) return 'Rp 0';
  const isNegative = value < 0;
  const absValue = Math.round(Math.abs(value));
  const formatted = absValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return isNegative ? `-Rp ${formatted}` : `Rp ${formatted}`;
}

/**
 * Format weight in kilograms or tons with clear decimal precision
 */
export function formatKg(value: number): string {
  if (isNaN(value) || value === null || value === undefined) return '0 kg';
  const formatted = Number(value.toFixed(2)).toLocaleString('id-ID');
  return `${formatted} kg`;
}

export function formatTon(value: number): string {
  if (isNaN(value) || value === null || value === undefined) return '0 Ton';
  const formatted = Number(value.toFixed(3)).toLocaleString('id-ID');
  return `${formatted} Ton`;
}

/**
 * Calculate total kilograms from fish items
 */
export function calculateTotalKg(items: FishItem[]): number {
  return items.reduce((acc, item) => acc + (Number(item.beratKg) || 0), 0);
}

/**
 * Calculate total revenue from fish items (if item prices are provided)
 */
export function calculateItemsRevenue(items: FishItem[]): number {
  return items.reduce((acc, item) => {
    if (item.subtotal !== undefined && item.subtotal !== null && item.subtotal > 0) {
      return acc + item.subtotal;
    }
    if (item.hargaPerKg && item.hargaPerKg > 0 && item.beratKg > 0) {
      return acc + item.beratKg * item.hargaPerKg;
    }
    return acc;
  }, 0);
}

/**
 * Rumus Pemikul:
 * Pemikul = (Total berat ikan dalam kg / 1.000) * 300.000
 */
export function calculatePemikul(totalBeratKg: number, tarifPer1000Kg = 300000): number {
  if (totalBeratKg <= 0) return 0;
  return (totalBeratKg / 1000) * tarifPer1000Kg;
}

/**
 * Rumus ABK (Estimasi):
 * Metode Proporsional: ABK = (Total harga / 20.000.000) * 1.000.000
 * Metode Kelipatan Penuh: ABK = Math.floor(Total harga / 20.000.000) * 1.000.000
 */
export function calculateAbk(
  totalHarga: number,
  kelipatanNilai = 20000000,
  tarifDasar = 1000000,
  metode: 'proporsional' | 'kelipatan_penuh' = 'proporsional'
): number {
  if (totalHarga <= 0 || kelipatanNilai <= 0) return 0;
  if (metode === 'kelipatan_penuh') {
    return Math.floor(totalHarga / kelipatanNilai) * tarifDasar;
  }
  return (totalHarga / kelipatanNilai) * tarifDasar;
}

/**
 * Rumus Bongkar (Estimasi):
 * Jika tonase == 0 -> Bongkar = 0
 * Jika tonase > 0 dan tonase <= 2 -> Bongkar = Rp1.400.000
 * Jika tonase > 2 -> Bongkar = Rp1.400.000 + ((Tonase - 2) * Rp700.000)
 */
export function calculateBongkar(
  tonase: number,
  tarifDasar = 1400000,
  kenaikanPerTon = 700000,
  batasTon = 2
): number {
  if (tonase <= 0) return 0;
  if (tonase <= batasTon) {
    return tarifDasar;
  }
  return tarifDasar + (tonase - batasTon) * kenaikanPerTon;
}

/**
 * Rumus Nyelam (Estimasi):
 * Jika tonase < 2 -> Nyelam = Rp0
 * Jika tonase >= 2 -> Nyelam = (Tonase - 1) * Rp600.000
 */
export function calculateNyelam(
  tonase: number,
  batasMinimumTon = 2,
  pengurangTon = 1,
  tarifKenaikan = 600000
): number {
  if (tonase < batasMinimumTon) return 0;
  return (tonase - pengurangTon) * tarifKenaikan;
}

/**
 * Calculate all components with support for manual overrides
 */
export function calculateBookkeeping(
  totalBeratKg: number,
  rawTotalHarga: number,
  overrides?: {
    totalHargaIsManual?: boolean;
    manualTotalHarga?: number;
    pemikulIsManual?: boolean;
    manualPemikul?: number;
    abkIsManual?: boolean;
    manualAbk?: number;
    bongkarIsManual?: boolean;
    manualBongkar?: number;
    nyelamIsManual?: boolean;
    manualNyelam?: number;
  },
  settings: AppSettings = DEFAULT_SETTINGS
): CalculationResult {
  const tonase = totalBeratKg / 1000;

  // Total Harga
  const totalHargaIkan =
    overrides?.totalHargaIsManual && overrides?.manualTotalHarga !== undefined
      ? overrides.manualTotalHarga
      : rawTotalHarga;

  // Pemikul
  const biayaPemikul =
    overrides?.pemikulIsManual && overrides?.manualPemikul !== undefined
      ? overrides.manualPemikul
      : calculatePemikul(totalBeratKg, settings.tarifPemikulPer1000Kg);

  // ABK
  const biayaAbk =
    overrides?.abkIsManual && overrides?.manualAbk !== undefined
      ? overrides.manualAbk
      : calculateAbk(
          totalHargaIkan,
          settings.abkKelipatanNilai,
          settings.abkTarifDasar,
          settings.abkMetode
        );

  // Bongkar
  const biayaBongkar =
    overrides?.bongkarIsManual && overrides?.manualBongkar !== undefined
      ? overrides.manualBongkar
      : calculateBongkar(
          tonase,
          settings.bongkarTarifDasar,
          settings.bongkarKenaikanPerTon,
          settings.bongkarBatasTon
        );

  // Nyelam
  const biayaNyelam =
    overrides?.nyelamIsManual && overrides?.manualNyelam !== undefined
      ? overrides.manualNyelam
      : calculateNyelam(
          tonase,
          settings.nyelamBatasMinimumTon,
          settings.nyelamPengurangTon,
          settings.nyelamTarifKenaikan
        );

  const totalBiaya = biayaPemikul + biayaAbk + biayaBongkar + biayaNyelam;
  const bersih = totalHargaIkan - totalBiaya;

  return {
    totalBeratKg,
    totalTonase: tonase,
    totalHargaIkan,
    biayaPemikul,
    biayaAbk,
    biayaBongkar,
    biayaNyelam,
    totalBiaya,
    bersih,
    isNegativeNet: bersih < 0,
  };
}

/**
 * MANDATORY FORMULA VERIFICATION TEST SUITE
 * Directly validates all rules defined in section 19 of user prompt.
 */
export interface TestVerificationResult {
  title: string;
  category: 'pemikul' | 'bongkar' | 'nyelam' | 'abk' | 'bersih';
  inputDesc: string;
  expected: number;
  actual: number;
  passed: boolean;
}

export function runFormulaVerificationTests(): {
  allPassed: boolean;
  results: TestVerificationResult[];
} {
  const results: TestVerificationResult[] = [];

  // Uji Pemikul:
  // 1.000 kg = Rp300.000
  const p1 = calculatePemikul(1000);
  results.push({
    title: 'Uji Pemikul 1.000 kg',
    category: 'pemikul',
    inputDesc: '1.000 kg',
    expected: 300000,
    actual: p1,
    passed: p1 === 300000,
  });

  // 2.500 kg = Rp750.000
  const p2 = calculatePemikul(2500);
  results.push({
    title: 'Uji Pemikul 2.500 kg',
    category: 'pemikul',
    inputDesc: '2.500 kg',
    expected: 750000,
    actual: p2,
    passed: p2 === 750000,
  });

  // Uji Bongkar:
  // 1 ton = Rp1.400.000
  const b1 = calculateBongkar(1);
  results.push({
    title: 'Uji Bongkar 1 ton',
    category: 'bongkar',
    inputDesc: '1 ton',
    expected: 1400000,
    actual: b1,
    passed: b1 === 1400000,
  });

  // 2 ton = Rp1.400.000
  const b2 = calculateBongkar(2);
  results.push({
    title: 'Uji Bongkar 2 ton',
    category: 'bongkar',
    inputDesc: '2 ton',
    expected: 1400000,
    actual: b2,
    passed: b2 === 1400000,
  });

  // 2,5 ton = Rp1.750.000
  const b25 = calculateBongkar(2.5);
  results.push({
    title: 'Uji Bongkar 2,5 ton',
    category: 'bongkar',
    inputDesc: '2,5 ton',
    expected: 1750000,
    actual: b25,
    passed: b25 === 1750000,
  });

  // 3 ton = Rp2.100.000
  const b3 = calculateBongkar(3);
  results.push({
    title: 'Uji Bongkar 3 ton',
    category: 'bongkar',
    inputDesc: '3 ton',
    expected: 2100000,
    actual: b3,
    passed: b3 === 2100000,
  });

  // 4 ton = Rp2.800.000
  const b4 = calculateBongkar(4);
  results.push({
    title: 'Uji Bongkar 4 ton',
    category: 'bongkar',
    inputDesc: '4 ton',
    expected: 2800000,
    actual: b4,
    passed: b4 === 2800000,
  });

  // 5 ton = Rp3.500.000
  const b5 = calculateBongkar(5);
  results.push({
    title: 'Uji Bongkar 5 ton',
    category: 'bongkar',
    inputDesc: '5 ton',
    expected: 3500000,
    actual: b5,
    passed: b5 === 3500000,
  });

  // Uji Nyelam:
  // 1 ton = Rp0
  const n1 = calculateNyelam(1);
  results.push({
    title: 'Uji Nyelam 1 ton',
    category: 'nyelam',
    inputDesc: '1 ton',
    expected: 0,
    actual: n1,
    passed: n1 === 0,
  });

  // 1,5 ton = Rp0
  const n15 = calculateNyelam(1.5);
  results.push({
    title: 'Uji Nyelam 1,5 ton',
    category: 'nyelam',
    inputDesc: '1,5 ton',
    expected: 0,
    actual: n15,
    passed: n15 === 0,
  });

  // 2 ton = Rp600.000
  const n2 = calculateNyelam(2);
  results.push({
    title: 'Uji Nyelam 2 ton',
    category: 'nyelam',
    inputDesc: '2 ton',
    expected: 600000,
    actual: n2,
    passed: n2 === 600000,
  });

  // 2,5 ton = Rp900.000
  const n25 = calculateNyelam(2.5);
  results.push({
    title: 'Uji Nyelam 2,5 ton',
    category: 'nyelam',
    inputDesc: '2,5 ton',
    expected: 900000,
    actual: n25,
    passed: n25 === 900000,
  });

  // 3 ton = Rp1.200.000
  const n3 = calculateNyelam(3);
  results.push({
    title: 'Uji Nyelam 3 ton',
    category: 'nyelam',
    inputDesc: '3 ton',
    expected: 1200000,
    actual: n3,
    passed: n3 === 1200000,
  });

  // 4 ton = Rp1.800.000
  const n4 = calculateNyelam(4);
  results.push({
    title: 'Uji Nyelam 4 ton',
    category: 'nyelam',
    inputDesc: '4 ton',
    expected: 1800000,
    actual: n4,
    passed: n4 === 1800000,
  });

  // 5 ton = Rp2.400.000
  const n5 = calculateNyelam(5);
  results.push({
    title: 'Uji Nyelam 5 ton',
    category: 'nyelam',
    inputDesc: '5 ton',
    expected: 2400000,
    actual: n5,
    passed: n5 === 2400000,
  });

  // Uji ABK Proporsional:
  // Rp20.000.000 = Rp1.000.000
  const a1 = calculateAbk(20000000, 20000000, 1000000, 'proporsional');
  results.push({
    title: 'Uji ABK Proporsional Rp20.000.000',
    category: 'abk',
    inputDesc: 'Rp 20.000.000',
    expected: 1000000,
    actual: a1,
    passed: a1 === 1000000,
  });

  // Rp30.000.000 = Rp1.500.000
  const a2 = calculateAbk(30000000, 20000000, 1000000, 'proporsional');
  results.push({
    title: 'Uji ABK Proporsional Rp30.000.000',
    category: 'abk',
    inputDesc: 'Rp 30.000.000',
    expected: 1500000,
    actual: a2,
    passed: a2 === 1500000,
  });

  // Uji Bersih Total:
  // Simulasi 2,5 ton (2.500 kg), total harga Rp100.000.000:
  // Pemikul = Rp750.000
  // ABK = Rp5.000.000
  // Bongkar = Rp1.750.000
  // Nyelam = Rp900.000
  // Bersih = Rp91.600.000
  const fullSim = calculateBookkeeping(2500, 100000000);
  const bersihPassed =
    fullSim.biayaPemikul === 750000 &&
    fullSim.biayaAbk === 5000000 &&
    fullSim.biayaBongkar === 1750000 &&
    fullSim.biayaNyelam === 900000 &&
    fullSim.bersih === 91600000;

  results.push({
    title: 'Uji Total Bersih Simulasi 2,5 Ton (Rp100.000.000)',
    category: 'bersih',
    inputDesc: '2.500 kg & Rp 100.000.000',
    expected: 91600000,
    actual: fullSim.bersih,
    passed: bersihPassed,
  });

  const allPassed = results.every((r) => r.passed);
  return { allPassed, results };
}
