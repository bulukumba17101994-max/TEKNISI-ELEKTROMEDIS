import React, { useState, useMemo } from 'react';
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  Check,
  AlertTriangle,
  RotateCcw,
  Layers,
  Wrench,
  FileCheck2,
  FileText,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import {
  AlkesItem,
  DAFTAR_RUANGAN,
  PemeliharaanItem,
  PerbaikanItem,
  BeritaAcaraPenarikan,
  Teknisi,
} from '../types';

interface RuanganManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  ruanganList: string[];
  inventaris: AlkesItem[];
  pemeliharaan: PemeliharaanItem[];
  perbaikan: PerbaikanItem[];
  beritaAcara: BeritaAcaraPenarikan[];
  currentTeknisi: Teknisi;
  onAddRuangan: (name: string) => void;
  onRenameRuangan: (oldName: string, newName: string) => void;
  onDeleteRuangan: (roomToDelete: string, targetReassignRoom?: string) => void;
  onResetDefaultRuangan: () => void;
}

export const RuanganManagementModal: React.FC<RuanganManagementModalProps> = ({
  isOpen,
  onClose,
  ruanganList,
  inventaris,
  pemeliharaan,
  perbaikan,
  beritaAcara,
  currentTeknisi,
  onAddRuangan,
  onRenameRuangan,
  onDeleteRuangan,
  onResetDefaultRuangan,
}) => {
  // Add room input
  const [newRoomName, setNewRoomName] = useState('');
  const [addError, setAddError] = useState('');
  const [notificationMsg, setNotificationMsg] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Search/Filter room
  const [searchQuery, setSearchQuery] = useState('');

  // Editing state: which room is currently being renamed
  const [editingRoom, setEditingRoom] = useState<string | null>(null);
  const [editInputName, setEditInputName] = useState('');
  const [editError, setEditError] = useState('');

  // Delete Confirmation / Reassign modal state
  const [roomToDelete, setRoomToDelete] = useState<string | null>(null);
  const [targetReassignRoom, setTargetReassignRoom] = useState<string>('');

  const isAdminOrTeknisi =
    currentTeknisi.role === 'admin' ||
    (currentTeknisi.role as string) === 'teknisi' ||
    currentTeknisi.username !== 'user';

  // Room item counts map
  const roomStats = useMemo(() => {
    const stats: Record<
      string,
      { alkes: number; pemeliharaan: number; perbaikan: number; bap: number; total: number }
    > = {};

    ruanganList.forEach((r) => {
      stats[r] = { alkes: 0, pemeliharaan: 0, perbaikan: 0, bap: 0, total: 0 };
    });

    inventaris.forEach((item) => {
      if (item.ruangan) {
        if (!stats[item.ruangan]) {
          stats[item.ruangan] = { alkes: 0, pemeliharaan: 0, perbaikan: 0, bap: 0, total: 0 };
        }
        stats[item.ruangan].alkes += 1;
        stats[item.ruangan].total += 1;
      }
    });

    pemeliharaan.forEach((item) => {
      if (item.ruangan) {
        if (!stats[item.ruangan]) {
          stats[item.ruangan] = { alkes: 0, pemeliharaan: 0, perbaikan: 0, bap: 0, total: 0 };
        }
        stats[item.ruangan].pemeliharaan += 1;
        stats[item.ruangan].total += 1;
      }
    });

    perbaikan.forEach((item) => {
      if (item.ruangan) {
        if (!stats[item.ruangan]) {
          stats[item.ruangan] = { alkes: 0, pemeliharaan: 0, perbaikan: 0, bap: 0, total: 0 };
        }
        stats[item.ruangan].perbaikan += 1;
        stats[item.ruangan].total += 1;
      }
    });

    beritaAcara.forEach((item) => {
      if (item.ruangan) {
        if (!stats[item.ruangan]) {
          stats[item.ruangan] = { alkes: 0, pemeliharaan: 0, perbaikan: 0, bap: 0, total: 0 };
        }
        stats[item.ruangan].bap += 1;
        stats[item.ruangan].total += 1;
      }
    });

    return stats;
  }, [ruanganList, inventaris, pemeliharaan, perbaikan, beritaAcara]);

  // Filtered rooms
  const filteredRuanganList = useMemo(() => {
    if (!searchQuery.trim()) return ruanganList;
    const q = searchQuery.toLowerCase().trim();
    return ruanganList.filter((r) => r.toLowerCase().includes(q));
  }, [ruanganList, searchQuery]);

  // Handle Add Room
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    const trimmed = newRoomName.trim().toUpperCase();
    if (!trimmed) {
      setAddError('Nama ruangan tidak boleh kosong');
      return;
    }
    if (ruanganList.some((r) => r.toLowerCase() === trimmed.toLowerCase())) {
      setAddError(`Ruangan "${trimmed}" sudah terdaftar.`);
      return;
    }

    onAddRuangan(trimmed);
    setNewRoomName('');
    setNotificationMsg({
      text: `Ruangan "${trimmed}" berhasil ditambahkan dan disinkronkan ke seluruh menu!`,
      type: 'success',
    });
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  // Start Edit
  const handleStartEdit = (room: string) => {
    setEditingRoom(room);
    setEditInputName(room);
    setEditError('');
  };

  // Submit Edit
  const handleSaveEdit = (oldRoom: string) => {
    setEditError('');
    const trimmed = editInputName.trim().toUpperCase();
    if (!trimmed) {
      setEditError('Nama ruangan tidak boleh kosong');
      return;
    }
    if (trimmed === oldRoom) {
      setEditingRoom(null);
      return;
    }
    if (
      ruanganList.some(
        (r) => r.toLowerCase() === trimmed.toLowerCase() && r !== oldRoom
      )
    ) {
      setEditError(`Ruangan "${trimmed}" sudah ada.`);
      return;
    }

    const count = roomStats[oldRoom]?.total || 0;
    onRenameRuangan(oldRoom, trimmed);
    setEditingRoom(null);
    setNotificationMsg({
      text: `Ruangan "${oldRoom}" berhasil diubah menjadi "${trimmed}". ${count} data terkait telah disinkronkan otomatis.`,
      type: 'success',
    });
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  // Prompt Delete
  const handlePromptDelete = (room: string) => {
    const stats = roomStats[room] || { total: 0 };
    setRoomToDelete(room);
    // Default target reassign room: pick the first room that is not roomToDelete
    const alternative = ruanganList.find((r) => r !== room) || '';
    setTargetReassignRoom(alternative);
  };

  // Confirm Delete
  const handleConfirmDelete = () => {
    if (!roomToDelete) return;
    const stats = roomStats[roomToDelete] || { total: 0, alkes: 0 };

    if (stats.total > 0 && !targetReassignRoom) {
      alert('Pilih ruangan tujuan pemindahan data terlebih dahulu.');
      return;
    }

    onDeleteRuangan(roomToDelete, stats.total > 0 ? targetReassignRoom : undefined);
    const deletedName = roomToDelete;
    setRoomToDelete(null);

    setNotificationMsg({
      text:
        stats.total > 0
          ? `Ruangan "${deletedName}" telah dihapus. ${stats.alkes} alat dan riwayat terkait telah dipindahkan ke "${targetReassignRoom}".`
          : `Ruangan "${deletedName}" berhasil dihapus.`,
      type: 'info',
    });
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  if (!isOpen) return null;

  return (
    <div
      id="modal-kelola-ruangan"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-5 animate-in fade-in duration-200"
    >
      <div className="flex flex-col w-full max-w-4xl max-h-[92vh] rounded-3xl border border-zinc-700 bg-zinc-950 shadow-2xl overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-red-600/20 border border-amber-500/40 text-amber-400 shadow-inner">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">
                  Kelola Master Data Ruangan UPTD RSUD LAMADDUKELLENG
                </h2>
                <span className="hidden sm:inline-block rounded-full bg-red-950 px-2 py-0.5 text-[10px] font-bold text-red-300 border border-red-800">
                  IPSRS Elektromedis
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Tambah, ubah nama, atau hapus ruangan dengan migrasi otomatis ke inventaris, PPM, perbaikan, & BAP.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
            title="Tutup Modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Notification Toast */}
        {notificationMsg && (
          <div
            className={`mx-5 sm:mx-6 mt-4 p-3 rounded-2xl text-xs font-semibold flex items-center justify-between ${
              notificationMsg.type === 'success'
                ? 'bg-emerald-950/80 border border-emerald-600/80 text-emerald-200'
                : notificationMsg.type === 'info'
                ? 'bg-blue-950/80 border border-blue-600/80 text-blue-200'
                : 'bg-red-950/80 border border-red-600/80 text-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0" />
              <span>{notificationMsg.text}</span>
            </div>
            <button
              onClick={() => setNotificationMsg(null)}
              className="text-xs opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6 space-y-5">
          {/* Form Tambah Ruangan Baru */}
          {isAdminOrTeknisi ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Tambah Ruangan Baru
                </span>
                <span className="text-[11px] text-zinc-400">
                  Akan langsung muncul di dropdown semua menu
                </span>
              </div>
              <form onSubmit={handleAddSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={newRoomName}
                    onChange={(e) => {
                      setNewRoomName(e.target.value);
                      if (addError) setAddError('');
                    }}
                    placeholder="Contoh: POLI GERIATRI, ICU SENTRAL, LAB PCR..."
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-xs text-white uppercase font-bold placeholder:normal-case placeholder:font-normal placeholder:text-zinc-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newRoomName.trim()}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:from-amber-500 hover:to-amber-600 disabled:opacity-50 transition-all active:scale-95 cursor-pointer shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  <span>Simpan Ruangan</span>
                </button>
              </form>
              {addError && (
                <p className="mt-1.5 text-xs text-red-400 font-medium flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {addError}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3.5 text-xs text-zinc-400 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-zinc-500" />
              <span>Akses penambahan dan penghapusan ruangan hanya untuk Teknisi dan Admin IPSRS.</span>
            </div>
          )}

          {/* Search Bar & Summary Stats */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Cari nama ruangan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2 pl-9 pr-8 text-xs text-white placeholder:text-zinc-500 focus:border-red-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="rounded-lg bg-zinc-900 px-2.5 py-1 border border-zinc-800 font-mono font-bold text-white">
                Total: {ruanganList.length} Ruangan
              </span>
              <span className="rounded-lg bg-zinc-900 px-2.5 py-1 border border-zinc-800 font-mono text-zinc-300">
                {filteredRuanganList.length} Ditampilkan
              </span>
            </div>
          </div>

          {/* Room List Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {filteredRuanganList.length === 0 ? (
              <div className="col-span-full py-12 text-center text-zinc-500">
                <Building2 className="mx-auto h-8 w-8 text-zinc-600 mb-2" />
                <p className="font-bold text-sm text-zinc-300">Ruangan tidak ditemukan</p>
                <p className="text-xs">Coba ubah kata kunci pencarian atau tambah ruangan baru di atas.</p>
              </div>
            ) : (
              filteredRuanganList.map((room) => {
                const isEditing = editingRoom === room;
                const stats = roomStats[room] || {
                  alkes: 0,
                  pemeliharaan: 0,
                  perbaikan: 0,
                  bap: 0,
                  total: 0,
                };
                const hasData = stats.total > 0;

                return (
                  <div
                    key={room}
                    className={`rounded-2xl border transition-all p-3.5 flex flex-col justify-between ${
                      isEditing
                        ? 'border-amber-500 bg-amber-950/20 shadow-md ring-1 ring-amber-500/50'
                        : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 hover:border-zinc-700'
                    }`}
                  >
                    {isEditing ? (
                      /* Inline Edit Mode */
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-amber-300">
                            Edit Nama Ruangan:
                          </span>
                          <span className="text-[10px] text-zinc-400">
                            {stats.total} data terkait akan diupdate
                          </span>
                        </div>
                        <input
                          type="text"
                          value={editInputName}
                          onChange={(e) => {
                            setEditInputName(e.target.value);
                            if (editError) setEditError('');
                          }}
                          autoFocus
                          className="w-full rounded-xl border border-amber-600 bg-zinc-950 px-3 py-2 text-xs font-bold uppercase text-white focus:outline-none"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveEdit(room);
                            } else if (e.key === 'Escape') {
                              setEditingRoom(null);
                            }
                          }}
                        />
                        {editError && (
                          <p className="text-[11px] text-red-400">{editError}</p>
                        )}
                        <div className="flex items-center justify-end gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingRoom(null)}
                            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white"
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(room)}
                            className="flex items-center gap-1 rounded-lg bg-amber-600 hover:bg-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow-xs"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Simpan Perubahan</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Normal Display Mode */
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-black text-sm text-white tracking-wide truncate">
                              {room}
                            </h3>
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                              {/* Alkes Badge */}
                              <span
                                className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold border ${
                                  stats.alkes > 0
                                    ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800/80'
                                    : 'bg-zinc-800/70 text-zinc-400 border-zinc-700/60'
                                }`}
                                title={`${stats.alkes} Unit Alkes terdaftar di ruangan ini`}
                              >
                                <Layers className="h-3 w-3" />
                                <span>{stats.alkes} Alkes</span>
                              </span>

                              {/* PPM Badge */}
                              <span
                                className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold border ${
                                  stats.pemeliharaan > 0
                                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80'
                                    : 'bg-zinc-800/70 text-zinc-400 border-zinc-700/60'
                                }`}
                                title={`${stats.pemeliharaan} Catatan Pemeliharaan Berkala (PPM)`}
                              >
                                <FileCheck2 className="h-3 w-3" />
                                <span>{stats.pemeliharaan} PPM</span>
                              </span>

                              {/* Perbaikan Badge */}
                              <span
                                className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold border ${
                                  stats.perbaikan > 0
                                    ? 'bg-orange-950/80 text-orange-300 border-orange-800/80'
                                    : 'bg-zinc-800/70 text-zinc-400 border-zinc-700/60'
                                }`}
                                title={`${stats.perbaikan} Tiket Perbaikan`}
                              >
                                <Wrench className="h-3 w-3" />
                                <span>{stats.perbaikan} Perbaikan</span>
                              </span>

                              {/* BAP Badge */}
                              {stats.bap > 0 && (
                                <span
                                  className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold border bg-red-950/80 text-red-300 border-red-800/80"
                                  title={`${stats.bap} Berita Acara Penarikan`}
                                >
                                  <FileText className="h-3 w-3" />
                                  <span>{stats.bap} BAP</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          {isAdminOrTeknisi && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(room)}
                                className="rounded-xl border border-zinc-700/80 bg-zinc-800/80 p-2 text-zinc-300 hover:border-amber-500/80 hover:bg-amber-950/50 hover:text-amber-300 transition-all cursor-pointer"
                                title="Ubah / Ganti Nama Ruangan"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePromptDelete(room)}
                                className="rounded-xl border border-zinc-700/80 bg-zinc-800/80 p-2 text-zinc-300 hover:border-red-600 hover:bg-red-950/60 hover:text-red-300 transition-all cursor-pointer"
                                title="Hapus Ruangan"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-zinc-800 bg-zinc-900/90 px-5 py-3.5 sm:px-6">
          <div className="flex items-center gap-2">
            {isAdminOrTeknisi && (
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      'Kembalikan daftar standar 28 ruangan UPTD RSUD LAMADDUKELLENG? Ruangan custom Anda tidak akan dihapus.'
                    )
                  ) {
                    onResetDefaultRuangan();
                    setNotificationMsg({
                      text: 'Daftar standar UPTD RSUD LAMADDUKELLENG berhasil digabungkan.',
                      type: 'success',
                    });
                  }
                }}
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                title="Tambahkan kembali ruangan bawaan UPTD RSUD LAMADDUKELLENG jika ada yang terhapus"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Pulihkan Standar 28 Ruangan UPTD RSUD LAMADDUKELLENG</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto rounded-xl bg-zinc-800 hover:bg-zinc-700 px-5 py-2 text-xs font-bold text-white transition-all shadow-sm"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* Confirmation & Reassign Modal when deleting a room */}
      {roomToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border border-red-800 bg-zinc-950 p-5 sm:p-6 shadow-2xl text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-950 text-red-400 border border-red-800">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-black">Hapus Ruangan "{roomToDelete}"?</h3>
                <p className="text-xs text-zinc-400">Konfirmasi tindakan penghapusan</p>
              </div>
            </div>

            {/* Check if room has data */}
            {(roomStats[roomToDelete]?.total || 0) > 0 ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-amber-700/60 bg-amber-950/40 p-3.5 text-xs text-amber-200 leading-relaxed">
                  <p className="font-bold mb-1">
                    ⚠️ Ruangan ini masih memiliki data terkait:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-amber-300/90 text-[11px]">
                    <li>{roomStats[roomToDelete]?.alkes || 0} unit Alat Kesehatan (Inventaris)</li>
                    <li>{roomStats[roomToDelete]?.pemeliharaan || 0} jadwal/catatan Pemeliharaan (PPM)</li>
                    <li>{roomStats[roomToDelete]?.perbaikan || 0} tiket Formulir Perbaikan</li>
                    <li>{roomStats[roomToDelete]?.bap || 0} Berita Acara Penarikan (BAP)</li>
                  </ul>
                  <p className="mt-2 text-[11px] text-amber-200">
                    Pilih ruangan tujuan di bawah ini untuk <strong>memindahkan semua data</strong> secara aman:
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                    Pindahkan Data ke Ruangan Tujuan: <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={targetReassignRoom}
                    onChange={(e) => setTargetReassignRoom(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-900 py-2.5 px-3 text-xs text-white font-bold focus:border-red-500 focus:outline-none"
                  >
                    {ruanganList
                      .filter((r) => r !== roomToDelete)
                      .map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRoomToDelete(null)}
                    className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 text-xs font-bold text-zinc-300 hover:text-white"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-red-700 hover:bg-red-600 py-2.5 text-xs font-bold text-white shadow-lg transition-all"
                  >
                    <ArrowRight className="h-4 w-4" />
                    <span>Pindahkan & Hapus</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Ruangan ini kosong (tidak ada alkes atau riwayat perbaikan/PPM terdaftar). Anda yakin ingin menghapus ruangan{' '}
                  <strong className="text-white">"{roomToDelete}"</strong>?
                </p>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRoomToDelete(null)}
                    className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 text-xs font-bold text-zinc-300 hover:text-white"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    className="flex-1 rounded-xl bg-red-700 hover:bg-red-600 py-2.5 text-xs font-bold text-white shadow-lg transition-all"
                  >
                    Hapus Ruangan
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
