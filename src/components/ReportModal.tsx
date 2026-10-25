import React, { useRef, useState, useEffect } from 'react';
import {
  X,
  Download,
  Share2,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sparkles,
  Camera,
} from 'lucide-react';
import { AppSettings, BookkeepingRecord } from '../types';
import {
  renderSlipToCanvas,
  generatePdfReport,
  shareFile,
  downloadFile,
} from '../utils/reportGenerator';
import { calculateProfitDistribution, formatKg, formatRupiah, formatTon } from '../utils/calculator';
import { getPhoto } from '../db/indexedDB';

interface ReportModalProps {
  record: BookkeepingRecord | null;
  settings: AppSettings;
  onClose: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({ record, settings, onClose }) => {
  const slipRef = useRef<HTMLDivElement>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(record?.fotoAsliBase64 || null);
  const [includePhoto, setIncludePhoto] = useState<boolean>(settings.sertakanFotoLaporan);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (record?.fotoAsliId && !photoBase64) {
      getPhoto(record.fotoAsliId).then((data) => {
        if (data) setPhotoBase64(data);
      });
    }
  }, [record, photoBase64]);

  if (!record) return null;

  const downloadLink = settings.linkDownloadAplikasi ? settings.linkDownloadAplikasi : '[LINK DOWNLOAD APLIKASI]';
  const autoDisclaimer = settings.teksCatatanOtomatis.replace('[LINK DOWNLOAD APLIKASI]', downloadLink);

  const cleanFileName = (ext: string) => {
    const safeDate = record.tanggal || 'tanggal';
    const safeRumpon = (record.rumpon || 'rumpon').replace(/[^a-zA-Z0-9_-]/g, '_');
    return `Catatan_Iswandi_${safeRumpon}_${safeDate}.${ext}`;
  };

  // 1. UNDUH GAMBAR
  const handleDownloadImage = async () => {
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const dataUrl = await renderSlipToCanvas({
        record,
        settings,
        photoBase64,
        includePhoto,
      });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await downloadFile(blob, cleanFileName('png'));
      setStatusMessage({ text: 'Gambar slip berhasil disimpan/diunduh!', type: 'success' });
    } catch (err: unknown) {
      console.error(err);
      setStatusMessage({ text: 'Gagal membuat gambar slip.', type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. BAGIKAN GAMBAR
  const handleShareImage = async () => {
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const dataUrl = await renderSlipToCanvas({
        record,
        settings,
        photoBase64,
        includePhoto,
      });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const result = await shareFile(
        blob,
        cleanFileName('png'),
        `Slip Pembukuan - ${record.rumpon}`
      );
      setStatusMessage({
        text: result.method === 'shared' ? 'Berhasil dibagikan!' : 'Gambar berhasil disimpan!',
        type: 'success',
      });
    } catch (err: unknown) {
      console.error(err);
      setStatusMessage({ text: 'Gagal membagikan gambar.', type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. UNDUH PDF
  const handleDownloadPdf = async () => {
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const doc = await generatePdfReport({
        record,
        settings,
        photoBase64,
        includePhoto,
      });
      const blob = doc.output('blob');
      await downloadFile(blob, cleanFileName('pdf'));
      setStatusMessage({ text: 'Berkas PDF berhasil disimpan/diunduh!', type: 'success' });
    } catch (err: unknown) {
      console.error(err);
      setStatusMessage({ text: 'Gagal membuat berkas PDF.', type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. BAGIKAN PDF
  const handleSharePdf = async () => {
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const doc = await generatePdfReport({
        record,
        settings,
        photoBase64,
        includePhoto,
      });
      const blob = doc.output('blob');
      const result = await shareFile(
        blob,
        cleanFileName('pdf'),
        `CATATAN BY ISWANDI - ${record.rumpon}`
      );
      setStatusMessage({
        text: result.method === 'shared' ? 'PDF berhasil dibagikan!' : 'PDF berhasil disimpan!',
        type: 'success',
      });
    } catch (err: unknown) {
      console.error(err);
      setStatusMessage({ text: 'Gagal membagikan PDF.', type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const soc = settings.mediaSosial;
  const hasSocial = Boolean(soc?.tiktok || soc?.facebook || soc?.instagram || soc?.linkLain);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden my-auto">
        {/* Modal Top Toolbar */}
        <div className="p-4 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Slip Pembukuan & Laporan</h3>
              <p className="text-[10px] text-slate-400 font-mono">
                {record.tanggal} · {record.rumpon}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Toast Message */}
        {statusMessage && (
          <div
            className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 shrink-0 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/80 text-emerald-300 border-b border-emerald-800'
                : 'bg-red-950/80 text-red-300 border-b border-red-800'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Action Buttons Toolbar: 4 Main Actions */}
        <div className="p-3 bg-slate-900 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
          <button
            onClick={handleShareImage}
            disabled={isProcessing}
            className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50 transition-all"
            title="Bagikan slip warna terang HD format potret 9:16 untuk HP Android"
          >
            <Share2 className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>BAGIKAN (9:16 HD)</span>
          </button>

          <button
            onClick={handleDownloadImage}
            disabled={isProcessing}
            className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-100 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 transition-all"
            title="Simpan gambar slip warna terang HD format potret 9:16"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>SIMPAN (9:16 HD)</span>
          </button>

          <button
            onClick={handleSharePdf}
            disabled={isProcessing}
            className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 transition-all"
          >
            <Share2 className="w-3.5 h-3.5 text-sky-400" />
            <span>BAGIKAN PDF</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={isProcessing}
            className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 transition-all"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span>UNDUH PDF</span>
          </button>
        </div>

        {/* Scrollable Printable Slip Container (LIGHT THEME) */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-950">
          <div
            ref={slipRef}
            className="max-w-xl mx-auto rounded-3xl bg-white border-4 border-slate-900 p-5 sm:p-7 shadow-2xl text-slate-900 space-y-5"
          >
            {/* 1. Bagian Atas: Langsung Tanggal dan Nama Rumpon (Hapus Header Catatan by Iswandi) */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-wider">TANGGAL:</span>
                <span className="text-sm font-bold text-slate-900 font-mono">{record.tanggal || '-'}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-wider">NAMA RUMPON:</span>
                <span className="text-sm font-black text-sky-700">{(record.rumpon || '-').toUpperCase()}</span>
              </div>
            </div>

            {/* 2. Setelah itu Foto Asli / Tulisan Tangan */}
            {photoBase64 && (
              <div className="space-y-2 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-slate-700" />
                    <span className="text-xs font-bold text-slate-800 tracking-wide">
                      Foto Asli / Tulisan Tangan
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold">
                    Dokumentasi
                  </span>
                </div>
                <div className="rounded-xl overflow-hidden border border-slate-300 bg-white flex items-center justify-center p-1 shadow-inner">
                  <img
                    src={photoBase64}
                    alt="Foto Asli Catatan Tulisan Tangan"
                    className="w-full max-h-72 object-contain rounded-lg"
                    crossOrigin="anonymous"
                  />
                </div>
              </div>
            )}

            {/* 3. Dibawahnya: Total Berat Ikan (agak besar) & total uang ikan (tulisan kecil di sampingnya) */}
            <div className="p-3.5 rounded-2xl bg-sky-50/80 border border-sky-300 flex items-center justify-between gap-2 shadow-sm">
              <div>
                <span className="text-[11px] font-bold text-sky-800 uppercase tracking-wide block">
                  Total Berat Ikan:
                </span>
                <span className="text-xl sm:text-2xl font-black text-sky-950 font-mono">
                  {formatKg(record.totalBeratKg)} ({formatTon(record.totalTonase)})
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 block">Total Uang Ikan:</span>
                <span className="text-sm sm:text-base font-bold text-emerald-700 font-mono">
                  {formatRupiah(record.totalHarga)}
                </span>
              </div>
            </div>

            {/* 4. Lalu Rincian Hasil Ikan / Scan */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                <span>Rincian Hasil Ikan / Scan</span>
              </span>
              <div className="overflow-hidden rounded-2xl border border-slate-300 shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-white font-bold">
                    <tr>
                      <th className="py-2.5 px-3">No</th>
                      <th className="py-2.5 px-3">Jenis Ikan</th>
                      <th className="py-2.5 px-3 text-right">Berat (kg)</th>
                      <th className="py-2.5 px-3 text-right">Harga</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    {record.items?.map((item, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="py-2.5 px-3 text-slate-500 font-sans">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-sans font-bold text-slate-900">
                          <div>{item.namaIkan}</div>
                          {item.weights && item.weights.length > 0 && (
                            <div className="text-[10px] text-amber-800 font-mono mt-0.5 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-normal">
                              Timbangan ({item.weights.length} Box): {item.weights.join(', ')} kg
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-sky-700">
                          {formatKg(item.beratKg)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-600 font-medium">
                          {item.hargaPerKg ? formatRupiah(item.hargaPerKg) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-emerald-700">
                          {item.subtotal ? formatRupiah(item.subtotal) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100 font-bold border-t border-slate-300 text-xs">
                    <tr>
                      <td colSpan={2} className="py-2.5 px-3 text-slate-900 font-sans">
                        TOTAL IKAN
                      </td>
                      <td className="py-2.5 px-3 text-right text-sky-800 font-mono">
                        {formatKg(record.totalBeratKg)} ({formatTon(record.totalTonase)})
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-400">-</td>
                      <td className="py-2.5 px-3 text-right text-emerald-700 font-mono">
                        {formatRupiah(record.totalHarga)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* 5. Lanjut Operasional */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-rose-800">
                Operasional
              </span>
              <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-800">
                    Pemikul <span className="text-[10px] text-slate-500">(Rp300rb / 1.000 kg)</span>
                  </span>
                  <span className="font-mono font-bold text-rose-700 tabular-nums">
                    {formatRupiah(record.biayaPemikul)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-800">
                    ABK (Estimasi)
                  </span>
                  <span className="font-mono font-bold text-rose-700 tabular-nums">
                    {formatRupiah(record.biayaAbk)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-800">
                    Bongkar (Estimasi)
                  </span>
                  <span className="font-mono font-bold text-rose-700 tabular-nums">
                    {formatRupiah(record.biayaBongkar)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-800">
                    Nyelam (Estimasi)
                  </span>
                  <span className="font-mono font-bold text-rose-700 tabular-nums">
                    {formatRupiah(record.biayaNyelam)}
                  </span>
                </div>

                <div className="pt-2 border-t border-rose-200 flex items-center justify-between font-bold text-rose-900 text-xs">
                  <span>Total Operasional:</span>
                  <span className="font-mono tabular-nums text-sm">{formatRupiah(record.totalBiaya)}</span>
                </div>
              </div>
            </div>

            {/* 6. Total Bersih (Tulisan standar saja, tidak usah terlalu besar) */}
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-400 flex items-center justify-between shadow-sm">
              <div>
                <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide block">
                  Total Bersih
                </span>
                <span className="text-[11px] text-emerald-700">Total Nilai Kotor - Operasional</span>
              </div>
              <span className="text-lg sm:text-xl font-bold text-emerald-800 font-mono tabular-nums">
                {formatRupiah(record.bersih)}
              </span>
            </div>

            {/* 7. Bagian Rumpon dan Bagian Kapal */}
            {(() => {
              const { rumponBagian, kapalBagian } = calculateProfitDistribution(record.bersih);
              return (
                <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-300 space-y-2 shadow-sm">
                  <span className="text-xs font-bold text-amber-950 block">
                    Pembagian Hasil Bersih (Dibagi 3 Bagian):
                  </span>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-2.5 rounded-xl bg-white border border-amber-200 text-left">
                      <span className="text-[10px] font-bold text-amber-800 uppercase block">
                        Rumpon (1 Bagian)
                      </span>
                      <span className="text-base font-bold text-amber-900 font-mono tabular-nums block">
                        {formatRupiah(rumponBagian)}
                      </span>
                      <span className="text-[9px] text-slate-500 block">1/3 bagian</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white border border-emerald-200 text-left">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase block">
                        Kapal (2 Bagian)
                      </span>
                      <span className="text-base font-bold text-emerald-900 font-mono tabular-nums block">
                        {formatRupiah(kapalBagian)}
                      </span>
                      <span className="text-[9px] text-slate-500 block">2/3 bagian</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 8. Logo WA & Catatan Sementara */}
            <div className="pt-3 border-t border-slate-200 text-center space-y-1.5">
              <div className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-slate-900 font-bold text-xs">
                <div className="w-5 h-5 rounded-full bg-[#25D366] flex items-center justify-center text-white text-[10px] shadow-sm">
                  WA
                </div>
                <span>085179709543</span>
              </div>
              <p className="text-[11px] text-slate-500 italic">
                Catatan: Ini merupakan hitungan sementara dan bukan hitungan pasti.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
