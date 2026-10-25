/**
 * Parser pintar untuk membaca catatan tally timbangan ikan hasil tangkapan
 * Mendeteksi jenis ikan, nama rumpon/kapal, tanggal, dan deretan timbangan keranjang (kg).
 */

export interface ParsedFishTally {
  tanggal?: string;
  rumpon?: string;
  fishType: string;
  weights: number[];
  totalKg: number;
  unreadableNotes: string[];
}

const COMMON_FISH_NAMES = [
  'Tongkol',
  'Layang',
  'Soret',
  'Kunyitan',
  'Katombong',
  'Baga-Baga',
  'Ikan Kuning',
  'Campur',
  'Lainnya',
  'Cakalang',
  'Deho',
  'Baby Tuna',
  'Tuna',
  'Tenggiri',
  'Kembung',
  'Madidihang',
  'Selar',
  'Lemuru',
  'Bawal',
  'Kakap',
  'Kerapu',
  'Kembung Banjar',
];

export function parseFishTallySheetOffline(rawText: string): ParsedFishTally {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let tanggal: string | undefined;
  let rumpon: string | undefined;
  let detectedFish = 'Tongkol';
  const unreadableNotes: string[] = [];

  // 1. Detect Fish Name
  for (const f of COMMON_FISH_NAMES) {
    const regex = new RegExp(`\\b${f}\\b`, 'i');
    if (regex.test(rawText)) {
      detectedFish = f;
      break;
    }
  }

  // 2. Detect Rumpon / Kapal
  const rumponMatch = rawText.match(/(?:rumpon|rmp|kapal|km|km\.|ariani|abadi|sumber)\s*([a-zA-Z0-9_\-]+(?:\s+[0-9]+)?)/i);
  if (rumponMatch) {
    rumpon = rumponMatch[0].trim();
  }

  // 3. Detect Date
  // Example: 25/10/2026, 25-10-2026, 25.10.26
  const dateMatch = rawText.match(/(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})/);
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0');
    const month = dateMatch[2].padStart(2, '0');
    let year = dateMatch[3];
    if (year.length === 2) {
      year = `20${year}`;
    }
    tanggal = `${year}-${month}-${day}`;
  }

  // 4. Extract weights (typically 2-digit fish keranjang weights, e.g. 35 to 99 kg, or decimals like 62.5)
  // We ignore numbers that look like years (e.g. 2024, 2025, 2026), hours, or date days
  const weights: number[] = [];
  const tokenRegex = /\b(\d+(?:[,\.]\d+)?)\b/g;

  for (const line of lines) {
    // If line looks like a header line (has rumpon or date), don't treat year as weight
    if (line.match(/(?:rumpon|kapal|tgl|tanggal|km\b)/i)) {
      continue;
    }

    let match: RegExpExecArray | null;
    while ((match = tokenRegex.exec(line)) !== null) {
      const numStr = match[1].replace(',', '.');
      const val = parseFloat(numStr);

      // Exclude years, zero, or improbable fish basket weights (> 250kg or < 5kg unless single fish)
      if (val >= 15 && val <= 180 && val !== 2024 && val !== 2025 && val !== 2026) {
        weights.push(Math.round(val * 10) / 10);
      }
    }
  }

  const totalKg = weights.reduce((acc, curr) => acc + curr, 0);

  if (weights.length === 0) {
    unreadableNotes.push('Tidak ditemukan angka keranjang yang jelas. Anda dapat menambahkan angka timbangan secara manual di bawah.');
  }

  return {
    tanggal,
    rumpon,
    fishType: detectedFish,
    weights,
    totalKg: Math.round(totalKg * 10) / 10,
    unreadableNotes,
  };
}
