import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { AppSettings, BookkeepingRecord } from '../types';
import { calculateProfitDistribution, formatKg, formatRupiah, formatTon } from './calculator';

/**
 * Wrap all weight numbers into lines without truncating any numbers
 */
export function wrapWeightNumbers(weights: number[], maxChars = 80): string[] {
  if (!weights || weights.length === 0) return [];
  const lines: string[] = [];
  let cur = '';
  for (let i = 0; i < weights.length; i++) {
    const token = i === 0 ? `${weights[i]}` : `, ${weights[i]}`;
    if ((cur + token).length > maxChars) {
      lines.push(cur);
      cur = `${weights[i]}`;
    } else {
      cur += token;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export interface ShareOrDownloadOptions {
  record: BookkeepingRecord;
  settings: AppSettings;
  photoBase64?: string | null;
  includePhoto?: boolean;
  customTitle?: string;
  customNote?: string;
}

/**
 * Generate a clean, multi-page vector PDF for Catatan by Iswandi
 */
export async function generatePdfReport(
  options: ShareOrDownloadOptions
): Promise<jsPDF> {
  const { record, settings, photoBase64, includePhoto = true } = options;

  // Initialize A4 PDF (210 x 297 mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = margin;

  // Helper for adding new page if content overflows
  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin - 15) {
      doc.addPage();
      y = margin;
      drawHeader(true);
    }
  };

  const drawHeader = (isContinuation = false) => {
    // Header banner with dark blue background
    doc.setFillColor(10, 14, 23);
    doc.rect(margin, y, pageWidth - margin * 2, 22, 'F');

    // Gold accent stripe
    doc.setFillColor(245, 158, 11);
    doc.rect(margin, y + 21, pageWidth - margin * 2, 1.5, 'F');

    // Title text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(252, 211, 77); // Gold text
    doc.text(
      isContinuation
        ? `${settings.reportTitle || 'CATATAN BY ISWANDI'} (Lanjutan)`
        : settings.reportTitle || 'CATATAN BY ISWANDI',
      margin + 6,
      y + 10
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(203, 213, 225);
    doc.text('PEMBUKUAN HASIL TANGKAPAN IKAN HARIAN', margin + 6, y + 16);

    // Date & Rumpon on right
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(`TANGGAL: ${record.tanggal || '-'}`, pageWidth - margin - 6, y + 10, {
      align: 'right',
    });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(245, 158, 11);
    doc.text(`RUMPON: ${record.rumpon || '-'}`, pageWidth - margin - 6, y + 16, {
      align: 'right',
    });

    y += 28;
  };

  // Draw initial header
  drawHeader();

  // Summary Metrics Banner (Total Tonase, Total Harga, Bersih)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 20, 2, 2, 'FD');

  const colWidth = (pageWidth - margin * 2) / 3;

  // Box 1: Total Tonase
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL TONASE', margin + 6, y + 7);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`${formatTon(record.totalTonase)} (${formatKg(record.totalBeratKg)})`, margin + 6, y + 14);

  // Box 2: Total Harga Ikan
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL HARGA IKAN', margin + colWidth + 6, y + 7);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(formatRupiah(record.totalHarga), margin + colWidth + 6, y + 14);

  // Box 3: Total Bersih
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 83, 9);
  doc.text('TOTAL BERSIH (NETTO)', margin + colWidth * 2 + 6, y + 7);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(180, 83, 9);
  doc.text(formatRupiah(record.bersih), margin + colWidth * 2 + 6, y + 14);

  y += 26;

  // FOTO ASLI CATATAN TULISAN TANGAN (SELALU DI ATAS JIKA TERSEDIA)
  if (includePhoto && photoBase64) {
    checkPageBreak(58);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('1. FOTO ASLI CATATAN (TULISAN TANGAN)', margin, y);
    y += 5;

    try {
      const imgWidth = 90;
      const imgHeight = 50;
      doc.addImage(photoBase64, 'JPEG', margin, y, imgWidth, imgHeight, undefined, 'FAST');
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, y, imgWidth, imgHeight);
      y += imgHeight + 8;
    } catch (e) {
      console.warn('Failed to embed photo into PDF', e);
    }
  }

  // TABEL DAFTAR IKAN (VERSI SCAN AI)
  checkPageBreak(25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(
    photoBase64
      ? '2. VERSI SCAN AI & RINCIAN HASIL IKAN'
      : '1. RINCIAN HASIL IKAN',
    margin,
    y
  );
  y += 5;

  // Table Header
  const tableW = pageWidth - margin * 2;
  const colNo = 12;
  const colIkan = 65;
  const colBerat = 35;
  const colHarga = 35;
  const colSub = tableW - colNo - colIkan - colBerat - colHarga;

  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, tableW, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('NO', margin + 3, y + 5.5);
  doc.text('JENIS IKAN', margin + colNo + 3, y + 5.5);
  doc.text('BERAT (KG)', margin + colNo + colIkan + colBerat - 3, y + 5.5, { align: 'right' });
  doc.text('HARGA / KG', margin + colNo + colIkan + colBerat + colHarga - 3, y + 5.5, { align: 'right' });
  doc.text('SUBTOTAL', margin + tableW - 3, y + 5.5, { align: 'right' });

  y += 8;

  // Table Rows
  const items = record.items && record.items.length > 0 ? record.items : [];
  if (items.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Tidak ada rincian baris ikan.', margin + 4, y + 6);
    y += 10;
  } else {
    items.forEach((item, index) => {
      const hasWeights = Boolean(item.weights && item.weights.length > 0);
      let splitWeights: string[] = [];
      if (hasWeights) {
        const weightsStr = `Angka timbangan (${item.weights!.length} box): ${item.weights!.join(', ')}`;
        doc.setFontSize(6.5);
        splitWeights = doc.splitTextToSize(weightsStr, tableW - colNo - 8);
      }
      const rowHeight = hasWeights ? 6.5 + splitWeights.length * 3.5 : 7;
      checkPageBreak(rowHeight + 1);

      const isEven = index % 2 === 0;
      doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
      doc.rect(margin, y, tableW, rowHeight, 'F');
      doc.setDrawColor(241, 245, 249);
      doc.line(margin, y + rowHeight, margin + tableW, y + rowHeight);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);

      doc.text(`${index + 1}`, margin + 3, y + 4.8);
      doc.text(item.namaIkan || '-', margin + colNo + 3, y + 4.8);

      if (hasWeights) {
        doc.setFontSize(6.5);
        doc.setTextColor(180, 83, 9);
        doc.text(splitWeights, margin + colNo + 3, y + 8.5);
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
      }

      doc.text(formatKg(item.beratKg), margin + colNo + colIkan + colBerat - 3, y + 4.8, { align: 'right' });
      doc.text(item.hargaPerKg ? formatRupiah(item.hargaPerKg) : '-', margin + colNo + colIkan + colBerat + colHarga - 3, y + 4.8, { align: 'right' });
      doc.text(item.subtotal ? formatRupiah(item.subtotal) : '-', margin + tableW - 3, y + 4.8, { align: 'right' });

      y += rowHeight;
    });

    // Total Ikan Row
    checkPageBreak(8);
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, tableW, 7.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('TOTAL', margin + colNo + 3, y + 5.5);
    doc.text(`${formatKg(record.totalBeratKg)} (${formatTon(record.totalTonase)})`, margin + colNo + colIkan + colBerat - 3, y + 5.5, { align: 'right' });
    doc.text('-', margin + colNo + colIkan + colBerat + colHarga - 3, y + 5.5, { align: 'right' });
    doc.text(formatRupiah(record.totalHarga), margin + tableW - 3, y + 5.5, { align: 'right' });
    y += 12;
  }

  // TABEL POTONGAN & BIAYA ESTIMASI
  checkPageBreak(45);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('2. POTONGAN BIAYA ESTIMASI', margin, y);
  y += 5;

  const costItems = [
    {
      name: 'Pemikul',
      desc: '(Rp300.000 per 1.000 kg)',
      val: record.biayaPemikul,
      isManual: record.biayaPemikulIsManual,
    },
    {
      name: 'ABK (Estimasi)',
      desc: settings.abkMetode === 'kelipatan_penuh' ? '(Kelipatan Rp20 Juta)' : '(Proporsional Rp20 Juta)',
      val: record.biayaAbk,
      isManual: record.biayaAbkIsManual,
    },
    {
      name: 'Bongkar (Estimasi)',
      desc: '(<1 Ton Rp0, 1 Ton Rp1,4 Jt, +Rp700rb/kelipatan ton)',
      val: record.biayaBongkar,
      isManual: record.biayaBongkarIsManual,
    },
    {
      name: 'Nyelam (Estimasi)',
      desc: '(Dimulai 2 Ton: Rp600rb + Rp600rb/Ton)',
      val: record.biayaNyelam,
      isManual: record.biayaNyelamIsManual,
    },
  ];

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, y, tableW, 32, 'FD');

  let costY = y + 5;
  costItems.forEach((c) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(c.name, margin + 4, costY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(c.desc, margin + 40, costY);

    if (c.isManual) {
      doc.setFontSize(7);
      doc.setTextColor(217, 119, 6);
      doc.text('[Koreksi Manual]', margin + 105, costY);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(formatRupiah(c.val), margin + tableW - 4, costY, { align: 'right' });

    costY += 6.5;
  });

  y += 36;

  // BOX TOTAL BERSIH FINAL
  checkPageBreak(18);
  doc.setFillColor(254, 243, 199); // Soft Gold
  doc.setDrawColor(245, 158, 11);
  doc.roundedRect(margin, y, tableW, 14, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(180, 83, 9);
  doc.text('HASIL BERSIH (TOTAL HARGA - TOTAL BIAYA):', margin + 6, y + 9);
  doc.setFontSize(13);
  doc.text(formatRupiah(record.bersih), margin + tableW - 6, y + 9, { align: 'right' });
  y += 18;

  // PEMBAGIAN HASIL BERSIH (DIBAGI 3 BAGIAN: RUMPON 1 & KAPAL 2)
  const { rumponBagian, kapalBagian } = calculateProfitDistribution(record.bersih);
  checkPageBreak(24);
  doc.setFillColor(254, 252, 232); // Warm light yellow
  doc.setDrawColor(234, 179, 8);
  doc.roundedRect(margin, y, tableW, 20, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(133, 77, 14);
  doc.text('PEMBAGIAN HASIL BERSIH (DIBAGI 3 BAGIAN):', margin + 6, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(113, 63, 18);
  doc.text('Uang hasil bersih dibagi 3: Rumpon dapat 1 bagian (1/3), Kapal dapat 2 bagian (2/3).', margin + 6, y + 11);

  const halfTableW = (tableW - 12) / 2;
  // Rumpon 1 bagian
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(161, 98, 7);
  doc.text('RUMPON (1 Bagian):', margin + 6, y + 17);
  doc.setFontSize(10);
  doc.setTextColor(133, 77, 14);
  doc.text(formatRupiah(rumponBagian), margin + 44, y + 17);

  // Kapal 2 bagian
  doc.setFontSize(8);
  doc.setTextColor(21, 128, 61);
  doc.text('KAPAL (2 Bagian):', margin + halfTableW + 10, y + 17);
  doc.setFontSize(10);
  doc.setTextColor(20, 83, 45);
  doc.text(formatRupiah(kapalBagian), margin + halfTableW + 46, y + 17);

  y += 24;

  // KETERANGAN
  if (record.keterangan) {
    checkPageBreak(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Keterangan Tambahan:', margin, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const splitKeterangan = doc.splitTextToSize(record.keterangan, tableW);
    doc.text(splitKeterangan, margin, y);
    y += splitKeterangan.length * 4 + 4;
  }

  // SOCIAL MEDIA SECTION
  const soc = settings.mediaSosial;
  const hasSocial = Boolean(soc?.tiktok || soc?.facebook || soc?.instagram || soc?.linkLain);
  if (hasSocial) {
    checkPageBreak(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    let socText = 'Media Sosial: ';
    if (soc.tiktok) socText += `TikTok: ${soc.tiktok}   `;
    if (soc.instagram) socText += `IG: ${soc.instagram}   `;
    if (soc.facebook) socText += `FB: ${soc.facebook}   `;
    if (soc.linkLain) socText += `${soc.linkLain}`;
    doc.text(socText, margin, y);
    y += 6;
  }

  // MANDATORY AUTOMATIC DISCLAIMER & DOWNLOAD LINK
  checkPageBreak(16);
  const downloadLink = settings.linkDownloadAplikasi ? settings.linkDownloadAplikasi : '[LINK DOWNLOAD APLIKASI]';
  const autoDisclaimer = settings.teksCatatanOtomatis.replace('[LINK DOWNLOAD APLIKASI]', downloadLink);

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, y, tableW, 14, 'FD');

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const splitDisclaimer = doc.splitTextToSize(autoDisclaimer, tableW - 8);
  doc.text(splitDisclaimer, margin + 4, y + 5);

  // FOOTER WITH PAGE NUMBERS
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Dicetak oleh Catatan by Iswandi - Halaman ${i} dari ${totalPages}`,
      margin,
      pageHeight - 6
    );
    doc.text(
      new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      pageWidth - margin,
      pageHeight - 6,
      { align: 'right' }
    );
  }

  return doc;
}

/**
/**
 * Draw a clean, crisp WhatsApp vector logo with phone number on Canvas 2D
 */
function drawWhatsAppBadge(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  y: number,
  phoneText = '085179709543'
) {
  ctx.save();
  const iconSize = 28;
  ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
  const textW = ctx.measureText(phoneText).width;
  const gap = 10;
  const totalW = iconSize + gap + textW;
  const startX = centerX - totalW / 2;
  const iconX = startX;
  const iconY = y;

  const cx = iconX + iconSize / 2;
  const cy = iconY + iconSize / 2;
  const r = iconSize / 2;

  // Green circular badge
  ctx.fillStyle = '#25D366';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Speech bubble pointer tail
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.45, cy + r * 0.55);
  ctx.lineTo(cx - r * 0.88, cy + r * 0.96);
  ctx.lineTo(cx - r * 0.12, cy + r * 0.76);
  ctx.closePath();
  ctx.fill();

  // White phone handset inside
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.18);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.arc(0, 0, r * 0.52, -Math.PI * 0.72, 0.22);
  ctx.stroke();

  // Small ear/mouth caps
  const rInside = r * 0.52;
  const a1 = -Math.PI * 0.72;
  const a2 = 0.22;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(rInside * Math.cos(a1), rInside * Math.sin(a1), 2.2, 0, Math.PI * 2);
  ctx.arc(rInside * Math.cos(a2), rInside * Math.sin(a2), 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Phone number text
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
  ctx.fillText(phoneText, iconX + iconSize + gap, y + iconSize * 0.72);
  ctx.restore();
}

/**
 * Render an ultra-clean, minimalist, high-definition Slip image in Portrait mode.
 * Follows the user's exact required sequence:
 * 1. Bagian Atas: Langsung Tanggal dan Nama Rumpon (tanpa header 'Catatan by Iswandi')
 * 2. Foto Asli / Tulisan Tangan (jika ada)
 * 3. Total Berat Ikan: (Tulisan agak besar) & total uang ikan (tulisan kecil) di sampingnya
 * 4. Rincian Hasil Ikan / Scan (dengan seluruh angka timbangan box transparan)
 * 5. Operasional (rincian biaya & total)
 * 6. Total Bersih (Tulisan standar saja, tidak terlalu besar)
 * 7. Bagian Rumpon (1 bagian) dan Bagian Kapal (2 bagian)
 * 8. Footer: Logo WA: 085179709543 & Catatan sementara
 */
export async function renderSlipToCanvas(options: ShareOrDownloadOptions): Promise<string> {
  const { record, settings, photoBase64, includePhoto = true } = options;

  // Clean, Full HD 1080px base portrait canvas
  const baseWidth = 1080;
  const padding = 44;
  const contentWidth = baseWidth - padding * 2;

  // Pre-load original notebook photo if available
  let imgObj: HTMLImageElement | null = null;
  let imgDisplayWidth = 0;
  let imgDisplayHeight = 0;

  if (includePhoto && photoBase64) {
    try {
      imgObj = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = photoBase64;
      });
      const aspect = imgObj.width / imgObj.height;
      const maxImgH = 480;
      imgDisplayHeight = Math.min(maxImgH, contentWidth / aspect);
      imgDisplayWidth = imgDisplayHeight * aspect;
      if (imgDisplayWidth > contentWidth) {
        imgDisplayWidth = contentWidth;
        imgDisplayHeight = contentWidth / aspect;
      }
    } catch (e) {
      console.warn('Failed to load original photo for canvas slip:', e);
      imgObj = null;
    }
  }

  const slipTitle = (options.customTitle !== undefined ? options.customTitle : (settings.slipTitle || 'PEMBUKUAN HASIL IKAN')).trim();
  const slipFooterNote = (options.customNote !== undefined ? options.customNote : (settings.slipFooterNote || 'Catatan: Ini merupakan hitungan sementara dan bukan hitungan pasti.')).trim();

  // Calculate required height dynamically for snug, clean portrait framing
  let contentRequiredHeight = padding;

  // 0. Custom Judul Slip (tulisan standar)
  const titleBoxH = slipTitle ? 38 : 0;
  if (slipTitle) {
    contentRequiredHeight += titleBoxH + 16;
  }

  // 1. Header Card (Tanggal & Rumpon)
  const headerCardH = 76;
  contentRequiredHeight += headerCardH + 18;

  // 2. Foto Asli (if present)
  if (imgObj) {
    contentRequiredHeight += 28 + imgDisplayHeight + 14 + 18;
  }

  // 3. Total Berat Ikan (agak besar) & Total Uang Ikan (kecil)
  const summaryCardH = 78;
  contentRequiredHeight += summaryCardH + 20;

  // 4. Rincian Hasil Ikan / Scan
  contentRequiredHeight += 30; // Section title
  contentRequiredHeight += 44; // Table header
  const tableRowsH = record.items.reduce((acc, it) => {
    if (it.weights && it.weights.length > 0) {
      const lines = wrapWeightNumbers(it.weights, 85);
      return acc + 50 + (26 + lines.length * 20) + 8;
    }
    return acc + 50;
  }, 0);
  contentRequiredHeight += tableRowsH;
  contentRequiredHeight += 46; // Table total row
  contentRequiredHeight += 20; // Gap

  // 5. Operasional
  contentRequiredHeight += 30; // Section title
  const feeBoxH = 186;
  contentRequiredHeight += feeBoxH + 20;

  // 6. Total Bersih (Tulisan standar saja)
  const nettoCardH = 68;
  contentRequiredHeight += nettoCardH + 16;

  // 7. Bagian Rumpon dan Bagian Kapal
  const splitCardH = 88;
  contentRequiredHeight += splitCardH + 26;

  // 8. Footer: Logo WA & Catatan Sementara
  contentRequiredHeight += 34 + 10 + 26 + padding;

  const targetHeight = Math.max(1350, Math.ceil(contentRequiredHeight));
  const targetWidth = baseWidth;

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 1. Pristine Minimalist White Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  // Subtle clean outer frame
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(16, 16, targetWidth - 32, targetHeight - 32, 16);
  } else {
    ctx.rect(16, 16, targetWidth - 32, targetHeight - 32);
  }
  ctx.stroke();

  let curY = padding;

  // =========================================================================
  // 0. CUSTOM JUDUL SLIP GAMBAR (BAGIAN ATAS TULISAN STANDAR)
  // =========================================================================
  if (slipTitle) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
    ctx.fillText(slipTitle.toUpperCase(), padding + contentWidth / 2, curY + 22);

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padding + 20, curY + titleBoxH);
    ctx.lineTo(padding + contentWidth - 20, curY + titleBoxH);
    ctx.stroke();

    curY += titleBoxH + 16;
  }

  // =========================================================================
  // 1. BAGIAN ATAS: LANGSUNG TANGGAL DAN NAMA RUMPON
  // =========================================================================
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(padding, curY, contentWidth, headerCardH, 12);
  } else {
    ctx.rect(padding, curY, contentWidth, headerCardH);
  }
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Tanggal (Kiri)
  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
  ctx.fillText('TANGGAL:', padding + 20, curY + 28);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(record.tanggal || '-', padding + 20, curY + 54);

  // Nama Rumpon (Kanan)
  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
  ctx.fillText('NAMA RUMPON:', padding + contentWidth - 20, curY + 28);
  ctx.fillStyle = '#0284c7';
  ctx.font = '900 22px system-ui, -apple-system, sans-serif';
  ctx.fillText((record.rumpon || '-').toUpperCase(), padding + contentWidth - 20, curY + 54);

  curY += headerCardH + 18;

  // =========================================================================
  // 2. SETELAH ITU FOTO ASLI / TULISAN TANGAN
  // =========================================================================
  if (imgObj) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
    ctx.fillText('FOTO ASLI / TULISAN TANGAN', padding, curY + 14);

    curY += 26;

    const imgX = padding + (contentWidth - imgDisplayWidth) / 2;
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(imgX - 3, curY - 3, imgDisplayWidth + 6, imgDisplayHeight + 6, 12);
    } else {
      ctx.rect(imgX - 3, curY - 3, imgDisplayWidth + 6, imgDisplayHeight + 6);
    }
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.drawImage(imgObj, imgX, curY, imgDisplayWidth, imgDisplayHeight);
    curY += imgDisplayHeight + 14 + 18;
  }

  // =========================================================================
  // 3. DIBAWAHNYA: TOTAL BERAT IKAN (AGAK BESAR) & TOTAL UANG IKAN (TULISAN KECIL DI SAMPINGNYA)
  // =========================================================================
  ctx.fillStyle = '#f0f9ff';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(padding, curY, contentWidth, summaryCardH, 12);
  } else {
    ctx.rect(padding, curY, contentWidth, summaryCardH);
  }
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Kiri: Total Berat Ikan: (Tulisan agak besar)
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0369a1';
  ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
  ctx.fillText('TOTAL BERAT IKAN:', padding + 20, curY + 30);
  ctx.fillStyle = '#0c4a6e';
  ctx.font = '900 30px monospace';
  ctx.fillText(`${formatKg(record.totalBeratKg)} (${formatTon(record.totalTonase)})`, padding + 20, curY + 62);

  // Kanan / di sampingnya: Total uang ikan (tulisan kecil)
  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
  ctx.fillText('TOTAL NILAI IKAN (KOTOR):', padding + contentWidth - 20, curY + 30);
  ctx.fillStyle = '#047857';
  ctx.font = 'bold 19px monospace';
  ctx.fillText(formatRupiah(record.totalHarga), padding + contentWidth - 20, curY + 60);

  curY += summaryCardH + 20;

  // =========================================================================
  // 4. RINCIAN HASIL IKAN / SCAN
  // =========================================================================
  ctx.textAlign = 'left';
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
  ctx.fillText('RINCIAN HASIL IKAN / SCAN', padding, curY + 14);

  curY += 24;

  const colX = {
    no: padding + 16,
    nama: padding + 68,
    berat: padding + 520,
    harga: padding + 735,
    subtotal: padding + contentWidth - 16,
  };

  // Table Header
  const thH = 40;
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(padding, curY, contentWidth, thH, [10, 10, 0, 0]);
  } else {
    ctx.rect(padding, curY, contentWidth, thH);
  }
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('NO', colX.no, curY + 25);
  ctx.fillText('JENIS IKAN', colX.nama, curY + 25);
  ctx.textAlign = 'right';
  ctx.fillText('BERAT (KG)', colX.berat, curY + 25);
  ctx.fillText('HARGA / KG', colX.harga, curY + 25);
  ctx.fillText('SUBTOTAL', colX.subtotal, curY + 25);

  curY += thH;

  // Table Rows with complete box weight breakdown
  record.items.forEach((item, idx) => {
    const hasWeights = Boolean(item.weights && item.weights.length > 0);
    const weightLines = hasWeights ? wrapWeightNumbers(item.weights!, 85) : [];
    const weightBoxH = hasWeights ? 24 + weightLines.length * 20 : 0;
    const rowH = hasWeights ? 50 + weightBoxH + 8 : 50;

    ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    ctx.fillRect(padding, curY, contentWidth, rowH);

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, curY + rowH);
    ctx.lineTo(padding + contentWidth, curY + rowH);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${idx + 1}`, colX.no, curY + 31);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
    ctx.fillText(item.namaIkan, colX.nama, curY + 31);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#0284c7';
    ctx.font = 'bold 17px monospace';
    ctx.fillText(formatKg(item.beratKg), colX.berat, curY + 31);

    ctx.fillStyle = '#475569';
    ctx.font = '15px monospace';
    ctx.fillText(item.hargaPerKg ? formatRupiah(item.hargaPerKg) : '-', colX.harga, curY + 31);

    ctx.fillStyle = item.subtotal ? '#047857' : '#64748b';
    ctx.font = 'bold 17px monospace';
    ctx.fillText(item.subtotal ? formatRupiah(item.subtotal) : '-', colX.subtotal, curY + 31);

    // Render transparent list of every weight number
    if (hasWeights) {
      const boxX = colX.nama;
      const boxW = contentWidth - (colX.nama - padding) - 16;
      const boxY = curY + 44;

      ctx.fillStyle = '#fffbeb';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(boxX, boxY, boxW, weightBoxH, 8);
      } else {
        ctx.rect(boxX, boxY, boxW, weightBoxH);
      }
      ctx.fill();
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = '#b45309';
      ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
      ctx.fillText(`Angka Timbangan (${item.weights!.length} Box / Keranjang):`, boxX + 10, boxY + 16);

      ctx.fillStyle = '#92400e';
      ctx.font = 'bold 12.5px monospace';
      weightLines.forEach((wLine, lIdx) => {
        ctx.fillText(wLine, boxX + 10, boxY + 34 + lIdx * 20);
      });
    }

    curY += rowH;
  });

  // Table Total Row
  const totalRowH = 46;
  ctx.fillStyle = '#f1f5f9';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(padding, curY, contentWidth, totalRowH, [0, 0, 10, 10]);
  } else {
    ctx.rect(padding, curY, contentWidth, totalRowH);
  }
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
  ctx.fillText('TOTAL IKAN', colX.no, curY + 29);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#0284c7';
  ctx.font = 'bold 17px monospace';
  ctx.fillText(`${formatTon(record.totalTonase)} (${formatKg(record.totalBeratKg)})`, colX.berat, curY + 29);

  ctx.fillStyle = '#047857';
  ctx.font = 'bold 18px monospace';
  ctx.fillText(formatRupiah(record.totalHarga), colX.subtotal, curY + 29);

  curY += totalRowH + 20;

  // =========================================================================
  // 5. OPERASIONAL
  // =========================================================================
  ctx.textAlign = 'left';
  ctx.fillStyle = '#991b1b';
  ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
  ctx.fillText('OPERASIONAL', padding, curY + 14);

  curY += 24;

  const feeRows = [
    { name: 'Pemikul', val: record.biayaPemikul },
    { name: 'ABK (Estimasi)', val: record.biayaAbk },
    { name: 'Bongkar (Estimasi)', val: record.biayaBongkar },
    { name: 'Nyelam (Estimasi)', val: record.biayaNyelam },
  ];

  ctx.fillStyle = '#fff1f2';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(padding, curY, contentWidth, feeBoxH, 12);
  } else {
    ctx.rect(padding, curY, contentWidth, feeBoxH);
  }
  ctx.fill();
  ctx.strokeStyle = '#fecdd3';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  let feeRowY = curY + 28;
  feeRows.forEach((fr) => {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
    ctx.fillText(fr.name, padding + 20, feeRowY);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#b91c1c';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(formatRupiah(fr.val), padding + contentWidth - 20, feeRowY);

    feeRowY += 29;
  });

  // Divider inside fee box
  ctx.strokeStyle = '#fca5a5';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding + 20, feeRowY - 6);
  ctx.lineTo(padding + contentWidth - 20, feeRowY - 6);
  ctx.stroke();

  feeRowY += 18;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#991b1b';
  ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
  ctx.fillText('TOTAL OPERASIONAL', padding + 20, feeRowY);

  ctx.textAlign = 'right';
  ctx.font = 'bold 18px monospace';
  ctx.fillText(formatRupiah(record.totalBiaya), padding + contentWidth - 20, feeRowY);

  curY += feeBoxH + 20;

  // =========================================================================
  // 6. TOTAL BERSIH (TULISAN STANDAR SAJA, TIDAK USAH TERLALU BESAR)
  // =========================================================================
  ctx.fillStyle = '#ecfdf5';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(padding, curY, contentWidth, nettoCardH, 12);
  } else {
    ctx.rect(padding, curY, contentWidth, nettoCardH);
  }
  ctx.fill();
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Left: Label Total Bersih
  ctx.textAlign = 'left';
  ctx.fillStyle = '#065f46';
  ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
  ctx.fillText('TOTAL HASIL BERSIH (NETTO)', padding + 20, curY + 40);

  // Right: Value (standar saja, tidak terlalu besar)
  ctx.textAlign = 'right';
  ctx.fillStyle = '#064e3b';
  ctx.font = 'bold 24px monospace';
  ctx.fillText(formatRupiah(record.bersih), padding + contentWidth - 20, curY + 42);

  curY += nettoCardH + 16;

  // =========================================================================
  // 7. BAGIAN RUMPON DAN BAGIAN KAPAL
  // =========================================================================
  const { rumponBagian, kapalBagian } = calculateProfitDistribution(record.bersih);

  ctx.fillStyle = '#fefce8';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(padding, curY, contentWidth, splitCardH, 12);
  } else {
    ctx.rect(padding, curY, contentWidth, splitCardH);
  }
  ctx.fill();
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Title
  ctx.textAlign = 'left';
  ctx.fillStyle = '#854d0e';
  ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
  ctx.fillText('PEMBAGIAN HASIL BERSIH:', padding + 20, curY + 22);

  const subBoxW = (contentWidth - 40 - 14) / 2;
  const subBoxY = curY + 32;
  const subBoxH = 44;

  // Bagian Rumpon
  const rumponBoxX = padding + 20;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(rumponBoxX, subBoxY, subBoxW, subBoxH, 8);
  } else {
    ctx.rect(rumponBoxX, subBoxY, subBoxW, subBoxH);
  }
  ctx.fill();
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#a16207';
  ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
  ctx.fillText('RUMPON:', rumponBoxX + 12, subBoxY + 18);
  ctx.fillStyle = '#854d0e';
  ctx.font = 'bold 18px monospace';
  ctx.fillText(formatRupiah(rumponBagian), rumponBoxX + 12, subBoxY + 36);

  // Bagian Kapal
  const kapalBoxX = rumponBoxX + subBoxW + 14;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(kapalBoxX, subBoxY, subBoxW, subBoxH, 8);
  } else {
    ctx.rect(kapalBoxX, subBoxY, subBoxW, subBoxH);
  }
  ctx.fill();
  ctx.strokeStyle = '#bbf7d0';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#15803d';
  ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
  ctx.fillText('KAPAL:', kapalBoxX + 12, subBoxY + 18);
  ctx.fillStyle = '#14532d';
  ctx.font = 'bold 18px monospace';
  ctx.fillText(formatRupiah(kapalBagian), kapalBoxX + 12, subBoxY + 36);

  curY += splitCardH + 26;

  // =========================================================================
  // 8. LOGO WA: 085179709543 & CATATAN KUSTOM
  // =========================================================================
  drawWhatsAppBadge(ctx, targetWidth / 2, curY, '085179709543');
  curY += 36;

  if (slipFooterNote) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748b';
    ctx.font = 'italic 13px system-ui, -apple-system, sans-serif';
    ctx.fillText(slipFooterNote, targetWidth / 2, curY);
  }

  return canvas.toDataURL('image/png');
}

/**
 * Convert Blob to Base64 data string (without data URL prefix)
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Native Android + Web Sharing function
 * Automatically uses @capacitor/share on Android APK, Web Share API on mobile browsers, or falls back to download.
 */
export async function shareFile(
  fileBlob: Blob,
  fileName: string,
  title: string
): Promise<{ method: 'shared' | 'downloaded' }> {
  // 1. Check if running in Native Capacitor App (Android APK)
  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = await blobToBase64(fileBlob);
      const writeResult = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
      });

      await Share.share({
        title: title,
        text: `Slip Pembukuan Ikan: ${title}`,
        url: writeResult.uri,
        dialogTitle: 'Bagikan Slip Catatan',
      });
      return { method: 'shared' };
    } catch (e: unknown) {
      if ((e as Error)?.message?.includes('canceled') || (e as Error)?.name === 'AbortError') {
        return { method: 'shared' };
      }
      console.warn('Native Capacitor Share failed, trying browser share/download fallback:', e);
    }
  }

  // 2. Web Share API with files (Android Chrome / Mobile Browsers)
  const file = new File([fileBlob], fileName, { type: fileBlob.type });
  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: title,
        text: `Slip Pembukuan Ikan: ${title}`,
      });
      return { method: 'shared' };
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') {
        return { method: 'shared' };
      }
      console.warn('Web Share failed, falling back to download:', err);
    }
  }

  // 3. Fallback: Trigger download / save
  await downloadFile(fileBlob, fileName);
  return { method: 'downloaded' };
}

/**
 * Native Android + Web Download/Save function
 * In Capacitor Android APK: Writes to Documents directory and opens share/save dialog.
 * In browser: Triggers standard browser download.
 */
export async function downloadFile(
  fileBlob: Blob,
  fileName: string
): Promise<{ method: 'saved-native' | 'downloaded'; uri?: string }> {
  // 1. In Native Capacitor Android APK:
  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = await blobToBase64(fileBlob);
      const writeResult = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true,
      });

      try {
        await Share.share({
          title: fileName,
          url: writeResult.uri,
          dialogTitle: 'Simpan / Buka Berkas',
        });
      } catch {}

      return { method: 'saved-native', uri: writeResult.uri };
    } catch (e) {
      console.warn('Native Filesystem save failed, trying browser blob fallback:', e);
    }
  }

  // 2. Standard Browser Download:
  const url = URL.createObjectURL(fileBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2500);
  return { method: 'downloaded' };
}

/**
 * Backward compatibility wrapper for existing callers
 */
export async function shareOrDownloadFile(
  fileBlob: Blob,
  fileName: string,
  title: string
): Promise<{ method: 'shared' | 'downloaded' }> {
  return shareFile(fileBlob, fileName, title);
}

/**
 * Capture an HTML element as high-resolution PNG image (with safety fallback to Canvas 2D)
 */
export async function captureSlipImage(element: HTMLElement): Promise<string> {
  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#0a0e17',
      logging: false,
    });
    return canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('html2canvas capture error:', e);
    throw e;
  }
}
