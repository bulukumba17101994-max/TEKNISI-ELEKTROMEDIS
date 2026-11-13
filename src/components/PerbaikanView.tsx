import React, { useState, useMemo, useEffect } from 'react';
import {
  Wrench,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Building2,
  FileSpreadsheet,
  X,
  Info,
  DollarSign,
  MessageSquare,
} from 'lucide-react';
import {
  AlkesItem,
  DAFTAR_RUANGAN,
  DAFTAR_STATUS_PERBAIKAN,
  PerbaikanItem,
  PerbaikanComment,
  RuanganType,
  StatusPerbaikanType,
  Teknisi,
} from '../types';
import { generatePerbaikanPdf, generatePerbaikanListPdf } from '../utils/pdfGenerator';
import { exportToCsv } from '../utils/syncEngine';
import { AlkesPickerModal } from './AlkesPickerModal';
import { DetailPerbaikanModal } from './DetailPerbaikanModal';

interface PerbaikanViewProps {
  perbaikan: PerbaikanItem[];
  inventaris: AlkesItem[];
  currentTeknisi: Teknisi;
  ruanganList?: string[];
  onOpenRuanganModal?: () => void;
  onSavePerbaikan: (item: PerbaikanItem, isEdit: boolean) => void;
  onDeletePerbaikan: (id: string) => void;
  onRequestBap: (alkes: any) => void;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  onAddComment?: (
    perbaikanId: string,
    comment: PerbaikanComment,
    updatedStatus?: StatusPerbaikanType
  ) => void;
  onUpdateStatus?: (perbaikanId: string, status: StatusPerbaikanType) => void;
  theme?: 'light' | 'dark';
  initialThreadItem?: PerbaikanItem | null;
  onClearInitialThreadItem?: () => void;
}

export const PerbaikanView: React.FC<PerbaikanViewProps> = ({
  perbaikan = [],
  inventaris = [],
  currentTeknisi,
  ruanganList = [],
  onOpenRuanganModal,
  onSavePerbaikan,
  onDeletePerbaikan,
  onRequestBap,
  isModalOpen,
  setIsModalOpen,
  onAddComment,
  onUpdateStatus,
  theme,
  initialThreadItem,
  onClearInitialThreadItem,
}) => {
  const isLight = theme === 'light' || (typeof document !== 'undefined' && document.documentElement.classList.contains('light'));
  const activeRuanganList = ruanganList.length > 0 ? ruanganList : DAFTAR_RUANGAN;

  const [searchQuery, setSearchQuery] = useState('');
  const [filterRuangan, setFilterRuangan] = useState('SEMUA');
  const [filterStatus, setFilterStatus] = useState('SEMUA');
  const [filterThread, setFilterThread] = useState<'SEMUA' | 'DENGAN_KOMENTAR' | 'BELUM_ADA_KOMENTAR'>('SEMUA');

  const [editingItem, setEditingItem] = useState<PerbaikanItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isAlkesPickerOpen, setIsAlkesPickerOpen] = useState(false);
  const [selectedThreadItem, setSelectedThreadItem] = useState<PerbaikanItem | null>(initialThreadItem || null);

  // Sync when initialThreadItem prop changes from parent (e.g. Dashboard shortcut)
  useEffect(() => {
    if (initialThreadItem) {
      setSelectedThreadItem(initialThreadItem);
    }
  }, [initialThreadItem]);

  // Synchronize active thread item with latest perbaikan state
  const activeThreadItem = useMemo(() => {
    if (!selectedThreadItem) return null;
    return perbaikan.find((p) => p.id === selectedThreadItem.id) || selectedThreadItem;
  }, [selectedThreadItem, perbaikan]);

  const [formState, setFormState] = useState<{
    id: string;
    nomorSpk: string;
    tanggal: string;
    pelapor: string;
    ruangan: RuanganType;
    alkesId: string;
    namaAlat: string;
    merk: string;
    modelType: string;
    serialNumber: string;
    keluhanKerusakan: string;
    analisisTeknisi: string;
    tindakanPerbaikan: string;
    sparepartDiganti: string;
    biayaEstimasi: number;
    teknisiPelaksana: string;
    statusPerbaikan: StatusPerbaikanType;
  }>({
    id: '',
    nomorSpk: '',
    tanggal: new Date().toISOString().slice(0, 10),
    pelapor: '',
    ruangan: 'IGD',
    alkesId: '',
    namaAlat: '',
    merk: '',
    modelType: '',
    serialNumber: '',
    keluhanKerusakan: '',
    analisisTeknisi: '',
    tindakanPerbaikan: '',
    sparepartDiganti: '',
    biayaEstimasi: 0,
    teknisiPelaksana: `${currentTeknisi.namaLengkap}, ${currentTeknisi.gelar}`,
    statusPerbaikan: 'Selesai (Alat Normal)',
  });

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormState({
      id: `SPK-${Date.now().toString().slice(-6)}`,
      nomorSpk: `SPK-ELMED/RSUD-SW/${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`,
      tanggal: new Date().toISOString().slice(0, 10),
      pelapor: currentTeknisi.role === 'user' ? 'Petugas Ruangan' : '',
      ruangan: 'IGD',
      alkesId: '',
      namaAlat: '',
      merk: '',
      modelType: '',
      serialNumber: '',
      keluhanKerusakan: '',
      analisisTeknisi: '',
      tindakanPerbaikan: '',
      sparepartDiganti: '',
      biayaEstimasi: 0,
      teknisiPelaksana:
        currentTeknisi.role === 'user'
          ? 'Musmuliadi, SKM.M.M'
          : `${currentTeknisi.namaLengkap}, ${currentTeknisi.gelar}`,
      statusPerbaikan: currentTeknisi.role === 'user' ? 'Dalam Proses' : 'Selesai (Alat Normal)',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: PerbaikanItem) => {
    setEditingItem(item);
    setFormState({
      id: item.id,
      nomorSpk: item.nomorSpk,
      tanggal: item.tanggal,
      pelapor: item.pelapor,
      ruangan: item.ruangan,
      alkesId: item.alkesId || '',
      namaAlat: item.namaAlat,
      merk: item.merk,
      modelType: item.modelType,
      serialNumber: item.serialNumber,
      keluhanKerusakan: item.keluhanKerusakan,
      analisisTeknisi: item.analisisTeknisi,
      tindakanPerbaikan: item.tindakanPerbaikan,
      sparepartDiganti: item.sparepartDiganti || '',
      biayaEstimasi: item.biayaEstimasi || 0,
      teknisiPelaksana: item.teknisiPelaksana,
      statusPerbaikan: item.statusPerbaikan,
    });
    setIsModalOpen(true);
  };

  const handleSelectAlkes = (alkesId: string) => {
    if (!alkesId) {
      setFormState((prev) => ({ ...prev, alkesId: '' }));
      return;
    }
    const found = inventaris.find((i) => i.id === alkesId);
    if (found) {
      setFormState((prev) => ({
        ...prev,
        alkesId: found.id,
        ruangan: found.ruangan,
        namaAlat: found.namaAlat,
        merk: found.merk,
        modelType: found.modelType,
        serialNumber: found.serialNumber,
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalNomorSpk =
      formState.nomorSpk ||
      `SPK-ELMED/RSUD-SW/${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`;

    const isUserAccount = currentTeknisi.role === 'user';

    const payload: PerbaikanItem = {
      ...formState,
      nomorSpk: finalNomorSpk,
      statusPerbaikan:
        isUserAccount && !editingItem
          ? 'Dalam Proses'
          : formState.statusPerbaikan || 'Dalam Proses',
      analisisTeknisi:
        isUserAccount && !formState.analisisTeknisi
          ? 'Dalam antrean pemeriksaan teknisi'
          : formState.analisisTeknisi || '',
      tindakanPerbaikan:
        isUserAccount && !formState.tindakanPerbaikan
          ? 'Menunggu penanganan teknisi elektromedis'
          : formState.tindakanPerbaikan || '',
      sparepartDiganti: formState.sparepartDiganti || '',
      biayaEstimasi: formState.biayaEstimasi || 0,
      updatedAt: new Date().toISOString(),
    };
    onSavePerbaikan(payload, !!editingItem);
    setIsModalOpen(false);

    if (payload.statusPerbaikan === 'Rekomendasi Penarikan') {
      onRequestBap({
        id: payload.alkesId || `ALKES-${Date.now().toString().slice(-6)}`,
        ruangan: payload.ruangan,
        namaAlat: payload.namaAlat,
        merk: payload.merk,
        modelType: payload.modelType,
        serialNumber: payload.serialNumber,
        kondisi: 'Rusak Berat',
        keterangan: 'Penarikan Alat',
      });
    }
  };

  const filteredList = useMemo(() => {
    return perbaikan.filter((item) => {
      const matchSearch =
        item.namaAlat.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.nomorSpk.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.pelapor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.ruangan.toLowerCase().includes(searchQuery.toLowerCase());

      const matchRuangan = filterRuangan === 'SEMUA' || item.ruangan === filterRuangan;
      const matchStatus = filterStatus === 'SEMUA' || item.statusPerbaikan === filterStatus;

      const hasComments = item.comments && item.comments.length > 0;
      const matchThread =
        filterThread === 'SEMUA'
          ? true
          : filterThread === 'DENGAN_KOMENTAR'
          ? hasComments
          : !hasComments;

      return matchSearch && matchRuangan && matchStatus && matchThread;
    });
  }, [perbaikan, searchQuery, filterRuangan, filterStatus, filterThread]);

  const totalWithComments = useMemo(() => {
    return perbaikan.filter((p) => p.comments && p.comments.length > 0).length;
  }, [perbaikan]);

  return (
    <div id="perbaikan-view-container" className="space-y-6 pb-12">
      {/* Header */}
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl p-5 sm:p-6 shadow-xl transition-colors ${
          isLight
            ? 'bg-white border-2 border-slate-300 text-black'
            : 'bg-zinc-900/90 border border-red-900/50 text-white'
        }`}
      >
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-lg px-2.5 py-0.5 text-xs font-black uppercase border ${
                isLight
                  ? 'bg-orange-100 text-orange-900 border-orange-300'
                  : 'bg-orange-950 text-orange-400 border-orange-800'
              }`}
            >
              MODUL 3: FORM PERBAIKAN ALKES
            </span>
            <span className={`text-xs font-mono font-bold ${isLight ? 'text-black' : 'text-zinc-400'}`}>
              WORK ORDER / CORRECTIVE MAINTENANCE
            </span>
          </div>
          <h1 className={`text-xl sm:text-2xl font-black mt-1 ${isLight ? 'text-black' : 'text-white'}`}>
            Lembar Kerja Perbaikan Alat Kesehatan UPTD RSUD LAMADDUKELLENG
          </h1>
          <p className={`text-xs mt-1 font-medium ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
            Penanganan keluhan kerusakan alat medis, komunikasi langsung melalui thread komentar & pergantian suku cadang.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            id="btn-export-perbaikan-pdf"
            onClick={() => generatePerbaikanListPdf(filteredList, filterRuangan)}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all active:scale-95 cursor-pointer border ${
              isLight
                ? 'bg-red-50 border-red-300 text-red-900 hover:bg-red-100'
                : 'border-red-800 bg-red-950/70 text-red-300 hover:bg-red-900/60'
            }`}
            title="Download Dokumen Resmi PDF Laporan Perbaikan"
          >
            <Printer className="h-4 w-4" />
            <span>Cetak PDF Laporan</span>
          </button>

          <button
            id="btn-export-perbaikan-csv"
            onClick={() => exportToCsv('perbaikan', filteredList)}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all active:scale-95 cursor-pointer border ${
              isLight
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100'
                : 'border-emerald-800 bg-emerald-950/70 text-emerald-300 hover:bg-emerald-900/60'
            }`}
            title="Download CSV Perbaikan"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Export CSV</span>
          </button>

          <button
            id="btn-add-perbaikan-main"
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-600 to-red-700 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-orange-950 hover:from-orange-500 hover:to-red-600 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>{currentTeknisi.role === 'user' ? '+ Lapor Kerusakan Alat' : '+ Buat Form Perbaikan'}</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-2xl p-4 border transition-colors ${
          isLight ? 'bg-white border-slate-300 text-black shadow-xs' : 'border-zinc-800 bg-zinc-900/70 text-white'
        }`}
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <input
            id="input-search-perbaikan"
            type="text"
            placeholder="Cari SPK, alat, SN, pelapor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full rounded-xl py-2 pl-9 pr-3 text-xs focus:outline-none border ${
              isLight
                ? 'border-slate-300 bg-slate-50 text-black placeholder-slate-400 focus:bg-white focus:border-red-600 font-medium'
                : 'border-zinc-700 bg-zinc-950 text-white placeholder-zinc-500 focus:border-orange-500'
            }`}
          />
        </div>

        <div>
          <select
            value={filterRuangan}
            onChange={(e) => setFilterRuangan(e.target.value)}
            className={`w-full rounded-xl py-2 px-3 text-xs font-semibold border focus:outline-none ${
              isLight
                ? 'border-slate-300 bg-slate-50 text-black focus:bg-white focus:border-red-600'
                : 'border-zinc-700 bg-zinc-950 text-zinc-200 focus:border-orange-500'
            }`}
          >
            <option value="SEMUA">Semua Ruangan ({activeRuanganList.length} Ruangan)</option>
            {activeRuanganList.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={`w-full rounded-xl py-2 px-3 text-xs font-semibold border focus:outline-none ${
              isLight
                ? 'border-slate-300 bg-slate-50 text-black focus:bg-white focus:border-red-600'
                : 'border-zinc-700 bg-zinc-950 text-zinc-200 focus:border-orange-500'
            }`}
          >
            <option value="SEMUA">Semua Status Perbaikan</option>
            {DAFTAR_STATUS_PERBAIKAN.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={filterThread}
            onChange={(e) => setFilterThread(e.target.value as any)}
            className={`w-full rounded-xl py-2 px-3 text-xs font-bold border focus:outline-none ${
              isLight
                ? 'border-slate-300 bg-slate-50 text-black focus:bg-white focus:border-red-600'
                : 'border-zinc-700 bg-zinc-950 text-zinc-200 focus:border-orange-500'
            }`}
          >
            <option value="SEMUA">Semua Diskusi ({perbaikan.length})</option>
            <option value="DENGAN_KOMENTAR">💬 Ada Thread Diskusi ({totalWithComments})</option>
            <option value="BELUM_ADA_KOMENTAR">⚠️ Belum Ada Komentar ({perbaikan.length - totalWithComments})</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div
        className={`overflow-hidden rounded-3xl shadow-xl border transition-colors ${
          isLight ? 'bg-white border-slate-300 text-black' : 'border-zinc-800 bg-zinc-900 text-white'
        }`}
      >
        <div className="overflow-x-auto">
          <table id="table-perbaikan-logs" className="w-full text-left text-xs">
            <thead
              className={`border-b text-[11px] font-black uppercase tracking-wider ${
                isLight
                  ? 'bg-slate-100 text-black border-slate-300'
                  : 'bg-gradient-to-r from-orange-950/70 via-zinc-900 to-black text-orange-400 border-orange-950'
              }`}
            >
              <tr>
                <th className="py-3.5 pl-4 pr-2">No</th>
                <th className="px-3 py-3.5">Nomor SPK & Tgl</th>
                <th className="px-3 py-3.5">Ruangan / Pelapor</th>
                <th className="px-3 py-3.5">Nama Alat & SN</th>
                <th className="px-3 py-3.5">Keluhan Kerusakan</th>
                <th className="px-3 py-3.5">Tindakan Elektromedis</th>
                <th className="px-3 py-3.5">Teknisi</th>
                <th className="px-3 py-3.5">Status Akhir</th>
                <th className="px-3 py-3.5 text-center">Thread Komentar</th>
                <th className="py-3.5 pl-2 pr-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isLight ? 'divide-slate-200 text-black' : 'divide-zinc-800 text-zinc-300'}`}>
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={10} className={`py-12 text-center ${isLight ? 'text-black' : 'text-zinc-500'}`}>
                    <Info className="mx-auto h-8 w-8 text-zinc-400 mb-2" />
                    <p className="font-bold text-sm">Belum ada riwayat perbaikan alat</p>
                    <p className="text-xs">Klik tombol &quot;+ Buat Form Perbaikan&quot; jika terdapat laporan alat rusak.</p>
                  </td>
                </tr>
              ) : (
                filteredList.map((item, index) => (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      isLight ? 'hover:bg-slate-50' : 'hover:bg-zinc-800/60'
                    }`}
                  >
                    <td className={`py-3 pl-4 pr-2 font-mono ${isLight ? 'text-slate-500 font-bold' : 'text-zinc-500'}`}>
                      {index + 1}
                    </td>
                    <td className="px-3 py-3">
                      <p
                        onClick={() => setSelectedThreadItem(item)}
                        className={`font-black font-mono text-xs cursor-pointer transition-colors ${
                          isLight ? 'text-red-700 hover:text-red-800 underline' : 'text-white hover:text-red-400'
                        }`}
                        title="Buka Detail & Thread Komentar"
                      >
                        {item.nomorSpk}
                      </p>
                      <p className={`text-[10px] font-mono font-semibold ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                        {item.tanggal}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-block rounded-lg px-2 py-0.5 font-bold border ${
                          isLight
                            ? 'bg-slate-100 text-black border-slate-300'
                            : 'bg-zinc-800 text-zinc-200 border-zinc-700'
                        }`}
                      >
                        {item.ruangan}
                      </span>
                      <p className={`text-[11px] mt-0.5 truncate font-medium ${isLight ? 'text-slate-700' : 'text-zinc-400'}`}>
                        {item.pelapor}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <p
                        onClick={() => setSelectedThreadItem(item)}
                        className={`font-black text-xs cursor-pointer transition-colors ${
                          isLight ? 'text-black hover:text-red-700' : 'text-white hover:text-red-400'
                        }`}
                        title="Buka Detail & Thread Komentar"
                      >
                        {item.namaAlat}
                      </p>
                      <p className={`text-[10px] font-mono font-semibold ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                        {item.merk} • SN: {item.serialNumber}
                      </p>
                    </td>
                    <td className="px-3 py-3 max-w-xs">
                      <p className={`text-xs truncate font-medium ${isLight ? 'text-black' : 'text-zinc-300'}`}>
                        {item.keluhanKerusakan}
                      </p>
                    </td>
                    <td className="px-3 py-3 max-w-xs">
                      <p className={`text-xs truncate font-medium ${isLight ? 'text-slate-700' : 'text-zinc-400'}`}>
                        {item.tindakanPerbaikan}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <p className={`font-bold text-xs ${isLight ? 'text-black' : 'text-zinc-200'}`}>
                        {item.teknisiPelaksana}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-block rounded-lg px-2 py-0.5 text-[10px] font-black uppercase border ${
                          isLight
                            ? item.statusPerbaikan === 'Selesai (Alat Normal)'
                              ? 'bg-emerald-100 text-black border-emerald-500 font-extrabold'
                              : item.statusPerbaikan === 'Menunggu Sparepart'
                              ? 'bg-amber-100 text-black border-amber-500 font-extrabold'
                              : item.statusPerbaikan === 'Dalam Proses'
                              ? 'bg-cyan-100 text-black border-cyan-500 font-extrabold'
                              : item.statusPerbaikan === 'Rekomendasi Perbaikan Vendor'
                              ? 'bg-purple-100 text-black border-purple-500 font-extrabold'
                              : 'bg-red-100 text-black border-red-500 font-extrabold'
                            : item.statusPerbaikan === 'Selesai (Alat Normal)'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                            : item.statusPerbaikan === 'Menunggu Sparepart'
                            ? 'bg-amber-950 text-amber-300 border-amber-800'
                            : item.statusPerbaikan === 'Dalam Proses'
                            ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                            : item.statusPerbaikan === 'Rekomendasi Perbaikan Vendor'
                            ? 'bg-purple-950 text-purple-300 border-purple-800'
                            : 'bg-red-950 text-red-300 border-red-800'
                        }`}
                      >
                        {item.statusPerbaikan}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        id={`btn-open-thread-${item.id}`}
                        onClick={() => setSelectedThreadItem(item)}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all shadow-xs cursor-pointer border ${
                          item.comments && item.comments.length > 0
                            ? isLight
                              ? 'bg-red-50 border-red-300 text-red-900 hover:bg-red-100 font-extrabold shadow-sm'
                              : 'bg-red-950/70 border-red-700 text-red-200 hover:bg-red-900 hover:text-white'
                            : isLight
                            ? 'bg-slate-100 border-slate-300 text-black hover:bg-slate-200 font-bold'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                        }`}
                        title="Buka Thread Komentar & Diskusi Status Perbaikan"
                      >
                        <MessageSquare className="h-3.5 w-3.5 text-red-500" />
                        <span>
                          {item.comments && item.comments.length > 0
                            ? `${item.comments.length} Pesan`
                            : 'Buka Thread'}
                        </span>
                        {item.comments && item.comments.length > 0 && (
                          <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        )}
                      </button>
                    </td>
                    <td className="py-3 pl-2 pr-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          id={`btn-action-thread-${item.id}`}
                          onClick={() => setSelectedThreadItem(item)}
                          className={`rounded-lg p-1.5 transition-colors cursor-pointer border ${
                            isLight
                              ? 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100'
                              : 'border-red-900/50 bg-red-950/40 text-red-300 hover:bg-red-900/60 hover:text-white'
                          }`}
                          title="Buka Thread Komentar & Detail Laporan"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </button>

                        <button
                          id={`btn-print-perbaikan-${item.id}`}
                          onClick={() => generatePerbaikanPdf(item)}
                          className={`rounded-lg p-1.5 transition-colors cursor-pointer border ${
                            isLight
                              ? 'border-slate-300 bg-slate-100 text-orange-700 hover:bg-slate-200'
                              : 'border-zinc-700 bg-zinc-800 text-orange-400 hover:text-white'
                          }`}
                          title="Cetak SPK Perbaikan PDF"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>

                        {item.statusPerbaikan === 'Rekomendasi Penarikan' && (
                          <button
                            id={`btn-perbaikan-bap-${item.id}`}
                            onClick={() => onRequestBap(item)}
                            className="rounded-lg border border-red-800 bg-red-950/80 px-2 py-1 text-[11px] font-bold text-red-300 hover:bg-red-900 transition-colors"
                            title="Buat BAP Penarikan"
                          >
                            BAP
                          </button>
                        )}

                        {currentTeknisi.role === 'admin' ? (
                          <>
                            <button
                              id={`btn-edit-perbaikan-${item.id}`}
                              onClick={() => handleOpenEditModal(item)}
                              className="rounded-lg border border-zinc-700 bg-zinc-800 p-1.5 text-zinc-300 hover:text-white"
                              title="Edit Laporan Perbaikan"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              id={`btn-delete-perbaikan-${item.id}`}
                              onClick={() => setDeleteConfirmId(item.id)}
                              className="rounded-lg border border-red-900/40 bg-zinc-800 p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950"
                              title="Hapus Laporan Perbaikan"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            id={`btn-view-perbaikan-${item.id}`}
                            onClick={() => setSelectedThreadItem(item)}
                            className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-[11px] font-semibold text-zinc-300 hover:text-white"
                            title="Lihat Detail SPK & Komentar"
                          >
                            Detail
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: INPUT / EDIT PERBAIKAN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-3xl border border-orange-800/80 bg-zinc-900 p-6 shadow-2xl text-white my-8">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-950 text-orange-400 border border-orange-800">
                  <Wrench className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    {editingItem
                      ? 'Edit Formulir Perbaikan Alkes'
                      : currentTeknisi.role === 'user'
                      ? 'Lapor Kerusakan Alat Medis (Ruangan ➜ Teknisi IPSRS)'
                      : 'Formulir Laporan & Perbaikan Alkes (SPK)'}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {currentTeknisi.role === 'user'
                      ? 'UPTD RSUD LAMADDUKELLENG • Notifikasi Otomatis Terkirim ke Teknisi Elektromedis'
                      : 'UPTD RSUD LAMADDUKELLENG • Corrective Maintenance Elektromedis'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {editingItem && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setSelectedThreadItem(editingItem);
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-red-800 bg-red-950/70 px-3 py-1.5 text-xs font-bold text-red-200 hover:bg-red-900 hover:text-white transition-all shadow-sm"
                    title="Buka Thread Diskusi Komentar"
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-red-400" />
                    <span>Diskusi ({editingItem.comments?.length || 0})</span>
                  </button>
                )}
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-zinc-800 p-1.5 text-zinc-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Role Notice */}
            {currentTeknisi.role === 'user' && (
              <div className="mb-4 rounded-2xl border border-blue-800/60 bg-blue-950/40 p-3 text-xs text-blue-200 flex items-start gap-2.5">
                <span className="text-base">📢</span>
                <div>
                  <span className="font-black text-white">Notifikasi Real-Time:</span> Laporan ini akan langsung masuk ke layar Teknisi Elektromedis (Musmuliadi, dkk) dan tersinkronisasi otomatis ke Google Spreadsheet UPTD RSUD LAMADDUKELLENG.
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tanggal */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
                    Tanggal Laporan <span className="text-orange-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formState.tanggal}
                    onChange={(e) => setFormState({ ...formState, tanggal: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 px-3 text-xs text-white focus:border-orange-500 focus:outline-none"
                  />
                </div>

                {/* Pelapor */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
                    Nama Petugas Pelapor <span className="text-orange-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Ns. Hj. Rosdiana, S.Kep"
                    value={formState.pelapor}
                    onChange={(e) => setFormState({ ...formState, pelapor: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 px-3 text-xs text-white focus:border-orange-500 focus:outline-none"
                  />
                </div>

                {/* Ruangan */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
                      Ruangan <span className="text-orange-500">*</span>
                    </label>
                    {onOpenRuanganModal && (
                      <button
                        type="button"
                        onClick={onOpenRuanganModal}
                        className="text-[11px] font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer"
                        title="Kelola Master Ruangan (Tambah, Edit, Hapus)"
                      >
                        + Kelola Ruangan
                      </button>
                    )}
                  </div>
                  <select
                    required
                    value={formState.ruangan}
                    onChange={(e) => {
                      const newRuangan = e.target.value as RuanganType;
                      setFormState((prev) => ({
                        ...prev,
                        ruangan: newRuangan,
                        alkesId: '',
                      }));
                    }}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 px-3 text-xs text-white focus:border-orange-500 focus:outline-none"
                  >
                    {activeRuanganList.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Shortcut Pilih Alkes Tersinkron Ruangan */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-orange-400">
                      Pilih Alat dari Database di {formState.ruangan} (Opsional)
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-zinc-400">
                        ({inventaris.filter((i) => i.ruangan === formState.ruangan).length} alat di {formState.ruangan})
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsAlkesPickerOpen(true)}
                        className="inline-flex items-center gap-1 rounded-lg border border-orange-500/60 bg-orange-950/80 px-2 py-0.5 text-[11px] font-bold text-orange-300 hover:bg-orange-900 transition-all shadow-sm"
                      >
                        <Search className="h-3 w-3" />
                        <span>Cari & Pilih Alat (Penuh Warna)</span>
                      </button>
                    </div>
                  </div>

                  <select
                    value={formState.alkesId}
                    onChange={(e) => handleSelectAlkes(e.target.value)}
                    className="w-full rounded-xl border border-orange-700/60 bg-zinc-950 py-2.5 px-3 text-xs text-zinc-100 focus:border-orange-500 focus:outline-none"
                  >
                    <option value="">
                      {inventaris.filter((i) => i.ruangan === formState.ruangan).length > 0
                        ? `-- Pilih Alat Terdaftar di ${formState.ruangan} --`
                        : `-- Belum ada alat di ${formState.ruangan} (Bisa pilih dari ruangan lain) --`}
                    </option>

                    {/* Alat di Ruangan yang dipilih (HIJAU / 🟢) */}
                    {inventaris.filter((i) => i.ruangan === formState.ruangan).length > 0 && (
                      <optgroup label={`🟢 ─── ALAT DI RUANG ${formState.ruangan} (LOKASI SAAT INI) ───`}>
                        {inventaris
                          .filter((i) => i.ruangan === formState.ruangan)
                          .map((i) => (
                            <option key={i.id} value={i.id}>
                              🟢 [{formState.ruangan}] {i.namaAlat} - {i.merk} (SN: {i.serialNumber})
                            </option>
                          ))}
                      </optgroup>
                    )}

                    {/* Alat di Ruangan lain (ORANYE / 🟠) */}
                    {inventaris.filter((i) => i.ruangan !== formState.ruangan).length > 0 && (
                      <optgroup label="🟠 ─── ALAT DARI RUANGAN LAIN (OTOMATIS UBAH RUANGAN) ───">
                        {inventaris
                          .filter((i) => i.ruangan !== formState.ruangan)
                          .map((i) => (
                            <option key={i.id} value={i.id}>
                              🟠 [DARI: {i.ruangan}] ➜ {i.namaAlat} - {i.merk} (SN: {i.serialNumber})
                            </option>
                          ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                {/* Nama Alat & Merk */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
                    Nama Alat <span className="text-orange-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.namaAlat}
                    onChange={(e) => setFormState({ ...formState, namaAlat: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 px-3 text-xs text-white focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
                    Merk & Model / Type <span className="text-orange-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Merk"
                      value={formState.merk}
                      onChange={(e) => setFormState({ ...formState, merk: e.target.value })}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 px-3 text-xs text-white focus:border-orange-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Tipe"
                      value={formState.modelType}
                      onChange={(e) => setFormState({ ...formState, modelType: e.target.value })}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 px-3 text-xs text-white focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Serial Number */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
                    Serial Number (SN)
                  </label>
                  <input
                    type="text"
                    placeholder="SN (Boleh dikosongkan jika tidak ada di fisik alat)..."
                    value={formState.serialNumber}
                    onChange={(e) => setFormState({ ...formState, serialNumber: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 px-3 text-xs font-mono text-white focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Keluhan Kerusakan */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
                  Keluhan / Gejala Kerusakan <span className="text-orange-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={formState.keluhanKerusakan}
                  onChange={(e) => setFormState({ ...formState, keluhanKerusakan: e.target.value })}
                  placeholder="Jelaskan kendala/kerusakan alat (contoh: Mati total, tidak keluar display, suara alarm terus berbunyi, kabel putus)..."
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2 px-3 text-xs text-white placeholder-zinc-500 focus:border-orange-500 focus:outline-none"
                />
              </div>

              {/* Analisis Kerusakan, Tindakan, Suku Cadang, Biaya, Status Akhir (HANYA DITAMPILKAN UNTUK AKUN ADMIN/TEKNISI) */}
              {currentTeknisi.role !== 'user' ? (
                <>
                  {/* Analisis & Tindakan Perbaikan */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
                        Analisis Kerusakan Teknisi
                      </label>
                      <textarea
                        rows={2}
                        value={formState.analisisTeknisi}
                        onChange={(e) => setFormState({ ...formState, analisisTeknisi: e.target.value })}
                        placeholder="Hasil pemeriksaan komponen elektrik/mekanik..."
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2 px-3 text-xs text-white placeholder-zinc-500 focus:border-orange-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
                        Tindakan Perbaikan yang Dilakukan
                      </label>
                      <textarea
                        rows={2}
                        value={formState.tindakanPerbaikan}
                        onChange={(e) => setFormState({ ...formState, tindakanPerbaikan: e.target.value })}
                        placeholder="Langkah perbaikan, kalibrasi ulang, dll..."
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2 px-3 text-xs text-white placeholder-zinc-500 focus:border-orange-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Sparepart & Biaya & Status Akhir */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
                        Suku Cadang Diganti
                      </label>
                      <input
                        type="text"
                        placeholder="Nama sparepart..."
                        value={formState.sparepartDiganti}
                        onChange={(e) => setFormState({ ...formState, sparepartDiganti: e.target.value })}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 px-3 text-xs text-white placeholder-zinc-500 focus:border-orange-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
                        Estimasi Biaya (Rp)
                      </label>
                      <input
                        type="number"
                        value={formState.biayaEstimasi || ''}
                        onChange={(e) => setFormState({ ...formState, biayaEstimasi: Number(e.target.value) || 0 })}
                        placeholder="0"
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 px-3 text-xs text-white placeholder-zinc-500 focus:border-orange-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
                        Status Akhir Perbaikan <span className="text-orange-500">*</span>
                      </label>
                      <select
                        required
                        value={formState.statusPerbaikan}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            statusPerbaikan: e.target.value as StatusPerbaikanType,
                          })
                        }
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 px-3 text-xs font-bold text-white focus:border-orange-500 focus:outline-none"
                      >
                        {DAFTAR_STATUS_PERBAIKAN.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-orange-900/50 bg-orange-950/20 p-3.5 text-xs text-orange-200/90 flex items-start gap-2.5">
                  <span className="text-base">🛠️</span>
                  <div>
                    <p className="font-bold text-white mb-0.5">Penanganan & Analisis Oleh Teknisi Elektromedis</p>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Analisis kerusakan, tindakan perbaikan yang diperlukan, suku cadang diganti, estimasi biaya, dan status akhir perbaikan akan langsung diperiksa dan diisi oleh Tim Teknisi Elektromedis IPSRS setelah laporan diterima.
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-xs font-bold text-zinc-300 hover:bg-zinc-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 to-red-700 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-orange-950 hover:from-orange-500 hover:to-red-600 transition-all"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    {currentTeknisi.role === 'user'
                      ? 'Kirim Laporan Kerusakan ke Teknisi'
                      : 'Simpan SPK Perbaikan'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm rounded-3xl border border-red-800 bg-zinc-900 p-6 shadow-2xl text-white text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-3" />
            <h3 className="text-base font-black text-white">Hapus Laporan Perbaikan?</h3>
            <p className="text-xs text-zinc-400 mt-2">
              Tindakan ini akan menghapus riwayat perbaikan ini secara permanen.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 text-xs font-bold text-zinc-300"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  onDeletePerbaikan(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="flex-1 rounded-xl bg-red-700 py-2.5 text-xs font-bold text-white shadow"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ALKES SEARCH & COLOR PICKER MODAL */}
      <AlkesPickerModal
        isOpen={isAlkesPickerOpen}
        onClose={() => setIsAlkesPickerOpen(false)}
        inventaris={inventaris}
        currentRuangan={formState.ruangan}
        selectedAlkesId={formState.alkesId}
        onSelectAlkes={(id) => handleSelectAlkes(id)}
        accentColor="orange"
      />

      {/* DETAIL PERBAIKAN & THREAD KOMENTAR MODAL */}
      <DetailPerbaikanModal
        isOpen={Boolean(activeThreadItem)}
        onClose={() => {
          setSelectedThreadItem(null);
          if (onClearInitialThreadItem) {
            onClearInitialThreadItem();
          }
        }}
        perbaikanItem={activeThreadItem}
        inventaris={inventaris}
        currentTeknisi={currentTeknisi}
        onAddComment={(perbaikanId, comment, updatedStatus) => {
          if (onAddComment) {
            onAddComment(perbaikanId, comment, updatedStatus);
          }
        }}
        onUpdateStatus={(perbaikanId, status) => {
          if (onUpdateStatus) {
            onUpdateStatus(perbaikanId, status);
          }
        }}
        onRequestBap={onRequestBap}
        theme={theme}
      />
    </div>
  );
};
