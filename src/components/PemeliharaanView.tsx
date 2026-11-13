import React, { useState, useMemo } from 'react';
import {
  FileCheck2,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Printer,
  FileSpreadsheet,
  CheckSquare,
  Square,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Calendar,
  User,
  Wrench,
  X,
  Info,
} from 'lucide-react';
import { AlkesItem, DAFTAR_RUANGAN, KondisiAlatType, PemeliharaanItem, RuanganType, StatusPpmType, Teknisi } from '../types';
import { exportToCsv } from '../utils/syncEngine';
import { generatePpmReportPdf } from '../utils/pdfGenerator';
import { AlkesPickerModal } from './AlkesPickerModal';

interface PemeliharaanViewProps {
  pemeliharaan: PemeliharaanItem[];
  inventaris: AlkesItem[];
  currentTeknisi: Teknisi;
  ruanganList?: string[];
  onOpenRuanganModal?: () => void;
  onSavePpm: (item: PemeliharaanItem, isEdit: boolean) => void;
  onDeletePpm: (id: string) => void;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
}

export const PemeliharaanView: React.FC<PemeliharaanViewProps> = ({
  pemeliharaan = [],
  inventaris = [],
  currentTeknisi,
  ruanganList = [],
  onOpenRuanganModal,
  onSavePpm,
  onDeletePpm,
  isModalOpen,
  setIsModalOpen,
}) => {
  const activeRuanganList = ruanganList.length > 0 ? ruanganList : DAFTAR_RUANGAN;
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRuangan, setFilterRuangan] = useState('SEMUA');
  const [filterStatus, setFilterStatus] = useState('SEMUA');

  const [editingItem, setEditingItem] = useState<PemeliharaanItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isAlkesPickerOpen, setIsAlkesPickerOpen] = useState(false);

  // Form State - with auto-filled technician from logged-in user!
  const [formState, setFormState] = useState<{
    id: string;
    tanggal: string;
    namaTeknisi: string;
    nipTeknisi: string;
    ruangan: RuanganType;
    alkesId: string;
    namaAlat: string;
    merk: string;
    modelType: string;
    serialNumber: string;
    kegiatanFisik: boolean;
    kegiatanSetting: boolean;
    kegiatanCleaning: boolean;
    kondisi: KondisiAlatType;
    status: StatusPpmType;
    catatan: string;
    rekomendasi: string;
  }>({
    id: '',
    tanggal: new Date().toISOString().slice(0, 10),
    namaTeknisi: `${currentTeknisi.namaLengkap}, ${currentTeknisi.gelar}`,
    nipTeknisi: currentTeknisi.nip,
    ruangan: 'IGD',
    alkesId: '',
    namaAlat: '',
    merk: '',
    modelType: '',
    serialNumber: '',
    kegiatanFisik: true,
    kegiatanSetting: true,
    kegiatanCleaning: true,
    kondisi: 'Baik',
    status: 'layak pakai',
    catatan: '',
    rekomendasi: '',
  });

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormState({
      id: `PPM-${Date.now().toString().slice(-6)}`,
      tanggal: new Date().toISOString().slice(0, 10),
      namaTeknisi: `${currentTeknisi.namaLengkap}, ${currentTeknisi.gelar}`,
      nipTeknisi: currentTeknisi.nip,
      ruangan: 'IGD',
      alkesId: '',
      namaAlat: '',
      merk: '',
      modelType: '',
      serialNumber: '',
      kegiatanFisik: true,
      kegiatanSetting: true,
      kegiatanCleaning: true,
      kondisi: 'Baik',
      status: 'layak pakai',
      catatan: 'Pemeriksaan rutin berjalan normal, parameter output sesuai spesifikasi.',
      rekomendasi: 'Jadwalkan pemeliharaan berkala berikutnya.',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: PemeliharaanItem) => {
    setEditingItem(item);
    setFormState({
      id: item.id,
      tanggal: item.tanggal,
      namaTeknisi: item.namaTeknisi,
      nipTeknisi: item.nipTeknisi || currentTeknisi.nip,
      ruangan: item.ruangan,
      alkesId: item.alkesId || '',
      namaAlat: item.namaAlat,
      merk: item.merk,
      modelType: item.modelType,
      serialNumber: item.serialNumber,
      kegiatanFisik: item.kegiatanFisik,
      kegiatanSetting: item.kegiatanSetting,
      kegiatanCleaning: item.kegiatanCleaning,
      kondisi: item.kondisi,
      status: item.status,
      catatan: item.catatan || '',
      rekomendasi: item.rekomendasi || '',
    });
    setIsModalOpen(true);
  };

  // When an Alkes is selected from dropdown, autofill details
  const handleSelectAlkesFromInventory = (alkesId: string) => {
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
        kondisi: found.kondisi,
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: PemeliharaanItem = {
      ...formState,
      updatedAt: new Date().toISOString(),
    };
    onSavePpm(payload, !!editingItem);
    setIsModalOpen(false);
  };

  const filteredList = useMemo(() => {
    return pemeliharaan.filter((item) => {
      const matchSearch =
        item.namaAlat.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.namaTeknisi.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.ruangan.toLowerCase().includes(searchQuery.toLowerCase());

      const matchRuangan = filterRuangan === 'SEMUA' || item.ruangan === filterRuangan;
      const matchStatus = filterStatus === 'SEMUA' || item.status === filterStatus;

      return matchSearch && matchRuangan && matchStatus;
    });
  }, [pemeliharaan, searchQuery, filterRuangan, filterStatus]);

  return (
    <div id="pemeliharaan-view-container" className="space-y-6 pb-12">
      {/* Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-red-900/50 bg-zinc-900/90 p-5 sm:p-6 shadow-xl text-white">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-emerald-950 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-800">
              MODUL 2: PPM ELEKTROMEDIS
            </span>
            <span className="text-xs font-mono text-zinc-400">PLANNED PREVENTIVE MAINTENANCE</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
            Pemeliharaan & Pemantauan Alat Kesehatan UPTD RSUD LAMADDUKELLENG
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Catatan kegiatan pemeliharaan berkala, cek fisik-fungsi, setting parameter & cleaning alkes di 28 ruangan.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            id="btn-export-ppm-csv"
            onClick={() => exportToCsv('pemeliharaan', filteredList)}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-800 bg-emerald-950/70 px-3.5 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-900/60 transition-all active:scale-95"
            title="Download Format Spreadsheet"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Export CSV</span>
          </button>

          <button
            id="btn-print-ppm-report"
            onClick={() => generatePpmReportPdf(filteredList, filterRuangan === 'SEMUA' ? undefined : filterRuangan)}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3.5 py-2 text-xs font-bold text-zinc-200 hover:bg-zinc-700 transition-all active:scale-95"
          >
            <Printer className="h-4 w-4 text-emerald-400" />
            <span>Cetak Lembar PPM</span>
          </button>

          {currentTeknisi.role === 'admin' ? (
            <button
              id="btn-add-ppm-main"
              onClick={handleOpenAddModal}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-950 hover:from-emerald-500 hover:to-emerald-600 transition-all active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>+ Input Lembar PPM</span>
            </button>
          ) : (
            <span className="rounded-xl border border-blue-900/50 bg-blue-950/60 px-3 py-2 text-xs font-bold text-blue-300">
              Akses: Petugas Ruangan
            </span>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <input
            id="input-search-ppm"
            type="text"
            placeholder="Cari alat, SN, nama teknisi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2 pl-9 pr-3 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div>
          <select
            id="select-ppm-ruangan"
            value={filterRuangan}
            onChange={(e) => setFilterRuangan(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2 px-3 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
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
            id="select-ppm-status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2 px-3 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
          >
            <option value="SEMUA">Semua Status Kelayakan</option>
            <option value="layak pakai">Status: Layak Pakai</option>
            <option value="perlu perbaikan / penggantian sparepart">Perlu Perbaikan / Sparepart</option>
          </select>
        </div>
      </div>

      {/* Table of PPM Logs */}
      <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 shadow-xl">
        <div className="overflow-x-auto">
          <table id="table-ppm-logs" className="w-full text-left text-xs text-zinc-300">
            <thead className="border-b border-emerald-950 bg-gradient-to-r from-emerald-950/70 via-zinc-900 to-black text-[11px] font-black uppercase tracking-wider text-emerald-400">
              <tr>
                <th className="py-3.5 pl-4 pr-2">No</th>
                <th className="px-3 py-3.5">Tanggal</th>
                <th className="px-3 py-3.5">Teknisi Elektromedis</th>
                <th className="px-3 py-3.5">Ruangan</th>
                <th className="px-3 py-3.5">Nama Alat & SN</th>
                <th className="px-2 py-3.5 text-center leading-tight">1. Fisik, Fungsi & Aksesoris</th>
                <th className="px-2 py-3.5 text-center leading-tight">2. Setting, Mekanik, Listrik & Pemanasan</th>
                <th className="px-2 py-3.5 text-center leading-tight">3. Cleaning Seluruh Bagian</th>
                <th className="px-3 py-3.5">Kondisi</th>
                <th className="px-3 py-3.5">Status Kelayakan</th>
                <th className="py-3.5 pl-2 pr-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-zinc-500">
                    <Info className="mx-auto h-8 w-8 text-zinc-600 mb-2" />
                    <p className="font-bold text-sm text-zinc-400">Belum ada catatan pemeliharaan</p>
                    <p className="text-xs">Klik tombol &quot;+ Input Lembar PPM&quot; untuk menambahkan data kegiatan pemeliharaan.</p>
                  </td>
                </tr>
              ) : (
                filteredList.map((item, index) => (
                  <tr key={item.id} className="hover:bg-zinc-800/60 transition-colors">
                    <td className="py-3 pl-4 pr-2 font-mono text-zinc-500">{index + 1}</td>
                    <td className="px-3 py-3 font-mono font-bold text-zinc-300 whitespace-nowrap">
                      {item.tanggal}
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-bold text-white text-xs">{item.namaTeknisi}</p>
                      {item.nipTeknisi && (
                        <p className="text-[10px] text-zinc-500 font-mono">NIP: {item.nipTeknisi}</p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-block rounded-lg bg-zinc-800 px-2 py-0.5 font-bold text-zinc-200 border border-zinc-700">
                        {item.ruangan}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-bold text-white text-xs">{item.namaAlat}</p>
                      <p className="text-[10px] text-zinc-400 font-mono">
                        {item.merk} • SN: {item.serialNumber}
                      </p>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span
                        className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                          item.kegiatanFisik
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        {item.kegiatanFisik ? '✓ Ya' : '✗ Tidak'}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span
                        className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                          item.kegiatanSetting
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        {item.kegiatanSetting ? '✓ Ya' : '✗ Tidak'}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span
                        className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                          item.kegiatanCleaning
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        {item.kegiatanCleaning ? '✓ Ya' : '✗ Tidak'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                          item.kondisi === 'Baik'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}
                      >
                        {item.kondisi}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-block rounded-lg px-2.5 py-0.5 text-[10px] font-black uppercase ${
                          item.status === 'layak pakai'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-red-950 text-red-300 border border-red-800 animate-pulse'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 pl-2 pr-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {currentTeknisi.role === 'admin' ? (
                          <>
                            <button
                              id={`btn-edit-ppm-${item.id}`}
                              onClick={() => handleOpenEditModal(item)}
                              className="rounded-lg border border-zinc-700 bg-zinc-800 p-1.5 text-zinc-300 hover:text-white"
                              title="Edit Catatan PPM"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              id={`btn-delete-ppm-${item.id}`}
                              onClick={() => setDeleteConfirmId(item.id)}
                              className="rounded-lg border border-red-900/40 bg-zinc-800 p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950"
                              title="Hapus Catatan PPM"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            id={`btn-view-ppm-${item.id}`}
                            onClick={() => handleOpenEditModal(item)}
                            className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-[11px] font-semibold text-zinc-300 hover:text-white"
                            title="Lihat Detail PPM"
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

      {/* MODAL: INPUT / EDIT PPM */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-3xl border border-emerald-800/80 bg-zinc-900 p-6 shadow-2xl text-white my-8">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800">
                  <FileCheck2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    {editingItem ? 'Edit Lembar Pemeliharaan (PPM)' : 'Input Lembar Pemeliharaan & Pemantauan (PPM)'}
                  </h3>
                  <p className="text-xs text-zinc-400">UPTD RSUD LAMADDUKELLENG • Planned Preventive Maintenance</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl border border-zinc-800 p-1.5 text-zinc-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tanggal */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
                    Tanggal Kegiatan <span className="text-emerald-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formState.tanggal}
                    onChange={(e) => setFormState({ ...formState, tanggal: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 px-3 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Nama Teknisi (Terisi Otomatis Sesuai User Login) */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1">
                    Nama Teknisi (Otomatis)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={formState.namaTeknisi}
                    className="w-full rounded-xl border border-emerald-800/60 bg-emerald-950/40 py-2.5 px-3 text-xs font-bold text-emerald-300 cursor-not-allowed"
                  />
                </div>

                {/* Ruangan */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
                      Ruangan <span className="text-emerald-500">*</span>
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
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 px-3 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  >
                    {activeRuanganList.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Pilih dari Database Alkes (Tersinkron dengan Ruangan) */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-emerald-400">
                      Pilih Alat dari Database di {formState.ruangan}
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-zinc-400">
                        ({inventaris.filter((i) => i.ruangan === formState.ruangan).length} alat di {formState.ruangan})
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsAlkesPickerOpen(true)}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/60 bg-emerald-950/80 px-2 py-0.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-900 transition-all shadow-sm"
                      >
                        <Search className="h-3 w-3" />
                        <span>Cari & Pilih Alat (Penuh Warna)</span>
                      </button>
                    </div>
                  </div>

                  <select
                    value={formState.alkesId}
                    onChange={(e) => handleSelectAlkesFromInventory(e.target.value)}
                    className="w-full rounded-xl border border-emerald-700/60 bg-zinc-950 py-2.5 px-3 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
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

                {/* Nama Alat */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
                    Nama Alat <span className="text-emerald-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.namaAlat}
                    onChange={(e) => setFormState({ ...formState, namaAlat: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 px-3 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Merk */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
                    Merk / Brand <span className="text-emerald-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.merk}
                    onChange={(e) => setFormState({ ...formState, merk: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 px-3 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Model / Type & Serial Number */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
                    Model / Type & Serial Number <span className="text-emerald-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Model / Tipe"
                      value={formState.modelType}
                      onChange={(e) => setFormState({ ...formState, modelType: e.target.value })}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 px-3 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Serial Number (SN)"
                      value={formState.serialNumber}
                      onChange={(e) => setFormState({ ...formState, serialNumber: e.target.value })}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 px-3 text-xs font-mono text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Checklist Kegiatan Pemeliharaan dan Pemantauan */}
              <div className="rounded-2xl border border-emerald-900/60 bg-zinc-950/80 p-4">
                <label className="block text-xs font-black uppercase tracking-wider text-emerald-400 mb-2">
                  Ceklis Kegiatan Pemeliharaan & Pemantauan (PPM):
                </label>
                <div className="space-y-2.5">
                  <label className="flex items-start gap-3 cursor-pointer p-2 rounded-xl hover:bg-zinc-900 transition-colors">
                    <input
                      type="checkbox"
                      checked={formState.kegiatanFisik}
                      onChange={(e) => setFormState({ ...formState, kegiatanFisik: e.target.checked })}
                      className="mt-0.5 h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs text-zinc-200 leading-tight">
                      <strong>1. Pemeriksaan fisik-fungsi dan kelengkapan aksesoris</strong>
                      <br />
                      <span className="text-[11px] text-zinc-400">
                        Memeriksa keutuhan bodi, kabel power, tombol/touchscreen, sensor, display, dan probe/aksesoris pendukung.
                      </span>
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer p-2 rounded-xl hover:bg-zinc-900 transition-colors">
                    <input
                      type="checkbox"
                      checked={formState.kegiatanSetting}
                      onChange={(e) => setFormState({ ...formState, kegiatanSetting: e.target.checked })}
                      className="mt-0.5 h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs text-zinc-200 leading-tight">
                      <strong>2. Setting parameter-perawatan mekanik dan kelistrikan serta pemanasan Alat</strong>
                      <br />
                      <span className="text-[11px] text-zinc-400">
                        Uji kelistrikan (kebocoran arus/grounding), kalibrasi parameter internal, pelumasan mekanik & warming-up.
                      </span>
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer p-2 rounded-xl hover:bg-zinc-900 transition-colors">
                    <input
                      type="checkbox"
                      checked={formState.kegiatanCleaning}
                      onChange={(e) => setFormState({ ...formState, kegiatanCleaning: e.target.checked })}
                      className="mt-0.5 h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs text-zinc-200 leading-tight">
                      <strong>3. Cleaning seluruh bagian alat</strong>
                      <br />
                      <span className="text-[11px] text-zinc-400">
                        Pembersihan debu, filter udara, dekontaminasi permukaan dengan desinfektan medis standar Kemenkes.
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              {/* Kondisi & Status Kelayakan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
                    Kondisi Alat <span className="text-emerald-500">*</span>
                  </label>
                  <select
                    required
                    value={formState.kondisi}
                    onChange={(e) => setFormState({ ...formState, kondisi: e.target.value as KondisiAlatType })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 px-3 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="Baik">Baik</option>
                    <option value="Rusak Ringan">Rusak Ringan</option>
                    <option value="Rusak Sedang">Rusak Sedang</option>
                    <option value="Rusak Berat">Rusak Berat</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
                    Status Kelayakan <span className="text-emerald-500">*</span>
                  </label>
                  <select
                    required
                    value={formState.status}
                    onChange={(e) => setFormState({ ...formState, status: e.target.value as StatusPpmType })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 px-3 text-xs font-bold text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="layak pakai">layak pakai</option>
                    <option value="perlu perbaikan / penggantian sparepart">
                      perlu perbaikan / penggantian sparepart
                    </option>
                  </select>
                </div>
              </div>

              {/* Catatan Teknisi */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
                  Catatan Hasil Pemeliharaan
                </label>
                <textarea
                  rows={2}
                  value={formState.catatan}
                  onChange={(e) => setFormState({ ...formState, catatan: e.target.value })}
                  placeholder="Catatan hasil pengujian, temuan teknis, dll..."
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2 px-3 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-xs font-bold text-zinc-300 hover:bg-zinc-700"
                >
                  Batal
                </button>
                <button
                  id="btn-save-ppm-submit"
                  type="submit"
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-950 hover:from-emerald-500 hover:to-emerald-600"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Simpan Lembar PPM</span>
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
            <h3 className="text-base font-black text-white">Hapus Lembar PPM?</h3>
            <p className="text-xs text-zinc-400 mt-2">
              Tindakan ini akan menghapus riwayat pemeliharaan ini secara permanen.
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
                  onDeletePpm(deleteConfirmId);
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
        onSelectAlkes={(id) => handleSelectAlkesFromInventory(id)}
        accentColor="emerald"
      />
    </div>
  );
};
