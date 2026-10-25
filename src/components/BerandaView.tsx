import React, { useEffect, useState } from 'react';
import {
  Scale,
  DollarSign,
  TrendingUp,
  FileText,
  Camera,
  PlusCircle,
  History,
  HardDrive,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Fish,
} from 'lucide-react';
import { BookkeepingRecord } from '../types';
import { formatKg, formatRupiah, formatTon } from '../utils/calculator';
import { getStorageEstimate } from '../db/indexedDB';
import { NavTab } from './BottomNav';

interface BerandaViewProps {
  records: BookkeepingRecord[];
  onNavigate: (tab: NavTab) => void;
  onSelectRecord: (record: BookkeepingRecord) => void;
  onLoadSample: () => void;
}

export const BerandaView: React.FC<BerandaViewProps> = ({
  records,
  onNavigate,
  onSelectRecord,
  onLoadSample,
}) => {
  const [storageInfo, setStorageInfo] = useState<{ usedMb: number; quotaMb: number; percent: number }>({
    usedMb: 0,
    quotaMb: 0,
    percent: 0,
  });

  useEffect(() => {
    getStorageEstimate().then(setStorageInfo);
  }, [records]);

  // Totals calculations across all saved local records
  const totalCatatan = records.length;
  const totalBeratKg = records.reduce((sum, r) => sum + (r.totalBeratKg || 0), 0);
  const totalTonase = totalBeratKg / 1000;
  const totalNilaiIkan = records.reduce((sum, r) => sum + (r.totalHarga || 0), 0);
  const totalEstimasiBiaya = records.reduce((sum, r) => sum + (r.totalBiaya || 0), 0);
  const totalBersih = records.reduce((sum, r) => sum + (r.bersih || 0), 0);

  const latestRecord = records.length > 0 ? records[0] : null;
  const latestBeratKg = latestRecord?.totalBeratKg || 0;
  const latestRumpon = latestRecord?.rumpon || 'Rumpon Umum';
  const latestTanggal = latestRecord?.tanggal || '';

  const recentRecords = records.slice(0, 5);

  return (
    <div className="space-y-6 pb-24">
      {/* Hero Welcome & Quick Title */}
      <div className="bg-gradient-to-br from-slate-900 via-[#11192b] to-[#0a0e17] rounded-3xl p-5 border border-slate-800/80 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-start justify-between relative z-10">
          <div>
            <span className="text-xs font-semibold text-amber-400 tracking-wider uppercase">
              Pembukuan Nelayan & Ikan
            </span>
            <h2 className="text-2xl font-black text-white mt-1 tracking-tight">
              CATATAN BY ISWANDI
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Pencatatan hasil ikan harian, kalkulasi otomatis pemikul, ABK, bongkar, nyelam, dan bersih.
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Fish className="w-6 h-6" />
          </div>
        </div>

        {/* Highlighted Fish Quantity Latest Record Banner */}
        <div className="mt-5 p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border border-amber-500/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-300 tracking-wide uppercase flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-amber-400" />
              <span>Jumlah Ikan (Catatan Terakhir)</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
              {latestRecord ? 'Terbaru' : 'Belum Ada Data'}
            </span>
          </div>

          <p className="text-2xl sm:text-3xl font-black text-amber-400 mt-1 tabular-nums">
            {latestRecord
              ? latestBeratKg >= 1000
                ? `${formatTon(latestRecord.totalTonase || latestBeratKg / 1000)} (${formatKg(latestBeratKg)})`
                : `${formatKg(latestBeratKg)} (${formatTon(latestBeratKg / 1000)})`
              : '0 kg (0 Ton)'}
          </p>

          <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-300 flex-wrap">
            <span className="text-slate-400 text-[10px]">Rumpon:</span>
            <span className="font-semibold text-amber-300/90 text-xs">{latestRumpon}</span>
            {latestTanggal && (
              <>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400 font-mono text-[10px]">{latestTanggal}</span>
              </>
            )}
            {latestRecord && (
              <>
                <span className="text-slate-600">•</span>
                <span className="text-emerald-300 font-mono text-[10px] font-bold">
                  Bersih: {formatRupiah(latestRecord.bersih)} (Rumpon 1x: {formatRupiah(latestRecord.pembagianRumpon || Math.round(latestRecord.bersih / 3))} | Kapal 2x: {formatRupiah(latestRecord.pembagianKapal || latestRecord.bersih - Math.round(latestRecord.bersih / 3))})
                </span>
              </>
            )}
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <button
            onClick={() => onNavigate('scan')}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
          >
            <Camera className="w-4 h-4 stroke-[2.5]" />
            <span>Scan Catatan AI</span>
          </button>
          <button
            onClick={() => onNavigate('manual')}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800/90 hover:bg-slate-750 border border-slate-700/80 text-white font-bold text-xs active:scale-95 transition-all"
          >
            <PlusCircle className="w-4 h-4 text-amber-400" />
            <span>Tambah Manual</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Statistic Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Catatan Tersimpan */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/90 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 font-medium">Catatan</span>
            <FileText className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-xl font-bold text-white mt-1 tabular-nums">{totalCatatan}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Tersimpan lokal</p>
        </div>

        {/* Total Tonase */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/90 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 font-medium">Total Tonase</span>
            <Scale className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-xl font-bold text-white mt-1 tabular-nums">{formatTon(totalTonase)}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{formatKg(totalBeratKg)}</p>
        </div>

        {/* Total Nilai Ikan */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/90 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 font-medium">Nilai Ikan (Gross)</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-lg font-bold text-emerald-400 mt-1 tabular-nums truncate">
            {formatRupiah(totalNilaiIkan)}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">Kotor</p>
        </div>

        {/* Total Biaya Estimasi */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/90 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 font-medium">Total Biaya</span>
            <TrendingUp className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-lg font-bold text-rose-400 mt-1 tabular-nums truncate">
            {formatRupiah(totalEstimasiBiaya)}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">Biaya operasional</p>
        </div>
      </div>

      {/* Recent Records Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-slate-200">Catatan Terbaru</h3>
          {records.length > 0 && (
            <button
              onClick={() => onNavigate('riwayat')}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
            >
              <span>Lihat Semua ({records.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {records.length === 0 ? (
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center mx-auto text-slate-500">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-300">Belum ada catatan pembukuan</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Mulai catat hasil ikan harian Anda dengan memindai buku catatan fisik menggunakan AI atau menambahkan data manual.
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
              <button
                onClick={() => onNavigate('scan')}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                <span>Scan Catatan Buku</span>
              </button>
              <button
                onClick={onLoadSample}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-medium text-xs flex items-center justify-center gap-1.5"
                title="Muat contoh pembukuan 2,5 Ton untuk mencoba kalkulasi"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Coba Simulasi Contoh (2,5 Ton)</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {recentRecords.map((record) => (
              <div
                key={record.id}
                onClick={() => onSelectRecord(record)}
                role="button"
                tabIndex={0}
                className="p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-850/90 border border-slate-800/90 transition-all flex items-center justify-between gap-3 cursor-pointer group active:scale-[0.99]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white truncate">
                      {record.rumpon || 'Rumpon Tanpa Nama'}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      · {record.tanggal}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                    <span className="text-sky-300 font-medium">
                      {formatTon(record.totalTonase)}
                    </span>
                    <span>·</span>
                    <span className="text-slate-400">
                      {record.items?.length || 0} jenis ikan
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                    Rumpon: <span className="text-amber-300 font-bold">{formatRupiah(record.pembagianRumpon || Math.round(record.bersih / 3))}</span> · Kapal: <span className="text-emerald-300 font-bold">{formatRupiah(record.pembagianKapal || record.bersih - Math.round(record.bersih / 3))}</span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-sm font-extrabold text-amber-400 tabular-nums">
                    {formatRupiah(record.bersih)}
                  </p>
                  <p className="text-[10px] text-slate-500">Bersih</p>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Local Storage & Device Status */}
      <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Penyimpanan Lokal: <strong className="text-slate-200">{storageInfo.usedMb} MB</strong> terpakai
          </span>
        </div>
        <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          IndexedDB Aktif
        </span>
      </div>
    </div>
  );
};
