import React, { useState, useMemo } from 'react';
import {
  Layers,
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  QrCode,
  Download,
  Printer,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  Building2,
  X,
  FileText,
  FileDown,
  Info,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { AlkesItem, DAFTAR_RUANGAN, KondisiAlatType, KeteranganAlatType, RuanganType, Teknisi } from '../types';
import { calculateNextCalibration, exportToCsv, normalizeDateString } from '../utils/syncEngine';
import { generateInventarisPdf } from '../utils/pdfGenerator';

interface InventarisViewProps {
  inventaris: AlkesItem[];
  currentTeknisi: Teknisi;
  ruanganList?: string[];
  onOpenRuanganModal?: () => void;
  onAddRuangan?: (name: string) => void;
  onSaveAlkes: (alkes: AlkesItem, isEdit: boolean) => void;
  onDeleteAlkes: (id: string) => void;
  onClearAllAlkes?: () => void;
  onRequestBap: (alkes: AlkesItem) => void;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  onOpenSyncModal?: () => void;
}

export const InventarisView: React.FC<InventarisViewProps> = ({
  inventaris = [],
  currentTeknisi,
  ruanganList: propRuanganList,
  onOpenRuanganModal,
  onAddRuangan,
  onSaveAlkes,
  onDeleteAlkes,
  onClearAllAlkes,
  onRequestBap,
  isModalOpen,
  setIsModalOpen,
  onOpenSyncModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRuangan, setSelectedRuangan] = useState<string>('SEMUA');
  const [selectedKondisi, setSelectedKondisi] = useState<string>('SEMUA');
  const [selectedKeterangan, setSelectedKeterangan] = useState<string>('SEMUA');

  // Master Ruangan List with fallback
  const [localRuanganList, setLocalRuanganList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sim_alkes_daftar_ruangan');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DAFTAR_RUANGAN;
  });

  const ruanganList = propRuanganList && propRuanganList.length > 0 ? propRuanganList : localRuanganList;

  // Admin Room Management States
  const [isAddingRoom, setIsAddingRoom] = useState(false);
  const [newRoomInput, setNewRoomInput] = useState('');
  const [isEditingRoom, setIsEditingRoom] = useState(false);
  const [editRoomInput, setEditRoomInput] = useState('');

  // Admin / Teknisi Check
  const isAdminOrTeknisi =
    currentTeknisi.role === 'admin' ||
    (currentTeknisi.role as string) === 'teknisi' ||
    currentTeknisi.username !== 'user';

  const handleAddNewRoom = (name: string) => {
    const trimmed = name.trim().toUpperCase();
    if (!trimmed) return;
    if (onAddRuangan) {
      onAddRuangan(trimmed);
    } else {
      if (!ruanganList.includes(trimmed)) {
        const next = [...ruanganList, trimmed];
        setLocalRuanganList(next);
        localStorage.setItem('sim_alkes_daftar_ruangan', JSON.stringify(next));
      }
    }
    setFormState((prev) => ({ ...prev, ruangan: trimmed }));
    setIsAddingRoom(false);
    setNewRoomInput('');
  };

  const handleEditRoom = (oldName: string, newName: string) => {
    const trimmed = newName.trim().toUpperCase();
    if (!trimmed || oldName === trimmed) {
      setIsEditingRoom(false);
      return;
    }
    if (!propRuanganList) {
      const next = ruanganList.map((r) => (r === oldName ? trimmed : r));
      setLocalRuanganList(next);
      localStorage.setItem('sim_alkes_daftar_ruangan', JSON.stringify(next));
    }
    if (formState.ruangan === oldName) {
      setFormState((prev) => ({ ...prev, ruangan: trimmed }));
    }
    setIsEditingRoom(false);
  };

  // Active item for Edit or QR Preview
  const [editingItem, setEditingItem] = useState<AlkesItem | null>(null);
  const [qrModalItem, setQrModalItem] = useState<AlkesItem | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<AlkesItem | null>(null);
  const [isClearAllConfirmOpen, setIsClearAllConfirmOpen] = useState(false);
  const [isCopiedQr, setIsCopiedQr] = useState(false);

  // Form State (Nomor Inventaris Barang / NIB dihapus sesuai instruksi)
  const [formState, setFormState] = useState<{
    id: string;
    ruangan: RuanganType;
    namaAlat: string;
    merk: string;
    modelType: string;
    serialNumber: string;
    tahunPengadaan: string;
    kalibrasiTerakhir: string;
    kalibrasiBerikutnya: string;
    kondisi: KondisiAlatType;
    keterangan: KeteranganAlatType;
    kategori: string;
    lokasiSpesifik: string;
  }>({
    id: '',
    ruangan: 'IGD',
    namaAlat: '',
    merk: '',
    modelType: '',
    serialNumber: '',
    tahunPengadaan: new Date().getFullYear().toString(),
    kalibrasiTerakhir: '',
    kalibrasiBerikutnya: '',
    kondisi: 'Baik',
    keterangan: 'Berfungsi',
    kategori: 'Elektromedik Diagnostik',
    lokasiSpesifik: '',
  });

  // When Kalibrasi Terakhir changes, auto-calculate Next Calibration (+1 Year) and update status
  const handleKalibrasiChange = (dateVal: string) => {
    const cleanDate = dateVal.trim();
    if (!cleanDate) {
      setFormState((prev) => ({
        ...prev,
        kalibrasiTerakhir: '',
        kalibrasiBerikutnya: '',
      }));
      return;
    }
    const { nextDate } = calculateNextCalibration(cleanDate);
    setFormState((prev) => ({
      ...prev,
      kalibrasiTerakhir: cleanDate,
      kalibrasiBerikutnya: nextDate,
    }));
  };

  const handleOpenAddModal = () => {
    setFormState({
      id: `ALKES-${Date.now().toString().slice(-6)}`,
      ruangan: 'IGD',
      namaAlat: '',
      merk: '',
      modelType: '',
      serialNumber: '',
      tahunPengadaan: new Date().getFullYear().toString(),
      kalibrasiTerakhir: '',
      kalibrasiBerikutnya: '',
      kondisi: 'Baik',
      keterangan: 'Berfungsi',
      kategori: 'Elektromedik Terapi / Diagnostik',
      lokasiSpesifik: '',
    });
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: AlkesItem) => {
    setEditingItem(item);
    const lastCal = normalizeDateString(item.kalibrasiTerakhir);
    let nextCal = normalizeDateString(item.kalibrasiBerikutnya);
    if (!nextCal && lastCal) {
      nextCal = calculateNextCalibration(lastCal).nextDate;
    }
    setFormState({
      id: item.id,
      ruangan: item.ruangan,
      namaAlat: item.namaAlat,
      merk: item.merk,
      modelType: item.modelType,
      serialNumber: item.serialNumber,
      tahunPengadaan: item.tahunPengadaan || '',
      kalibrasiTerakhir: lastCal,
      kalibrasiBerikutnya: nextCal,
      kondisi: item.kondisi,
      keterangan: item.keterangan,
      kategori: item.kategori || '',
      lokasiSpesifik: item.lokasiSpesifik || '',
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const { status } = calculateNextCalibration(formState.kalibrasiTerakhir);

    const alkesPayload: AlkesItem = {
      ...formState,
      statusKalibrasi: status,
      updatedAt: new Date().toISOString(),
      lastEditedBy: `${currentTeknisi.namaLengkap}, ${currentTeknisi.gelar}`,
    };

    onSaveAlkes(alkesPayload, !!editingItem);
    setIsModalOpen(false);

    // If 'Penarikan Alat' is selected, trigger BAP modal / notification
    if (formState.keterangan === 'Penarikan Alat') {
      onRequestBap(alkesPayload);
    }
  };

  // Filtered List
  const filteredList = useMemo(() => {
    return inventaris.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        item.namaAlat.toLowerCase().includes(q) ||
        item.ruangan.toLowerCase().includes(q) ||
        item.kondisi.toLowerCase().includes(q) ||
        item.serialNumber.toLowerCase().includes(q) ||
        item.merk.toLowerCase().includes(q) ||
        item.modelType.toLowerCase().includes(q) ||
        (item.statusKalibrasi && item.statusKalibrasi.toLowerCase().includes(q)) ||
        (item.keterangan && item.keterangan.toLowerCase().includes(q));

      const matchRuangan = selectedRuangan === 'SEMUA' || item.ruangan === selectedRuangan;
      const matchKondisi = selectedKondisi === 'SEMUA' || item.kondisi === selectedKondisi;
      const matchKeterangan = selectedKeterangan === 'SEMUA' || item.keterangan === selectedKeterangan;

      return matchSearch && matchRuangan && matchKondisi && matchKeterangan;
    });
  }, [inventaris, searchQuery, selectedRuangan, selectedKondisi, selectedKeterangan]);

  // Construct structured QR payload text (Format Rapi Standar IPSRS UPTD RSUD LAMADDUKELLENG)
  const getQrValue = (item: AlkesItem) => {
    return [
      'UPTD RSUD LAMADDUKELLENG',
      `ruangan: ${item.ruangan || '-'}`,
      `namaAlat: ${item.namaAlat || '-'}`,
      `merk: ${item.merk || '-'}`,
      `modelType: ${item.modelType || '-'}`,
      `sn: ${item.serialNumber || '-'}`,
      `thn Pengadaan: ${item.tahunPengadaan || '-'}`,
      `kalibrasi Terakhir: ${item.kalibrasiTerakhir || '-'}`,
      `kalibrasi Berikut: ${item.kalibrasiBerikutnya || '-'}`,
      `kondisi: ${item.kondisi || '-'}`,
      `keterangan: ${item.keterangan || '-'}`,
      'verifikasi: IPSRS ELEKTROMEDIS UPTD RSUD LAMADDUKELLENG',
    ].join('\n');
  };

  return (
    <div id="inventaris-view-container" className="space-y-6 pb-12">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-red-900/50 bg-zinc-900/90 p-5 sm:p-6 shadow-xl text-white">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-red-950 px-2.5 py-0.5 text-xs font-bold text-red-400 border border-red-800">
              MODUL 1: INVENTARIS ALKES
            </span>
            <span className="text-xs font-mono text-zinc-400">{ruanganList.length} RUANGAN TERDAFTAR</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
            Data Inventaris Alat Kesehatan UPTD RSUD LAMADDUKELLENG
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Master database peralatan medis lengkap dengan riwayat kalibrasi otomatis, QR Code Generator & Pelabelan.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {onOpenSyncModal && (
            <button
              id="btn-open-sync-from-inventaris"
              onClick={onOpenSyncModal}
              className="flex items-center gap-1.5 rounded-xl border border-red-800 bg-red-950/70 px-3.5 py-2 text-xs font-bold text-red-300 hover:bg-red-900/60 transition-all active:scale-95 shadow-sm"
              title="Buka Menu Sinkronisasi & Impor Data Google Spreadsheet"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
              <span>Sinkron / Impor Sheet</span>
            </button>
          )}

          <button
            id="btn-export-csv-inventaris"
            onClick={() => exportToCsv('inventaris', filteredList)}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-800 bg-emerald-950/70 px-3.5 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-900/60 transition-all active:scale-95"
            title="Download CSV Format Google Spreadsheet"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Export CSV</span>
          </button>

          <button
            id="btn-export-pdf-inventaris"
            onClick={() => generateInventarisPdf(filteredList, selectedRuangan === 'SEMUA' ? undefined : selectedRuangan)}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3.5 py-2 text-xs font-bold text-zinc-200 hover:bg-zinc-700 transition-all active:scale-95"
          >
            <Printer className="h-4 w-4 text-red-400" />
            <span>Cetak PDF</span>
          </button>

          {isAdminOrTeknisi && onOpenRuanganModal && (
            <button
              id="btn-kelola-ruangan-inventaris"
              onClick={onOpenRuanganModal}
              className="flex items-center gap-1.5 rounded-xl border border-amber-800/80 bg-amber-950/60 px-3.5 py-2 text-xs font-bold text-amber-300 hover:border-amber-600 hover:bg-amber-900/60 transition-all active:scale-95 shadow-sm"
              title="Kelola Master Data Ruangan (Tambah, Edit, Hapus)"
            >
              <Building2 className="h-4 w-4 text-amber-400" />
              <span>Kelola Ruangan</span>
            </button>
          )}

          {isAdminOrTeknisi && onClearAllAlkes && inventaris.length > 0 && (
            <button
              id="btn-clear-all-alkes"
              onClick={() => setIsClearAllConfirmOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-red-800/80 bg-red-950/70 px-3.5 py-2 text-xs font-bold text-red-300 hover:bg-red-900/70 transition-all active:scale-95"
              title="Kosongkan seluruh data inventaris alat kesehatan"
            >
              <Trash2 className="h-4 w-4 text-red-400" />
              <span>Kosongkan Data</span>
            </button>
          )}

          {isAdminOrTeknisi ? (
            <button
              id="btn-add-alkes-main"
              onClick={handleOpenAddModal}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-red-900/60 hover:from-red-500 hover:to-red-600 transition-all active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Data Alkes</span>
            </button>
          ) : (
            <span className="rounded-xl border border-blue-900/50 bg-blue-950/60 px-3 py-2 text-xs font-bold text-blue-300">
              Akses: Petugas Ruangan
            </span>
          )}
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <input
            id="input-search-alkes"
            type="text"
            placeholder="Cari nama alat, ruangan, kondisi (Baik/Rusak), SN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2 pl-9 pr-8 text-xs text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-white"
              title="Bersihkan pencarian"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Room Filter */}
        <div>
          <select
            id="select-filter-ruangan"
            value={selectedRuangan}
            onChange={(e) => setSelectedRuangan(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2 px-3 text-xs text-zinc-200 focus:border-red-500 focus:outline-none"
          >
            <option value="SEMUA">Semua Ruangan ({ruanganList.length} Ruangan)</option>
            {ruanganList.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* Condition Filter */}
        <div>
          <select
            id="select-filter-kondisi"
            value={selectedKondisi}
            onChange={(e) => setSelectedKondisi(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2 px-3 text-xs text-zinc-200 focus:border-red-500 focus:outline-none"
          >
            <option value="SEMUA">Semua Kondisi Alat</option>
            <option value="Baik">Kondisi: Baik</option>
            <option value="Rusak Ringan">Kondisi: Rusak Ringan</option>
            <option value="Rusak Sedang">Kondisi: Rusak Sedang</option>
            <option value="Rusak Berat">Kondisi: Rusak Berat</option>
          </select>
        </div>

        {/* Status / Remarks Filter */}
        <div>
          <select
            id="select-filter-keterangan"
            value={selectedKeterangan}
            onChange={(e) => setSelectedKeterangan(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2 px-3 text-xs text-zinc-200 focus:border-red-500 focus:outline-none"
          >
            <option value="SEMUA">Semua Keterangan</option>
            <option value="Berfungsi">Keterangan: Berfungsi</option>
            <option value="Perlu penggantian sparepart">Perlu Sparepart</option>
            <option value="Penarikan Alat">Penarikan Alat (BAP)</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 shadow-xl">
        <div className="overflow-x-auto">
          <table id="table-inventaris-alkes" className="w-full text-left text-xs text-zinc-300">
            <thead className="border-b border-red-900/60 bg-gradient-to-r from-red-950 via-zinc-900 to-black text-[11px] font-black uppercase tracking-wider text-red-300">
              <tr>
                <th className="py-3.5 pl-4 pr-2">No</th>
                <th className="px-3 py-3.5">Ruangan</th>
                <th className="px-3 py-3.5">Nama Alat & Spesifikasi</th>
                <th className="px-3 py-3.5">Serial Number (SN)</th>
                <th className="px-3 py-3.5">Tahun Beli</th>
                <th className="px-3 py-3.5">Kalibrasi Terakhir</th>
                <th className="px-3 py-3.5">Kalibrasi Berikutnya</th>
                <th className="px-3 py-3.5">Kondisi</th>
                <th className="px-3 py-3.5">Keterangan</th>
                <th className="px-3 py-3.5 text-center">QR Code</th>
                <th className="py-3.5 pl-2 pr-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-zinc-500">
                    <Info className="mx-auto h-8 w-8 text-zinc-600 mb-2" />
                    <p className="font-bold text-sm text-zinc-400">Tidak ada data alkes ditemukan</p>
                    <p className="text-xs">Coba sesuaikan kata kunci pencarian atau filter ruangan.</p>
                  </td>
                </tr>
              ) : (
                filteredList.map((item, index) => {
                  const isPenarikan = item.keterangan === 'Penarikan Alat';
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-zinc-800/60 transition-colors ${
                        isPenarikan ? 'bg-red-950/20' : ''
                      }`}
                    >
                      <td className="py-3 pl-4 pr-2 font-mono text-zinc-500">{index + 1}</td>
                      <td className="px-3 py-3">
                        <span className="inline-block rounded-lg bg-zinc-800 px-2 py-0.5 font-bold text-zinc-200 border border-zinc-700">
                          {item.ruangan}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-bold text-white text-sm">{item.namaAlat}</p>
                        <p className="text-[11px] text-zinc-400">
                          {item.merk} • {item.modelType}
                        </p>
                      </td>
                      <td className="px-3 py-3 font-mono font-bold text-zinc-300">{item.serialNumber}</td>
                      <td className="px-3 py-3 font-mono text-zinc-400">{item.tahunPengadaan || '-'}</td>
                      <td className="px-3 py-3">
                        <span className="font-mono text-zinc-300">{normalizeDateString(item.kalibrasiTerakhir) || '-'}</span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-cyan-400">
                            {normalizeDateString(item.kalibrasiBerikutnya) || '-'}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                              item.statusKalibrasi === 'Terkalibrasi'
                                ? 'text-emerald-400'
                                : 'text-red-400'
                            }`}
                          >
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            {item.statusKalibrasi}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                            item.kondisi === 'Baik'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : item.kondisi === 'Rusak Ringan'
                              ? 'bg-yellow-950 text-yellow-300 border border-yellow-800'
                              : item.kondisi === 'Rusak Sedang'
                              ? 'bg-orange-950 text-orange-300 border border-orange-800'
                              : 'bg-red-950 text-red-300 border border-red-800'
                          }`}
                        >
                          {item.kondisi}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-block rounded-lg px-2 py-0.5 text-[11px] font-bold ${
                            item.keterangan === 'Berfungsi'
                              ? 'bg-zinc-800 text-zinc-300'
                              : item.keterangan === 'Perlu penggantian sparepart'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800/50'
                              : 'bg-red-950 text-red-300 border border-red-700 animate-pulse'
                          }`}
                        >
                          {item.keterangan}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          id={`btn-view-qr-${item.id}`}
                          onClick={() => setQrModalItem(item)}
                          className="rounded-lg border border-red-900/60 bg-red-950/40 p-1.5 text-red-400 hover:border-red-500 hover:bg-red-900/60 hover:text-white transition-all shadow"
                          title="Lihat & Cetak Stiker QR Code"
                        >
                          <QrCode className="h-4 w-4" />
                        </button>
                      </td>
                      <td className="py-3 pl-2 pr-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isPenarikan && (
                            <button
                              id={`btn-bap-shortcut-${item.id}`}
                              onClick={() => onRequestBap(item)}
                              className="rounded-lg border border-red-800 bg-red-950/80 px-2 py-1 text-[11px] font-bold text-red-300 hover:bg-red-900 transition-colors flex items-center gap-1"
                              title="Buka / Buat Berita Acara Penarikan"
                            >
                              <FileText className="h-3 w-3" />
                              <span>BAP</span>
                            </button>
                          )}
                          {isAdminOrTeknisi ? (
                            <>
                              <button
                                id={`btn-edit-alkes-${item.id}`}
                                onClick={() => handleOpenEditModal(item)}
                                className="rounded-lg border border-zinc-700 bg-zinc-800 p-1.5 text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
                                title="Edit Data Alkes"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                id={`btn-delete-alkes-${item.id}`}
                                onClick={() => setDeleteConfirmItem(item)}
                                className="rounded-lg border border-red-900/40 bg-zinc-800 p-1.5 text-red-400 hover:border-red-600 hover:bg-red-950 hover:text-red-200 transition-colors"
                                title="Hapus Data Alkes"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              id={`btn-view-alkes-${item.id}`}
                              onClick={() => handleOpenEditModal(item)}
                              className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-[11px] font-semibold text-zinc-300 hover:text-white"
                              title="Lihat Detail Alkes"
                            >
                              Detail
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-950 px-4 py-3 text-xs text-zinc-400">
          <span>
            Menampilkan <strong className="text-white">{filteredList.length}</strong> dari{' '}
            <strong className="text-white">{inventaris.length}</strong> total inventaris
          </span>
          <span className="font-mono text-[11px]">UPTD RSUD LAMADDUKELLENG • ELEKTROMEDIS</span>
        </div>
      </div>

      {/* MODAL 1: ADD / EDIT ALKES */}
      {isModalOpen && (
        <div
          id="modal-alkes-form"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
        >
          <div className="relative w-full max-w-2xl rounded-3xl border border-red-900/70 bg-zinc-900 p-6 shadow-2xl text-white my-8">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-950 text-red-400 border border-red-800">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    {editingItem ? 'Edit Data Inventaris Alkes' : 'Tambah Inventaris Alkes Baru'}
                  </h3>
                  <p className="text-xs text-zinc-400">Form inventarisasi peralatan elektromedis UPTD RSUD LAMADDUKELLENG</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl border border-zinc-800 p-1.5 text-zinc-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Ruangan with Admin / Teknisi Add & Edit controls */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
                      Ruangan <span className="text-red-500">*</span>
                    </label>
                    {isAdminOrTeknisi && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingRoom(true);
                            setIsEditingRoom(false);
                            setNewRoomInput('');
                          }}
                          className="text-[11px] font-bold text-red-400 hover:text-red-300 underline cursor-pointer"
                          title="Tambah unit/ruangan baru ke database"
                        >
                          + Input Ruangan
                        </button>
                        <span className="text-zinc-600">•</span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingRoom(true);
                            setIsAddingRoom(false);
                            setEditRoomInput(formState.ruangan);
                          }}
                          className="text-[11px] font-bold text-orange-400 hover:text-orange-300 underline cursor-pointer"
                          title="Ganti/edit nama ruangan yang dipilih"
                        >
                          ✏️ Edit
                        </button>
                        {onOpenRuanganModal && (
                          <>
                            <span className="text-zinc-600">•</span>
                            <button
                              type="button"
                              onClick={onOpenRuanganModal}
                              className="text-[11px] font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer"
                              title="Buka menu kelola master ruangan (tambah, edit, hapus)"
                            >
                              Kelola / Hapus
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {isAddingRoom && isAdminOrTeknisi ? (
                    <div className="p-2.5 rounded-xl border border-red-700 bg-red-950/40 space-y-2">
                      <p className="text-[10px] font-bold text-red-300">Tambah Unit / Ruangan Baru:</p>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          placeholder="Nama Ruangan Baru (misal: ICU SENTRAL)..."
                          value={newRoomInput}
                          onChange={(e) => setNewRoomInput(e.target.value)}
                          className="flex-1 rounded-lg border border-red-600 bg-zinc-950 px-2.5 py-1.5 text-xs text-white uppercase font-bold"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddNewRoom(newRoomInput);
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleAddNewRoom(newRoomInput)}
                          className="rounded-lg bg-red-700 hover:bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs cursor-pointer"
                        >
                          Simpan
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingRoom(false);
                            setNewRoomInput('');
                          }}
                          className="rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : isEditingRoom && isAdminOrTeknisi ? (
                    <div className="p-2.5 rounded-xl border border-orange-700 bg-orange-950/40 space-y-2">
                      <p className="text-[10px] font-bold text-orange-300">
                        Edit / Ganti Nama Ruangan (<strong className="text-white">{formState.ruangan}</strong>):
                      </p>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={editRoomInput}
                          onChange={(e) => setEditRoomInput(e.target.value)}
                          className="flex-1 rounded-lg border border-orange-600 bg-zinc-950 px-2.5 py-1.5 text-xs text-white uppercase font-bold"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleEditRoom(formState.ruangan, editRoomInput);
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleEditRoom(formState.ruangan, editRoomInput)}
                          className="rounded-lg bg-orange-600 hover:bg-orange-500 px-3 py-1.5 text-xs font-bold text-white shadow-xs cursor-pointer"
                        >
                          Perbarui
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingRoom(false)}
                          className="rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <select
                      required
                      value={formState.ruangan}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__ADD_NEW_ROOM__') {
                          setIsAddingRoom(true);
                          setIsEditingRoom(false);
                          setNewRoomInput('');
                        } else if (val === '__EDIT_CURRENT_ROOM__') {
                          setIsEditingRoom(true);
                          setIsAddingRoom(false);
                          setEditRoomInput(formState.ruangan);
                        } else if (val) {
                          setFormState({ ...formState, ruangan: val as RuanganType });
                        }
                      }}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 px-3 text-xs text-white focus:border-red-500 focus:outline-none"
                    >
                      {ruanganList.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                      {isAdminOrTeknisi && (
                        <>
                          <option disabled value="">──────────────</option>
                          <option value="__ADD_NEW_ROOM__" className="font-bold text-red-400">
                            ➕ + Input Ruangan Baru...
                          </option>
                          <option value="__EDIT_CURRENT_ROOM__" className="font-bold text-orange-400">
                            ✏️ Edit Ruangan ({formState.ruangan})...
                          </option>
                        </>
                      )}
                    </select>
                  )}
                </div>

                {/* Nama Alat */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
                    Nama Alat Kesehatan <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Defibrillator Biphasic, Ventilator..."
                    value={formState.namaAlat}
                    onChange={(e) => setFormState({ ...formState, namaAlat: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 px-3 text-xs text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none"
                  />
                </div>

                {/* Merk */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
                    Merk / Brand <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Mindray, GE, Nihon Kohden..."
                    value={formState.merk}
                    onChange={(e) => setFormState({ ...formState, merk: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 px-3 text-xs text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none"
                  />
                </div>

                {/* Model / Type */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
                    Model / Type <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: BeneHeart D3, Carestation 620..."
                    value={formState.modelType}
                    onChange={(e) => setFormState({ ...formState, modelType: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 px-3 text-xs text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none"
                  />
                </div>

                {/* Serial Number */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
                    Serial Number (SN) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="SN pada nameplate alat..."
                    value={formState.serialNumber}
                    onChange={(e) => setFormState({ ...formState, serialNumber: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 px-3 text-xs font-mono text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none"
                  />
                </div>

                {/* Tahun Pengadaan */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
                    Tahun Pengadaan
                  </label>
                  <input
                    type="text"
                    placeholder="2022"
                    value={formState.tahunPengadaan}
                    onChange={(e) => setFormState({ ...formState, tahunPengadaan: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 px-3 text-xs text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none"
                  />
                </div>

                {/* Kalibrasi Terakhir */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
                      Kalibrasi Terakhir <span className="text-zinc-500 font-normal">(Opsional)</span>
                    </label>
                    {formState.kalibrasiTerakhir && (
                      <button
                        type="button"
                        onClick={() => handleKalibrasiChange('')}
                        className="text-[11px] text-red-400 hover:text-red-300 font-semibold underline"
                      >
                        Hapus Tanggal
                      </button>
                    )}
                  </div>
                  <input
                    type="date"
                    value={formState.kalibrasiTerakhir}
                    onChange={(e) => handleKalibrasiChange(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 px-3 text-xs text-white focus:border-red-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    *Boleh dikosongkan jika alat baru / belum ada jadwal kalibrasi.
                  </p>
                </div>

                {/* Kalibrasi Berikutnya (Otomatis) */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-cyan-400 mb-1">
                    Kalibrasi Berikutnya (Otomatis)
                  </label>
                  <input
                    type="text"
                    readOnly
                    placeholder={formState.kalibrasiTerakhir ? '' : 'Otomatis terisi jika ada tanggal kalibrasi terakhir'}
                    value={formState.kalibrasiBerikutnya || '-'}
                    className="w-full rounded-xl border border-cyan-800/60 bg-cyan-950/40 py-2.5 px-3 text-xs font-mono font-bold text-cyan-300 cursor-not-allowed placeholder-cyan-600/60"
                  />
                  <p className="text-[10px] text-cyan-400/80 mt-0.5">
                    {formState.kalibrasiTerakhir
                      ? '*Otomatis +1 Tahun (365 hari) sesuai standar BPFK / Kemenkes'
                      : '*Status alat otomatis menjadi "Perlu Kalibrasi" jika dikosongkan'}
                  </p>
                </div>

                {/* Kondisi Alat */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
                    Kondisi Alat <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formState.kondisi}
                    onChange={(e) => setFormState({ ...formState, kondisi: e.target.value as KondisiAlatType })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 px-3 text-xs text-white focus:border-red-500 focus:outline-none"
                  >
                    <option value="Baik">Baik (Berfungsi Normal)</option>
                    <option value="Rusak Ringan">Rusak Ringan (Bisa Digunakan Terbatas)</option>
                    <option value="Rusak Sedang">Rusak Sedang (Membutuhkan Perbaikan)</option>
                    <option value="Rusak Berat">Rusak Berat (Tidak Berfungsi)</option>
                  </select>
                </div>

                {/* Keterangan */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
                    Keterangan <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formState.keterangan}
                    onChange={(e) => setFormState({ ...formState, keterangan: e.target.value as KeteranganAlatType })}
                    className={`w-full rounded-xl border py-2.5 px-3 text-xs font-bold focus:outline-none ${
                      formState.keterangan === 'Penarikan Alat'
                        ? 'border-red-500 bg-red-950 text-red-200 ring-1 ring-red-500'
                        : 'border-zinc-700 bg-zinc-950 text-white focus:border-red-500'
                    }`}
                  >
                    <option value="Berfungsi">Berfungsi</option>
                    <option value="Perlu penggantian sparepart">Perlu penggantian sparepart</option>
                    <option value="Penarikan Alat">Penarikan Alat (BAP / Mutasi / Evaluasi)</option>
                  </select>
                  {formState.keterangan === 'Penarikan Alat' && (
                    <p className="text-[10px] text-red-400 font-bold mt-1 animate-pulse">
                      ⚠️ Notifikasi: Sistem akan memicu pembuatan Berita Acara Penarikan Alkes otomatis!
                    </p>
                  )}
                </div>
              </div>

              {/* Extra Details */}
              <div className="pt-2 border-t border-zinc-800">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">
                    Lokasi Spesifik / Bed (Opsional)
                  </label>
                  <input
                    type="text"
                    value={formState.lokasiSpesifik}
                    onChange={(e) => setFormState({ ...formState, lokasiSpesifik: e.target.value })}
                    placeholder="Contoh: Bed 1, Meja Operasi Mayor, Lemari Alat..."
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 px-3 text-xs text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-xs font-bold text-zinc-300 hover:bg-zinc-700"
                >
                  Batal
                </button>
                <button
                  id="btn-save-alkes-submit"
                  type="submit"
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-red-700 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-900/50 hover:from-red-500 hover:to-red-600"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Simpan Data Alkes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: QR CODE STICKER PREVIEW & PRINT */}
      {qrModalItem && (
        <div
          id="modal-qr-preview"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
          <div className="relative w-full max-w-xl rounded-3xl border border-red-900/80 bg-zinc-900 p-5 sm:p-6 shadow-2xl text-white text-center">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-red-500" />
                <h3 className="text-sm font-black text-white">Stiker Label QR Code Inventaris</h3>
              </div>
              <button
                onClick={() => setQrModalItem(null)}
                className="rounded-xl border border-zinc-800 p-1.5 text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Printable Label Card with Professional Key-Value Grid Layout */}
            <div
              id="printable-qr-sticker"
              className="rounded-2xl border-2 border-red-900 bg-white p-4 sm:p-5 text-zinc-900 shadow-xl text-left"
            >
              {/* Header Label: UPTD RSUD LAMADDUKELLENG */}
              <div className="border-b-2 border-red-900 pb-2 mb-3 text-center">
                <p className="text-xs sm:text-sm font-black uppercase tracking-wider text-red-900 leading-tight">
                  UPTD RSUD LAMADDUKELLENG
                </p>
                <p className="text-[9px] sm:text-[10px] font-bold text-zinc-600 tracking-wide mt-0.5">
                  INSTALASI ELEKTROMEDIS (IPSRS) • KAB. WAJO
                </p>
              </div>

              {/* QR and Key-Value Grid Body */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 py-1">
                {/* QR Code Container */}
                <div className="shrink-0 flex flex-col items-center">
                  <div className="bg-white p-2 rounded-xl border border-zinc-300 shadow-sm">
                    <QRCodeSVG value={getQrValue(qrModalItem)} size={125} level="M" />
                  </div>
                  <span className="mt-1.5 font-mono text-[9px] font-bold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                    ID: {qrModalItem.id}
                  </span>
                </div>

                {/* Vertical Key-Value Grid */}
                <div className="min-w-0 flex-1 w-full grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-1 text-[10px] sm:text-[10.5px] leading-snug font-sans">
                  <span className="font-semibold text-zinc-500 whitespace-nowrap">ruangan:</span>
                  <span className="font-bold text-red-950 font-mono truncate">{qrModalItem.ruangan || '-'}</span>

                  <span className="font-semibold text-zinc-500 whitespace-nowrap">namaAlat:</span>
                  <span className="font-black text-zinc-900 truncate">{qrModalItem.namaAlat || '-'}</span>

                  <span className="font-semibold text-zinc-500 whitespace-nowrap">merk:</span>
                  <span className="font-medium text-zinc-800 truncate">{qrModalItem.merk || '-'}</span>

                  <span className="font-semibold text-zinc-500 whitespace-nowrap">modelType:</span>
                  <span className="font-medium text-zinc-800 truncate">{qrModalItem.modelType || '-'}</span>

                  <span className="font-semibold text-zinc-500 whitespace-nowrap">sn:</span>
                  <span className="font-bold text-zinc-900 font-mono truncate">{qrModalItem.serialNumber || '-'}</span>

                  <span className="font-semibold text-zinc-500 whitespace-nowrap">thn Pengadaan:</span>
                  <span className="font-medium text-zinc-800">{qrModalItem.tahunPengadaan || '-'}</span>

                  <span className="font-semibold text-zinc-500 whitespace-nowrap">kalibrasi Terakhir:</span>
                  <span className="font-medium text-zinc-800 font-mono">{qrModalItem.kalibrasiTerakhir || '-'}</span>

                  <span className="font-semibold text-zinc-500 whitespace-nowrap">kalibrasi Berikut:</span>
                  <span className="font-bold text-emerald-800 font-mono">{qrModalItem.kalibrasiBerikutnya || '-'}</span>

                  <span className="font-semibold text-zinc-500 whitespace-nowrap">kondisi:</span>
                  <span className="font-bold text-zinc-900">{qrModalItem.kondisi || '-'}</span>

                  <span className="font-semibold text-zinc-500 whitespace-nowrap">keterangan:</span>
                  <span className="font-medium text-zinc-800">{qrModalItem.keterangan || '-'}</span>
                </div>
              </div>

              {/* Footer Stamp / Verification */}
              <div className="border-t border-zinc-300 pt-2 mt-3 flex items-center justify-between text-[8.5px] font-mono">
                <span className="font-bold text-red-900 tracking-wide uppercase">
                  verifikasi: IPSRS ELEKTROMEDIS UPTD RSUD LAMADDUKELLENG
                </span>
                <span className="text-zinc-500 font-mono font-bold">STIKER RESMI</span>
              </div>
            </div>

            {/* Formatted QR Payload Content Preview & Copy */}
            <div className="mt-3.5 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-left">
              <div className="flex items-center justify-between mb-1.5 pb-1.5 border-b border-zinc-800/80">
                <span className="text-[10px] font-bold text-zinc-300 flex items-center gap-1.5">
                  <QrCode className="h-3.5 w-3.5 text-red-400" />
                  Data Teks Terenkripsi QR (Format Rapi)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(getQrValue(qrModalItem));
                    setIsCopiedQr(true);
                    setTimeout(() => setIsCopiedQr(false), 2000);
                  }}
                  className="flex items-center gap-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 text-[10px] font-bold text-zinc-200 transition-colors"
                >
                  {isCopiedQr ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span className="text-emerald-400">Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Salin Teks</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="font-mono text-[10px] leading-relaxed text-zinc-300 bg-zinc-900/90 p-2.5 rounded-xl border border-zinc-800/80 overflow-x-auto whitespace-pre-wrap select-all">
                {getQrValue(qrModalItem)}
              </pre>
            </div>

            {/* Actions */}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-red-700 hover:bg-red-600 py-2.5 text-xs font-bold text-white shadow transition-all"
              >
                <Printer className="h-4 w-4" />
                <span>Cetak Label Stiker</span>
              </button>
              <button
                onClick={() => setQrModalItem(null)}
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-xs font-bold text-zinc-300 hover:bg-zinc-700"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE CONFIRMATION */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm rounded-3xl border border-red-800 bg-zinc-900 p-6 shadow-2xl text-white text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-950 text-red-500 border border-red-800">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-base font-black text-white">Konfirmasi Hapus Alkes</h3>
            <p className="text-xs text-zinc-400 mt-2">
              Apakah Anda yakin ingin menghapus data alat:{' '}
              <strong className="text-white">{deleteConfirmItem.namaAlat}</strong> (SN:{' '}
              {deleteConfirmItem.serialNumber}) dari {deleteConfirmItem.ruangan}?
            </p>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setDeleteConfirmItem(null)}
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 text-xs font-bold text-zinc-300 hover:bg-zinc-700"
              >
                Batal
              </button>
              <button
                id="btn-confirm-delete-alkes"
                onClick={() => {
                  onDeleteAlkes(deleteConfirmItem.id);
                  setDeleteConfirmItem(null);
                }}
                className="flex-1 rounded-xl bg-red-700 hover:bg-red-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-900/50"
              >
                Ya, Hapus Data
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL 4: CLEAR ALL INVENTARIS CONFIRMATION */}
      {isClearAllConfirmOpen && onClearAllAlkes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm rounded-3xl border border-red-800 bg-zinc-900 p-6 shadow-2xl text-white text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-950 text-red-500 border border-red-800">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-base font-black text-white">Kosongkan Data Inventaris?</h3>
            <p className="text-xs text-zinc-400 mt-2">
              Seluruh <strong className="text-white">{inventaris.length} data inventaris alkes</strong> akan dihapus dari tampilan, penyimpanan lokal, server, dan database Firestore. Tindakan ini tidak dapat dibatalkan.
            </p>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setIsClearAllConfirmOpen(false)}
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 text-xs font-bold text-zinc-300 hover:bg-zinc-700"
              >
                Batal
              </button>
              <button
                id="btn-confirm-clear-all-alkes"
                onClick={() => {
                  onClearAllAlkes();
                  setIsClearAllConfirmOpen(false);
                }}
                className="flex-1 rounded-xl bg-red-700 hover:bg-red-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-900/50"
              >
                Ya, Kosongkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
