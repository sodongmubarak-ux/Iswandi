import React, { useEffect, useState } from 'react';
import { AppSettings, BookkeepingRecord } from './types';
import { DEFAULT_SETTINGS } from './utils/calculator';
import {
  deleteRecord,
  getAllRecords,
  getPhoto,
  getSettings,
  savePhoto,
  saveRecord,
  saveSettings,
} from './db/indexedDB';
import { TopBar } from './components/TopBar';
import { BottomNav, NavTab } from './components/BottomNav';
import { BerandaView } from './components/BerandaView';
import { ScanCatatanView } from './components/ScanCatatanView';
import { TambahManualView } from './components/TambahManualView';
import { RiwayatView } from './components/RiwayatView';
import { PengaturanView } from './components/PengaturanView';
import { ReportModal } from './components/ReportModal';
import { GitHubPushModal } from './components/GitHubPushModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('beranda');
  const [records, setRecords] = useState<BookkeepingRecord[]>([]);
  const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState<boolean>(false);

  // Edit or view state
  const [editingRecord, setEditingRecord] = useState<Partial<BookkeepingRecord> | null>(null);
  const [editingPhotoBase64, setEditingPhotoBase64] = useState<string | null>(null);
  const [selectedReportRecord, setSelectedReportRecord] = useState<BookkeepingRecord | null>(null);

  // Load database records and settings
  const loadData = async () => {
    try {
      const [allRecs, appSettings] = await Promise.all([getAllRecords(), getSettings()]);
      setRecords(allRecs);
      setSettingsState(appSettings);
    } catch (err) {
      console.error('Failed to load local data from IndexedDB:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Save or update record with optional photo
  const handleSaveRecord = async (record: BookkeepingRecord, photoBase64?: string) => {
    let fotoId = record.fotoAsliId;

    if (photoBase64) {
      fotoId = fotoId || `photo-${record.id}`;
      await savePhoto(fotoId, photoBase64);
      record.fotoAsliId = fotoId;
    }

    await saveRecord(record);
    await loadData();

    // Reset editing states
    setEditingRecord(null);
    setEditingPhotoBase64(null);

    // Switch to history or home
    setActiveTab('riwayat');
  };

  // Delete record
  const handleDeleteRecord = async (id: string) => {
    await deleteRecord(id);
    await loadData();
  };

  // Duplicate record
  const handleDuplicateRecord = async (sourceRecord: BookkeepingRecord) => {
    const newId = `rec-${Date.now()}`;
    const duplicated: BookkeepingRecord = {
      ...sourceRecord,
      id: newId,
      tanggal: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // If source had a photo, retrieve and duplicate it
    if (sourceRecord.fotoAsliId) {
      const p = await getPhoto(sourceRecord.fotoAsliId);
      if (p) {
        const newPhotoId = `photo-${newId}`;
        await savePhoto(newPhotoId, p);
        duplicated.fotoAsliId = newPhotoId;
      }
    }

    await saveRecord(duplicated);
    await loadData();
    setActiveTab('riwayat');
  };

  // Edit from history or review
  const handleEditRecord = async (record: BookkeepingRecord) => {
    setEditingRecord(record);
    if (record.fotoAsliId) {
      const p = await getPhoto(record.fotoAsliId);
      setEditingPhotoBase64(p);
    } else {
      setEditingPhotoBase64(null);
    }
    setActiveTab('manual');
  };

  // Edit from Scan view
  const handleEditFromScan = (partial: Partial<BookkeepingRecord>, photo?: string) => {
    setEditingRecord(partial);
    setEditingPhotoBase64(photo || null);
    setActiveTab('manual');
  };

  // View full report slip
  const handleViewReport = (record: BookkeepingRecord) => {
    setSelectedReportRecord(record);
  };

  // Save Settings
  const handleSaveSettings = async (newSettings: AppSettings) => {
    await saveSettings(newSettings);
    setSettingsState(newSettings);
  };

  // Load official sample simulation (2.5 ton = Rp91.600.000 bersih)
  const handleLoadSample = async () => {
    const sampleRecord: BookkeepingRecord = {
      id: `rec-simulasi-${Date.now()}`,
      tanggal: new Date().toISOString().split('T')[0],
      rumpon: 'Rumpon Nelayan Teluk 01 (Simulasi)',
      items: [
        {
          id: 'item-sim-1',
          namaIkan: 'Cakalang Super',
          beratKg: 1500,
          hargaPerKg: 40000,
          subtotal: 60000000,
          confidence: 'high',
        },
        {
          id: 'item-sim-2',
          namaIkan: 'Tuna Madidihang',
          beratKg: 1000,
          hargaPerKg: 40000,
          subtotal: 40000000,
          confidence: 'high',
        },
      ],
      totalBeratKg: 2500,
      totalTonase: 2.5,
      totalHarga: 100000000,
      totalHargaIsManual: false,

      // Rumus verification check:
      // Pemikul = 2.500 kg / 1.000 * 300k = 750k
      biayaPemikul: 750000,
      biayaPemikulIsManual: false,

      // ABK = 100M / 20M * 1M = 5M
      biayaAbk: 5000000,
      biayaAbkIsManual: false,

      // Bongkar = 1.4M + ((2.5 - 2) * 700k) = 1.75M
      biayaBongkar: 1750000,
      biayaBongkarIsManual: false,

      // Nyelam = (2.5 - 1) * 600k = 900k
      biayaNyelam: 900000,
      biayaNyelamIsManual: false,

      // Total Biaya = 750k + 5M + 1.75M + 900k = 8.4M
      totalBiaya: 8400000,
      // Bersih = 100M - 8.4M = 91.6M
      bersih: 91600000,

      keterangan: 'Contoh simulasi resmi: 2,5 Ton hasil tangkapan dengan total bersih Rp91.600.000.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveRecord(sampleRecord);
    await loadData();
    setSelectedReportRecord(sampleRecord);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0e17] flex flex-col items-center justify-center text-slate-300 space-y-3">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold tracking-wide">Memuat Catatan by Iswandi...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e17] text-slate-100 flex flex-col">
      {/* Top Application Bar */}
      <TopBar
        appName={settings.appName || 'CATATAN BY ISWANDI'}
        onOpenSettings={() => setActiveTab('pengaturan')}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-3.5 sm:px-4 pt-4 pb-20">
        {activeTab === 'beranda' && (
          <BerandaView
            records={records}
            onNavigate={(tab) => {
              if (tab === 'manual') {
                setEditingRecord(null);
                setEditingPhotoBase64(null);
              }
              setActiveTab(tab);
            }}
            onSelectRecord={handleViewReport}
            onLoadSample={handleLoadSample}
          />
        )}

        {activeTab === 'scan' && (
          <ScanCatatanView
            settings={settings}
            onSaveRecord={handleSaveRecord}
            onEditInForm={handleEditFromScan}
          />
        )}

        {activeTab === 'manual' && (
          <TambahManualView
            settings={settings}
            initialData={editingRecord}
            initialPhotoBase64={editingPhotoBase64}
            onSaveRecord={handleSaveRecord}
            onUpdateSettings={handleSaveSettings}
            onCancel={() => {
              setEditingRecord(null);
              setEditingPhotoBase64(null);
              setActiveTab('beranda');
            }}
          />
        )}

        {activeTab === 'riwayat' && (
          <RiwayatView
            records={records}
            onViewRecord={handleViewReport}
            onEditRecord={handleEditRecord}
            onDuplicateRecord={handleDuplicateRecord}
            onDeleteRecord={handleDeleteRecord}
            onShareRecord={handleViewReport}
          />
        )}

        {activeTab === 'pengaturan' && (
          <PengaturanView
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onReloadRecords={loadData}
            onOpenGitHub={() => setIsGitHubModalOpen(true)}
          />
        )}
      </main>

      {/* Fixed Ergonomic Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === 'manual' && activeTab !== 'manual') {
            setEditingRecord(null);
            setEditingPhotoBase64(null);
          }
          setActiveTab(tab);
        }}
      />

      {/* Report Slip Modal (View, Share, Download PDF / Image) */}
      {selectedReportRecord && (
        <ReportModal
          record={selectedReportRecord}
          settings={settings}
          onClose={() => setSelectedReportRecord(null)}
        />
      )}

      {/* Direct 1-Click Push to GitHub Modal */}
      <GitHubPushModal
        isOpen={isGitHubModalOpen}
        onClose={() => setIsGitHubModalOpen(false)}
      />
    </div>
  );
}
