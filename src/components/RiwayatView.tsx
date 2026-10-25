import React, { useMemo, useState } from 'react';
import {
  Search,
  Calendar,
  Filter,
  ArrowUpDown,
  Eye,
  Edit2,
  Copy,
  Share2,
  Trash2,
  AlertTriangle,
  Scale,
  DollarSign,
  TrendingUp,
  FileText,
  ChevronDown,
  X,
} from 'lucide-react';
import { BookkeepingRecord } from '../types';
import { formatKg, formatRupiah, formatTon } from '../utils/calculator';

interface RiwayatViewProps {
  records: BookkeepingRecord[];
  onViewRecord: (record: BookkeepingRecord) => void;
  onEditRecord: (record: BookkeepingRecord) => void;
  onDuplicateRecord: (record: BookkeepingRecord) => void;
  onDeleteRecord: (id: string) => Promise<void>;
  onShareRecord: (record: BookkeepingRecord) => void;
}

export const RiwayatView: React.FC<RiwayatViewProps> = ({
  records,
  onViewRecord,
  onEditRecord,
  onDuplicateRecord,
  onDeleteRecord,
  onShareRecord,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [fishFilter, setFishFilter] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  // Deletion modal state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Collect unique fish species from all records for filter
  const allFishSpecies = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      r.items?.forEach((i) => {
        if (i.namaIkan) set.add(i.namaIkan.trim());
      });
    });
    return Array.from(set).sort();
  }, [records]);

  // Filter & Sort
  const filteredRecords = useMemo(() => {
    return records
      .filter((rec) => {
        // Query search on Rumpon, Date, or Notes
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchRumpon = rec.rumpon?.toLowerCase().includes(q);
          const matchTanggal = rec.tanggal?.toLowerCase().includes(q);
          const matchKeterangan = rec.keterangan?.toLowerCase().includes(q);
          if (!matchRumpon && !matchTanggal && !matchKeterangan) return false;
        }

        // Fish species filter
        if (fishFilter.trim()) {
          const hasFish = rec.items?.some(
            (i) => i.namaIkan?.toLowerCase() === fishFilter.toLowerCase()
          );
          if (!hasFish) return false;
        }

        // Start Date filter
        if (startDate && rec.tanggal < startDate) {
          return false;
        }

        // End Date filter
        if (endDate && rec.tanggal > endDate) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.tanggal).getTime();
        const timeB = new Date(b.tanggal).getTime();
        return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
      });
  }, [records, searchQuery, fishFilter, startDate, endDate, sortOrder]);

  // Summary statistics for current filtered list
  const filteredTonase = filteredRecords.reduce((sum, r) => sum + (r.totalTonase || 0), 0);
  const filteredBeratKg = filteredRecords.reduce((sum, r) => sum + (r.totalBeratKg || 0), 0);
  const filteredGross = filteredRecords.reduce((sum, r) => sum + (r.totalHarga || 0), 0);
  const filteredBersih = filteredRecords.reduce((sum, r) => sum + (r.bersih || 0), 0);

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await onDeleteRecord(deleteId);
      setDeleteId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeleting(false);
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setFishFilter('');
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800">
        <h2 className="text-base font-bold text-white">Riwayat Pembukuan</h2>
        <p className="text-xs text-slate-400">
          Cari, filter, cetak slip laporan atau ekspor data pembukuan Anda.
        </p>
      </div>

      {/* Filter and Search Controls */}
      <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Cari rumpon, tanggal, atau keterangan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-amber-500 focus:outline-none"
          />
        </div>

        {/* Date Range & Fish Filter */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">Dari Tanggal</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">Sampai Tanggal</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[10px] text-slate-400 mb-1">Jenis Ikan</label>
            <select
              value={fishFilter}
              onChange={(e) => setFishFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-amber-500 focus:outline-none"
            >
              <option value="">Semua Ikan</option>
              {allFishSpecies.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sort & Reset Bar */}
        <div className="flex items-center justify-between pt-1 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Urutkan:</span>
            <button
              onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-medium hover:text-amber-400"
            >
              <ArrowUpDown className="w-3 h-3" />
              <span>{sortOrder === 'newest' ? 'Terbaru' : 'Terlama'}</span>
            </button>
          </div>

          {(searchQuery || fishFilter || startDate || endDate) && (
            <button
              onClick={resetFilters}
              className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
          )}
        </div>
      </div>

      {/* Filtered Summary Banner */}
      <div className="grid grid-cols-3 gap-2 p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 text-center">
        <div>
          <span className="text-[10px] text-slate-400 block">Total Tonase</span>
          <span className="text-xs font-bold text-sky-400 font-mono">
            {formatTon(filteredTonase)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 block">Total Nilai Ikan</span>
          <span className="text-xs font-bold text-emerald-400 font-mono truncate block">
            {formatRupiah(filteredGross)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-amber-300 block font-semibold">Total Bersih</span>
          <span className="text-xs font-extrabold text-amber-400 font-mono truncate block">
            {formatRupiah(filteredBersih)}
          </span>
        </div>
      </div>

      {/* Records List */}
      {filteredRecords.length === 0 ? (
        <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800 text-center space-y-2">
          <FileText className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">
            Tidak ada catatan yang cocok dengan filter
          </p>
          <p className="text-xs text-slate-500">Coba ubah kata kunci atau rentang tanggal pencarian.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRecords.map((record) => (
            <div
              key={record.id}
              className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800/90 shadow-md space-y-3"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-white">
                      {record.rumpon || 'Rumpon Tanpa Nama'}
                    </span>
                    <span className="text-xs font-mono text-slate-400">· {record.tanggal}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span className="text-sky-300 font-semibold font-mono">
                      {formatTon(record.totalTonase)} ({formatKg(record.totalBeratKg)})
                    </span>
                    <span>·</span>
                    <span>{record.items?.length || 0} jenis ikan</span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-base font-black text-amber-400 font-mono tabular-nums block">
                    {formatRupiah(record.bersih)}
                  </span>
                  <span className="text-[10px] text-slate-500">Bersih</span>
                </div>
              </div>

              {/* Fish Items Chips Preview */}
              <div className="flex flex-wrap gap-1.5 pt-1 text-xs text-slate-300">
                {record.items?.map((item, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px]"
                  >
                    {item.namaIkan}:{' '}
                    <strong className="text-slate-200">{formatKg(item.beratKg)}</strong>
                  </span>
                ))}
              </div>

              {/* 5 Action Buttons: LIHAT, EDIT, DUPLIKASI, BAGIKAN, HAPUS */}
              <div className="pt-2 border-t border-slate-800/80 grid grid-cols-5 gap-1.5 text-xs font-semibold">
                <button
                  onClick={() => onViewRecord(record)}
                  className="py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"
                  title="Lihat Slip Laporan"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span className="text-[10px]">LIHAT</span>
                </button>

                <button
                  onClick={() => onEditRecord(record)}
                  className="py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"
                  title="Edit Data"
                >
                  <Edit2 className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-[10px]">EDIT</span>
                </button>

                <button
                  onClick={() => onDuplicateRecord(record)}
                  className="py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"
                  title="Duplikasi Catatan"
                >
                  <Copy className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px]">DUPLIKAT</span>
                </button>

                <button
                  onClick={() => onShareRecord(record)}
                  className="py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"
                  title="Bagikan Gambar / PDF"
                >
                  <Share2 className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[10px]">BAGIKAN</span>
                </button>

                <button
                  onClick={() => setDeleteId(record.id)}
                  className="py-2 rounded-xl bg-red-950/40 hover:bg-red-950/70 border border-red-900/40 text-red-300 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"
                  title="Hapus Catatan"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-[10px]">HAPUS</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Dialog before deleting */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-5 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-950/80 border border-red-800/80 flex items-center justify-center text-red-400 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white">Konfirmasi Hapus Catatan</h3>
              <p className="text-xs text-slate-400">
                Apakah Anda yakin ingin menghapus catatan pembukuan ini? Tindakan ini tidak dapat
                dibatalkan.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setDeleteId(null)}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold active:scale-95 disabled:opacity-50"
              >
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
