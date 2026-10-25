import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { AppSettings, BookkeepingRecord } from '../types';
import { formatKg, formatRupiah, formatTon } from './calculator';

export interface ShareOrDownloadOptions {
  record: BookkeepingRecord;
  settings: AppSettings;
  photoBase64?: string | null;
  includePhoto?: boolean;
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
      const rowHeight = hasWeights ? 10.5 : 7;
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
        const weightsStr = `(${item.weights!.length} box): ${item.weights!.join(', ')}`;
        const truncatedStr = weightsStr.length > 55 ? `${weightsStr.slice(0, 52)}...` : weightsStr;
        doc.text(truncatedStr, margin + colNo + 3, y + 8.5);
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
 * Render a complete, beautiful high-resolution Slip image in portrait 9:16 ratio
 * Eliminates empty space, displays handwritten notes photo large and clear, and uses crisp, bold typography.
 */
export async function renderSlipToCanvas(options: ShareOrDownloadOptions): Promise<string> {
  const { record, settings, photoBase64, includePhoto = true } = options;

  const baseWidth = 1080;
  const padding = 44;
  const contentWidth = baseWidth - padding * 2;

  // Pre-load original photo if included
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
      // Allow the handwritten notebook photo to be large and prominent (up to 640px height)
      const maxImgH = 640;
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

  // Pre-calculate content height
  let contentRequiredHeight = padding;
  contentRequiredHeight += 125; // Header brand block
  contentRequiredHeight += 72;  // Date & Rumpon card
  contentRequiredHeight += 20;  // Gap

  if (imgObj) {
    contentRequiredHeight += 36; // Section 1 title
    contentRequiredHeight += imgDisplayHeight + 20; // Photo + spacing
  }

  // Table
  contentRequiredHeight += 36; // Table title
  contentRequiredHeight += 46; // Table header
  contentRequiredHeight += record.items.reduce((acc, it) => acc + (it.weights && it.weights.length > 0 ? 64 : 48), 0);
  contentRequiredHeight += 50; // Table total row
  contentRequiredHeight += 22; // Gap

  // Potongan Biaya
  contentRequiredHeight += 36; // Fee title
  contentRequiredHeight += 185; // Fee card
  contentRequiredHeight += 22; // Gap

  // Total Bersih Netto
  contentRequiredHeight += 108; // Netto banner
  contentRequiredHeight += 22; // Gap

  // Social & Footer
  contentRequiredHeight += 100;
  contentRequiredHeight += padding;

  // Calculate canvas dimensions keeping strict 9:16 aspect ratio:
  // Height = Width * (16 / 9)
  // If content requires more or less, adjust dimensions so the content fills the 9:16 frame with zero dead space!
  let targetHeight = Math.max(1600, Math.ceil(contentRequiredHeight / 16) * 16);
  let targetWidth = Math.round(targetHeight * (9 / 16));

  // Distribute any extra slack space evenly among section gaps
  const extraSlack = Math.max(0, targetHeight - contentRequiredHeight);
  const gapBonus = Math.min(18, Math.floor(extraSlack / 6));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Scale context if targetWidth is different from baseWidth
  const scale = targetWidth / baseWidth;
  ctx.scale(scale, scale);

  const virtualHeight = targetHeight / scale;

  // Rich luxury dark slate background
  ctx.fillStyle = '#0a0e17';
  ctx.fillRect(0, 0, baseWidth, virtualHeight);

  // Outer Gold Decorative Border
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(16, 16, baseWidth - 32, virtualHeight - 32, 28);
  } else {
    ctx.rect(16, 16, baseWidth - 32, virtualHeight - 32);
  }
  ctx.stroke();

  // Inner subtle accent frame
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(24, 24, baseWidth - 48, virtualHeight - 48, 22);
  } else {
    ctx.rect(24, 24, baseWidth - 48, virtualHeight - 48);
  }
  ctx.stroke();

  let curY = padding + 12 + gapBonus;

  // 1. Header Brand
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
  ctx.fillText('PEMBUKUAN HASIL TANGKAPAN IKAN HARIAN', baseWidth / 2, curY);

  curY += 34;
  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 34px system-ui, -apple-system, sans-serif';
  ctx.fillText(settings.reportTitle || 'CATATAN BY ISWANDI', baseWidth / 2, curY);

  curY += 24;
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
  ctx.fillText(`Pengelola: ${settings.ownerName || 'Iswandi'}`, baseWidth / 2, curY);

  curY += 26;
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padding, curY);
  ctx.lineTo(baseWidth - padding, curY);
  ctx.stroke();

  curY += 18 + gapBonus;

  // 2. Date & Rumpon Card
  const cardW = contentWidth;
  const cardH = 68;
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(padding, curY, cardW, cardH, 16);
  } else {
    ctx.rect(padding, curY, cardW, cardH);
  }
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
  ctx.fillText('TANGGAL CATATAN:', padding + 22, curY + 27);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px monospace';
  ctx.fillText(record.tanggal || '-', padding + 22, curY + 51);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
  ctx.fillText('RUMPON / LOKASI:', padding + cardW - 22, curY + 27);
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 19px system-ui, -apple-system, sans-serif';
  ctx.fillText((record.rumpon || '-').toUpperCase(), padding + cardW - 22, curY + 51);

  curY += cardH + 22 + gapBonus;

  // 3. Section 1: Original Photo (if available) - Made Prominent and Large!
  if (imgObj) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
    ctx.fillText('1. FOTO ASLI BUKU CATATAN (TULISAN TANGAN)', padding, curY);

    curY += 14;
    const imgX = padding + (contentWidth - imgDisplayWidth) / 2;

    // Background card for photo
    ctx.fillStyle = '#050811';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(imgX - 4, curY - 4, imgDisplayWidth + 8, imgDisplayHeight + 8, 14);
    } else {
      ctx.rect(imgX - 4, curY - 4, imgDisplayWidth + 8, imgDisplayHeight + 8);
    }
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.drawImage(imgObj, imgX, curY, imgDisplayWidth, imgDisplayHeight);

    curY += imgDisplayHeight + 22 + gapBonus;
  }

  // 4. Section 2: Table of Fish
  ctx.textAlign = 'left';
  ctx.fillStyle = '#38bdf8';
  const tableSectionNum = imgObj ? '2' : '1';
  ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${tableSectionNum}. RINCIAN HASIL IKAN (SCAN DIGITAL AI)`, padding, curY);

  curY += 14;

  const colX = {
    no: padding + 18,
    nama: padding + 72,
    berat: padding + 490,
    harga: padding + 710,
    subtotal: padding + contentWidth - 20,
  };

  // Table Header Background
  const thH = 46;
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(padding, curY, contentWidth, thH, [12, 12, 0, 0]);
  } else {
    ctx.rect(padding, curY, contentWidth, thH);
  }
  ctx.fill();

  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 14.5px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('NO', colX.no, curY + 28);
  ctx.fillText('JENIS IKAN', colX.nama, curY + 28);
  ctx.textAlign = 'right';
  ctx.fillText('BERAT (KG)', colX.berat, curY + 28);
  ctx.fillText('HARGA / KG', colX.harga, curY + 28);
  ctx.fillText('SUBTOTAL', colX.subtotal, curY + 28);

  curY += thH;

  // Table Rows
  record.items.forEach((item, idx) => {
    const hasWeights = Boolean(item.weights && item.weights.length > 0);
    const rowH = hasWeights ? 64 : 48;

    ctx.fillStyle = idx % 2 === 0 ? '#0f172a' : '#141e33';
    ctx.fillRect(padding, curY, contentWidth, rowH);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${idx + 1}`, colX.no, curY + (hasWeights ? 26 : 29));

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
    ctx.fillText(item.namaIkan, colX.nama, curY + (hasWeights ? 22 : 29));

    if (hasWeights) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 12.5px monospace';
      const weightsStr = `(${item.weights!.length} box): ${item.weights!.join(', ')}`;
      const truncated = weightsStr.length > 52 ? `${weightsStr.slice(0, 49)}...` : weightsStr;
      ctx.fillText(truncated, colX.nama, curY + 46);
    }

    ctx.textAlign = 'right';
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(formatKg(item.beratKg), colX.berat, curY + (hasWeights ? 26 : 29));

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(item.hargaPerKg ? formatRupiah(item.hargaPerKg) : '-', colX.harga, curY + (hasWeights ? 26 : 29));

    ctx.fillStyle = item.subtotal ? '#4ade80' : '#64748b';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(item.subtotal ? formatRupiah(item.subtotal) : '-', colX.subtotal, curY + (hasWeights ? 26 : 29));

    curY += rowH;
  });

  // Table Total Row
  const totalRowH = 50;
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(padding, curY, contentWidth, totalRowH, [0, 0, 12, 12]);
  } else {
    ctx.rect(padding, curY, contentWidth, totalRowH);
  }
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
  ctx.fillText('TOTAL IKAN', colX.no, curY + 31);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(`${formatTon(record.totalTonase)} (${formatKg(record.totalBeratKg)})`, colX.berat, curY + 31);

  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 17px monospace';
  ctx.fillText(formatRupiah(record.totalHarga), colX.subtotal, curY + 31);

  curY += totalRowH + 22 + gapBonus;

  // 5. Section 3: Potongan Biaya
  const feeSectionNum = imgObj ? '3' : '2';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${feeSectionNum}. POTONGAN BIAYA OPERASIONAL (ESTIMASI)`, padding, curY);

  curY += 14;

  const feeBoxH = 185;
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(padding, curY, contentWidth, feeBoxH, 16);
  } else {
    ctx.rect(padding, curY, contentWidth, feeBoxH);
  }
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const feeRows = [
    { name: 'Pemikul', sub: '(Rp300rb / 1.000 kg)', val: record.biayaPemikul },
    {
      name: 'ABK (Estimasi)',
      sub: settings.abkMetode === 'kelipatan_penuh' ? '(Kelipatan Penuh Rp20 Jt)' : '(Proporsional Rp20 Jt)',
      val: record.biayaAbk,
    },
    {
      name: 'Bongkar (Estimasi)',
      sub: '(<1t Rp0, 1t Rp1,4 Jt, +Rp700rb/kelipatan ton)',
      val: record.biayaBongkar,
    },
    {
      name: 'Nyelam (Estimasi)',
      sub: '(≥2t: Rp600rb + Rp600rb/t)',
      val: record.biayaNyelam,
    },
  ];

  let feeRowY = curY + 28;
  feeRows.forEach((fr) => {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
    ctx.fillText(fr.name, padding + 22, feeRowY);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12.5px system-ui, -apple-system, sans-serif';
    ctx.fillText(fr.sub, padding + 165, feeRowY);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15.5px monospace';
    ctx.fillText(formatRupiah(fr.val), padding + contentWidth - 22, feeRowY);

    feeRowY += 30;
  });

  // Divider inside fee box
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padding + 22, feeRowY - 6);
  ctx.lineTo(padding + contentWidth - 22, feeRowY - 6);
  ctx.stroke();

  feeRowY += 20;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 15.5px system-ui, -apple-system, sans-serif';
  ctx.fillText('TOTAL BIAYA POTONGAN', padding + 22, feeRowY);

  ctx.textAlign = 'right';
  ctx.font = 'bold 17px monospace';
  ctx.fillText(formatRupiah(record.totalBiaya), padding + contentWidth - 22, feeRowY);

  curY += feeBoxH + 22 + gapBonus;

  // 6. Section 4: Total Bersih (Netto) Grand Total Banner
  const nettoH = 108;
  ctx.fillStyle = '#1c1917';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(padding, curY, contentWidth, nettoH, 18);
  } else {
    ctx.rect(padding, curY, contentWidth, nettoH);
  }
  ctx.fill();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
  ctx.fillText('TOTAL BERSIH (NETTO) DITERIMA', padding + 24, curY + 36);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '13px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    `Total Harga (${formatRupiah(record.totalHarga)}) - Potongan (${formatRupiah(record.totalBiaya)})`,
    padding + 24,
    curY + 70
  );

  ctx.textAlign = 'right';
  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 36px monospace';
  ctx.fillText(formatRupiah(record.bersih), padding + contentWidth - 24, curY + 64);

  curY += nettoH + 22 + gapBonus;

  // 7. Social Media Badges
  const fbLink = settings.mediaSosial?.facebook || 'https://www.facebook.com/1swandi';
  if (fbLink) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
    ctx.fillText(`Facebook: 1swandi · fb.com/1swandi`, baseWidth / 2, curY);
    curY += 22;
  }

  // 8. Disclaimer & Branding Footer
  ctx.textAlign = 'center';
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'italic 12px system-ui, -apple-system, sans-serif';

  const downloadLink = settings.linkDownloadAplikasi || '[LINK DOWNLOAD APLIKASI]';
  const autoNote = settings.teksCatatanOtomatis.replace('[LINK DOWNLOAD APLIKASI]', downloadLink);
  ctx.fillText(autoNote, baseWidth / 2, curY, contentWidth);

  curY += 26;
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
  const timestampStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  ctx.fillText(`Dicetak otomatis oleh Aplikasi Catatan by Iswandi (Format Potret 9:16) · ${timestampStr}`, baseWidth / 2, curY);

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
