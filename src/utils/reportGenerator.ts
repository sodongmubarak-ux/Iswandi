import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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
      checkPageBreak(8);

      const isEven = index % 2 === 0;
      doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
      doc.rect(margin, y, tableW, 7, 'F');
      doc.setDrawColor(241, 245, 249);
      doc.line(margin, y + 7, margin + tableW, y + 7);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);

      doc.text(`${index + 1}`, margin + 3, y + 5);
      doc.text(item.namaIkan || '-', margin + colNo + 3, y + 5);
      doc.text(formatKg(item.beratKg), margin + colNo + colIkan + colBerat - 3, y + 5, { align: 'right' });
      doc.text(item.hargaPerKg ? formatRupiah(item.hargaPerKg) : '-', margin + colNo + colIkan + colBerat + colHarga - 3, y + 5, { align: 'right' });
      doc.text(item.subtotal ? formatRupiah(item.subtotal) : '-', margin + tableW - 3, y + 5, { align: 'right' });

      y += 7;
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
      desc: '(<=2 Ton Rp1,4 Jt, >2 Ton +Rp700rb/Ton)',
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
 * Capture an HTML element as high-resolution PNG image
 */
export async function captureSlipImage(element: HTMLElement): Promise<string> {
  const canvas = await html2canvas(element, {
    scale: 2, // High resolution for mobile screens
    useCORS: true,
    backgroundColor: '#0a0e17',
    logging: false,
  });
  return canvas.toDataURL('image/png');
}

/**
 * Share or download a generated file with native Android Web Share API support
 */
export async function shareOrDownloadFile(
  fileBlob: Blob,
  fileName: string,
  title: string
): Promise<{ method: 'shared' | 'downloaded' }> {
  const file = new File([fileBlob], fileName, { type: fileBlob.type });

  // Check if Web Share API with files is supported (Android Chrome / WebView)
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: title,
        text: `Laporan Pembukuan Hasil Ikan: ${title}`,
      });
      return { method: 'shared' };
    } catch (err: unknown) {
      // User cancelled share or share failed; fallback to download
      if ((err as Error)?.name !== 'AbortError') {
        console.warn('Share failed, falling back to download', err);
      }
    }
  }

  // Fallback: Direct Download
  const url = URL.createObjectURL(fileBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return { method: 'downloaded' };
}
