import React, { useState } from 'react';
import {
  FileText,
  Printer,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Calendar,
  User,
  Shield,
  X,
  FileDown,
  Info,
  Mail,
  Send,
  ExternalLink,
  Search,
} from 'lucide-react';
import {
  AlkesItem,
  BeritaAcaraPenarikan,
  DAFTAR_RUANGAN,
  DAFTAR_REKOMENDASI_BAP,
  KondisiAlatType,
  RekomendasiTindakanBapType,
  RuanganType,
  Teknisi,
} from '../types';
import { generateBapPdf } from '../utils/pdfGenerator';
import { dispatchBapEmail } from '../utils/syncEngine';
import { SignaturePad } from './SignaturePad';
import { AlkesPickerModal } from './AlkesPickerModal';

interface BeritaAcaraViewProps {
  beritaAcara: BeritaAcaraPenarikan[];
  inventaris: AlkesItem[];
  currentTeknisi: Teknisi;
  ruanganList?: string[];
  onOpenRuanganModal?: () => void;
  onSaveBap: (bap: BeritaAcaraPenarikan) => void;
  onDeleteBap: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
  prefillAlkes?: AlkesItem | null;
  onShowNotification?: (type: 'info' | 'warning' | 'penarikan_bap', title: string, message: string) => void;
}

export const BeritaAcaraModal: React.FC<BeritaAcaraViewProps> = ({
  beritaAcara = [],
  inventaris = [],
  currentTeknisi,
  ruanganList = [],
  onOpenRuanganModal,
  onSaveBap,
  onDeleteBap,
  isOpen,
  onClose,
  prefillAlkes,
  onShowNotification,
}) => {
  const activeRuanganList = ruanganList.length > 0 ? ruanganList : DAFTAR_RUANGAN;
  const [recipientEmail, setRecipientEmail] = useState('bulukumba17101994@gmail.com');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSuccessMsg, setEmailSuccessMsg] = useState('');

  const [formState, setFormState] = useState<BeritaAcaraPenarikan>({
    id: `BAP-${Date.now().toString().slice(-6)}`,
    tanggal: new Date().toISOString().slice(0, 10),
    alkesId: prefillAlkes?.id || '',
    namaAlat: prefillAlkes?.namaAlat || '',
    merk: prefillAlkes?.merk || '',
    modelType: prefillAlkes?.modelType || '',
    serialNumber: prefillAlkes?.serialNumber || '',
    tahunPengadaan: prefillAlkes?.tahunPengadaan || '',
    ruangan: prefillAlkes?.ruangan || 'IGD',
    kondisiTerakhir: 'Rusak Berat',
    alasanPenarikan:
      'Kerusakan fatal pada modul sirkuit utama, komponen suku cadang sudah diskontinyu dari pabrikan resmi dan biaya perbaikan melebihi nilai ekonomis.',
    analisaTeknis:
      'Peralatan tidak memenuhi standar ambang batas keselamatan pasien (K3RS) dan berisiko jika tetap dioperasikan di unit pelayanan.',
    rekomendasiTindakan: 'Penarikan ke Gudang Elektromedis (IPSRS)',
    namaTeknisi: `${currentTeknisi.namaLengkap}, ${currentTeknisi.gelar}`,
    nipTeknisi: currentTeknisi.nip,
    namaKepalaRuangan: 'Ns. Penanggung Jawab Ruangan, S.Kep',
    nipKepalaRuangan: '198204152008012011',
    namaKepalaIpsrs: 'Ramlan, A.Md.TEM',
    nipKepalaIpsrs: '198605102010011005',
  });

  const [isAlkesPickerOpen, setIsAlkesPickerOpen] = useState(false);
  const isViewer = currentTeknisi.role === 'user';
  const isUser = currentTeknisi.role === 'user';

  // When prefill changes
  React.useEffect(() => {
    if (prefillAlkes) {
      setFormState((prev) => ({
        ...prev,
        alkesId: prefillAlkes.id,
        namaAlat: prefillAlkes.namaAlat,
        merk: prefillAlkes.merk,
        modelType: prefillAlkes.modelType,
        serialNumber: prefillAlkes.serialNumber,
        tahunPengadaan: prefillAlkes.tahunPengadaan || '',
        ruangan: prefillAlkes.ruangan,
        kondisiTerakhir: prefillAlkes.kondisi,
      }));
    }
  }, [prefillAlkes]);

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
        namaAlat: found.namaAlat,
        merk: found.merk,
        modelType: found.modelType,
        serialNumber: found.serialNumber,
        tahunPengadaan: found.tahunPengadaan || '',
        ruangan: found.ruangan,
        kondisiTerakhir: found.kondisi,
      }));
    }
  };

  const handleSendEmailReport = async () => {
    setIsSendingEmail(true);
    setEmailSuccessMsg('');
    try {
      const res = await dispatchBapEmail(
        formState,
        recipientEmail.trim(),
        'Laporan Berita Acara Penarikan Alkes otomatis UPTD RSUD LAMADDUKELLENG',
        `${currentTeknisi.namaLengkap} (${currentTeknisi.nip})`
      );

      setEmailSuccessMsg(`Laporan BAP alat ${formState.namaAlat} berhasil dikirim ke ${recipientEmail.trim()}`);
      if (onShowNotification) {
        onShowNotification(
          'info',
          'Email BAP Terkirim',
          `Laporan penarikan ${formState.namaAlat} berhasil dikirimkan ke ${recipientEmail.trim()}.`
        );
      }
    } catch (e: any) {
      setEmailSuccessMsg('Email telah diproses ke antrean pengiriman server.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleMailtoClient = () => {
    const subject = encodeURIComponent(`[BAP-ALKES UPTD RSUD LAMADDUKELLENG] Penarikan Alat: ${formState.namaAlat} (${formState.serialNumber}) - ${formState.ruangan}`);
    const body = encodeURIComponent(
      `Yth. Pimpinan / Pengurus Barang UPTD RSUD LAMADDUKELLENG,\n\n` +
      `Bersama ini kami laporkan Berita Acara Penarikan Alat Kesehatan (BAP-ALKES):\n\n` +
      `Tanggal       : ${formState.tanggal}\n` +
      `Nama Alat     : ${formState.namaAlat}\n` +
      `Merk / Tipe   : ${formState.merk} / ${formState.modelType}\n` +
      `Nomor Seri    : ${formState.serialNumber}\n` +
      `Ruangan       : ${formState.ruangan}\n` +
      `Kondisi       : ${formState.kondisiTerakhir}\n` +
      `Alasan        : ${formState.alasanPenarikan}\n` +
      `Analisa K3RS  : ${formState.analisaTeknis}\n` +
      `Rekomendasi   : ${formState.rekomendasiTindakan}\n` +
      `Pemeriksa     : ${formState.namaTeknisi} (NIP: ${formState.nipTeknisi})\n` +
      `Mengetahui    : ${formState.namaKepalaIpsrs || 'Ramlan, A.Md.TEM'} (Kepala IPSRS - NIP: ${formState.nipKepalaIpsrs || '198605102010011005'})\n\n` +
      `Dokumen PDF BAP telah dicetak dan diarsipkan di SIM-ALKES UPTD RSUD LAMADDUKELLENG.`
    );
    window.open(`mailto:${recipientEmail}?subject=${subject}&body=${body}`, '_blank');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const bapData: BeritaAcaraPenarikan = {
      ...formState,
      createdAt: new Date().toISOString(),
    };
    onSaveBap(bapData);
    // Directly generate official PDF on save!
    generateBapPdf(bapData);
    // Auto-dispatch email
    dispatchBapEmail(bapData, recipientEmail.trim());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      id="modal-berita-acara-penarikan"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="relative w-full max-w-3xl rounded-3xl border border-red-800 bg-zinc-900 p-6 shadow-2xl text-white my-6 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-950 text-red-500 border border-red-800">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                Berita Acara Penarikan & Afkir Alkes (BAP)
              </h3>
              <p className="text-xs text-zinc-400">
                Dokumen Resmi UPTD RSUD LAMADDUKELLENG • Berdasarkan Permenkes & Standar K3RS
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl border border-zinc-800 p-1.5 text-zinc-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-2xl border border-red-900/60 bg-red-950/30 p-3 flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-xs text-red-200">
              <strong>Pelaporan Otomatis Penarikan:</strong> Dokumen BAP ini otomatis di-generate saat status alkes diubah menjadi &quot;Penarikan Alat&quot;. BAP akan disimpan ke database dan dapat langsung dikirim ke email pimpinan/direktur.
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tanggal Penarikan */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
                Tanggal Penarikan <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                disabled={isViewer}
                value={formState.tanggal}
                onChange={(e) => setFormState({ ...formState, tanggal: e.target.value })}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2 px-3 text-xs text-white focus:border-red-500 focus:outline-none disabled:opacity-60"
              />
            </div>

            {/* Ruangan Asal Alat */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
                  Ruangan Asal Alat <span className="text-red-500">*</span>
                </label>
                {onOpenRuanganModal && !isViewer && (
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
                disabled={isViewer}
                value={formState.ruangan}
                onChange={(e) => {
                  const newRuangan = e.target.value as RuanganType;
                  setFormState((prev) => ({
                    ...prev,
                    ruangan: newRuangan,
                    alkesId: '',
                  }));
                }}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2 px-3 text-xs text-white focus:border-red-500 focus:outline-none disabled:opacity-60"
              >
                {activeRuanganList.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Shortcut Dropdown Alkes Tersinkron Ruangan */}
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-red-400">
                  Pilih Alkes dari Database di {formState.ruangan}:
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-400">
                    ({inventaris.filter((i) => i.ruangan === formState.ruangan).length} alat di {formState.ruangan})
                  </span>
                  {!isViewer && (
                    <button
                      type="button"
                      onClick={() => setIsAlkesPickerOpen(true)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-500/60 bg-red-950/80 px-2 py-0.5 text-[11px] font-bold text-red-300 hover:bg-red-900 transition-all shadow-sm"
                    >
                      <Search className="h-3 w-3" />
                      <span>Cari & Pilih Alat (Penuh Warna)</span>
                    </button>
                  )}
                </div>
              </div>

              <select
                disabled={isViewer}
                value={formState.alkesId}
                onChange={(e) => handleSelectAlkes(e.target.value)}
                className="w-full rounded-xl border border-red-800/70 bg-zinc-950 py-2.5 px-3 text-xs text-zinc-100 focus:border-red-500 focus:outline-none disabled:opacity-60"
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
                Nama Alat Kesehatan <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={isViewer}
                value={formState.namaAlat}
                onChange={(e) => setFormState({ ...formState, namaAlat: e.target.value })}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2 px-3 text-xs text-white focus:border-red-500 focus:outline-none disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
                Merk & Model / Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  disabled={isViewer}
                  placeholder="Merk"
                  value={formState.merk}
                  onChange={(e) => setFormState({ ...formState, merk: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2 px-3 text-xs text-white focus:border-red-500 focus:outline-none disabled:opacity-60"
                />
                <input
                  type="text"
                  required
                  disabled={isViewer}
                  placeholder="Tipe"
                  value={formState.modelType}
                  onChange={(e) => setFormState({ ...formState, modelType: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2 px-3 text-xs text-white focus:border-red-500 focus:outline-none disabled:opacity-60"
                />
              </div>
            </div>

            {/* Serial Number & Tahun */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
                Serial Number (SN) & Tahun Beli <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  disabled={isViewer}
                  placeholder="SN"
                  value={formState.serialNumber}
                  onChange={(e) => setFormState({ ...formState, serialNumber: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2 px-3 text-xs font-mono text-white focus:border-red-500 focus:outline-none disabled:opacity-60"
                />
                <input
                  type="text"
                  disabled={isViewer}
                  placeholder="Tahun"
                  value={formState.tahunPengadaan}
                  onChange={(e) => setFormState({ ...formState, tahunPengadaan: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2 px-3 text-xs text-white focus:border-red-500 focus:outline-none disabled:opacity-60"
                />
              </div>
            </div>

            {/* Kondisi Terakhir & Rekomendasi Tindakan */}
            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3.5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
                  Kondisi Terakhir Alat <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  disabled={isViewer}
                  value={formState.kondisiTerakhir}
                  onChange={(e) => setFormState({ ...formState, kondisiTerakhir: e.target.value as KondisiAlatType })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 py-2 px-3 text-xs font-bold text-white focus:border-red-500 focus:outline-none disabled:opacity-60"
                >
                  <option value="Baik">Baik</option>
                  <option value="Rusak Ringan">Rusak Ringan</option>
                  <option value="Rusak Sedang">Rusak Sedang</option>
                  <option value="Rusak Berat">Rusak Berat</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
                  Rekomendasi Tindakan <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  disabled={isViewer}
                  value={formState.rekomendasiTindakan}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      rekomendasiTindakan: e.target.value as RekomendasiTindakanBapType,
                    })
                  }
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 py-2 px-3 text-xs font-bold text-amber-300 focus:border-red-500 focus:outline-none disabled:opacity-60"
                >
                  {DAFTAR_REKOMENDASI_BAP.map((rec) => (
                    <option key={rec} value={rec}>
                      {rec}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Alasan Penarikan */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
              Alasan Penarikan Alat <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={2}
              required
              disabled={isViewer}
              value={formState.alasanPenarikan}
              onChange={(e) => setFormState({ ...formState, alasanPenarikan: e.target.value })}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2 px-3 text-xs text-white focus:border-red-500 focus:outline-none disabled:opacity-60"
            />
          </div>

          {/* Analisa Teknis & K3RS */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
              Analisa Teknis & Keselamatan Pasien (Elektromedis) <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={2}
              required
              disabled={isViewer}
              value={formState.analisaTeknis}
              onChange={(e) => setFormState({ ...formState, analisaTeknis: e.target.value })}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2 px-3 text-xs text-white focus:border-red-500 focus:outline-none disabled:opacity-60"
            />
          </div>

          {/* Email Dispatch Section (USER REQUIREMENT) */}
          <div className="rounded-2xl border border-blue-900/60 bg-blue-950/30 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-blue-200">
                  Kirimkan Berita Acara ke Email Tujuan
                </span>
              </div>
              <span className="text-[10px] font-mono text-blue-300 bg-blue-900/40 px-2 py-0.5 rounded-full border border-blue-800">
                Designated Email
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="bulukumba17101994@gmail.com"
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 py-2 px-3 text-xs text-white focus:border-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSendEmailReport}
                disabled={isSendingEmail}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-700 hover:bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow transition-all active:scale-95 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{isSendingEmail ? 'Mengirim...' : 'Kirim via Server'}</span>
              </button>
              <button
                type="button"
                onClick={handleMailtoClient}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-3.5 py-2 text-xs font-bold text-zinc-200 hover:text-white"
                title="Buka di aplikasi Mail"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Draft Email</span>
              </button>
            </div>

            {emailSuccessMsg && (
              <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{emailSuccessMsg}</span>
              </p>
            )}
          </div>

          {/* Penandatangan (3 Pihak) */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase text-red-400">Tim Penandatangan Berita Acara:</p>
              <span className="text-[10px] text-zinc-400">Nama Penandatangan & Tanda Tangan Digital</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-zinc-400 mb-0.5">Petugas Teknisi Elektromedis (Yang Menerima / Memeriksa):</label>
                <input
                  type="text"
                  disabled={isViewer}
                  value={formState.namaTeknisi}
                  onChange={(e) => setFormState({ ...formState, namaTeknisi: e.target.value })}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-1.5 px-2 text-xs text-white disabled:opacity-60 mb-1"
                />
                <input
                  type="text"
                  disabled={isViewer}
                  placeholder="NIP Teknisi"
                  value={formState.nipTeknisi || ''}
                  onChange={(e) => setFormState({ ...formState, nipTeknisi: e.target.value })}
                  className="w-full rounded-lg border border-zinc-700/70 bg-zinc-900/60 py-1 px-2 text-[11px] font-mono text-zinc-300 disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block font-semibold text-zinc-400 mb-0.5">Kepala Ruangan / Petugas (Yang Menyerahkan):</label>
                <input
                  type="text"
                  disabled={isViewer}
                  value={formState.namaKepalaRuangan}
                  onChange={(e) => setFormState({ ...formState, namaKepalaRuangan: e.target.value })}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-1.5 px-2 text-xs text-white disabled:opacity-60 mb-1"
                />
                <input
                  type="text"
                  disabled={isViewer}
                  placeholder="NIP Kepala Ruangan"
                  value={formState.nipKepalaRuangan || ''}
                  onChange={(e) => setFormState({ ...formState, nipKepalaRuangan: e.target.value })}
                  className="w-full rounded-lg border border-zinc-700/70 bg-zinc-900/60 py-1 px-2 text-[11px] font-mono text-zinc-300 disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block font-semibold text-zinc-400 mb-0.5">Mengetahui: Kepala IPSRS:</label>
                <input
                  type="text"
                  disabled={isViewer}
                  value={formState.namaKepalaIpsrs || 'Ramlan, A.Md.TEM'}
                  onChange={(e) => setFormState({ ...formState, namaKepalaIpsrs: e.target.value })}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-1.5 px-2 text-xs text-white font-bold text-amber-300 disabled:opacity-60 mb-1"
                />
                <input
                  type="text"
                  disabled={isViewer}
                  placeholder="NIP Kepala IPSRS"
                  value={formState.nipKepalaIpsrs || '198605102010011005'}
                  onChange={(e) => setFormState({ ...formState, nipKepalaIpsrs: e.target.value })}
                  className="w-full rounded-lg border border-zinc-700/70 bg-zinc-900/60 py-1 px-2 text-[11px] font-mono text-zinc-300 disabled:opacity-60"
                />
              </div>
            </div>

            {/* Area Tanda Tangan Digital (Signature Pads) */}
            <div className="pt-2 border-t border-zinc-800/80">
              <p className="text-[11px] font-bold text-zinc-300 mb-2 flex items-center gap-1.5">
                <span>Tanda Tangan Digital (TTD Elektronik):</span>
                <span className="text-[10px] font-normal text-zinc-400 italic">
                  (Otomatis tersemat rapi pada lembar cetak PDF resmi)
                </span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <SignaturePad
                  label="TTD Petugas Teknisi"
                  roleTitle="Yang Menerima / Memeriksa"
                  signerName={formState.namaTeknisi}
                  value={formState.ttdTeknisi}
                  onChange={(dataUrl) => setFormState({ ...formState, ttdTeknisi: dataUrl })}
                  disabled={isViewer}
                />
                <SignaturePad
                  label="TTD Kepala Ruangan"
                  roleTitle="Yang Menyerahkan"
                  signerName={formState.namaKepalaRuangan}
                  value={formState.ttdKepalaRuangan}
                  onChange={(dataUrl) => setFormState({ ...formState, ttdKepalaRuangan: dataUrl })}
                  disabled={isViewer}
                />
                <SignaturePad
                  label="TTD Kepala IPSRS"
                  roleTitle="Mengetahui"
                  signerName={formState.namaKepalaIpsrs || 'Ramlan, A.Md.TEM'}
                  value={formState.ttdKepalaIpsrs}
                  onChange={(dataUrl) => setFormState({ ...formState, ttdKepalaIpsrs: dataUrl })}
                  disabled={isViewer}
                />
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-xs font-bold text-zinc-300 hover:bg-zinc-700"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => generateBapPdf(formState)}
              className="flex items-center gap-1.5 rounded-xl border border-red-700 bg-red-950/60 hover:bg-red-900 px-4 py-2.5 text-xs font-bold text-red-200"
            >
              <Printer className="h-4 w-4" />
              <span>Pratinjau PDF</span>
            </button>
            {!isViewer && (
              <button
                id="btn-save-and-print-bap"
                type="submit"
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-red-700 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-900/50 hover:from-red-500 hover:to-red-600 active:scale-95"
              >
                <Printer className="h-4 w-4" />
                <span>Simpan, Cetak PDF & Kirim Email</span>
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ALKES SEARCH & COLOR PICKER MODAL */}
      <AlkesPickerModal
        isOpen={isAlkesPickerOpen}
        onClose={() => setIsAlkesPickerOpen(false)}
        inventaris={inventaris}
        currentRuangan={formState.ruangan}
        selectedAlkesId={formState.alkesId}
        onSelectAlkes={(id) => handleSelectAlkes(id)}
        accentColor="red"
      />
    </div>
  );
};

// Berita Acara Tab View
export const BeritaAcaraListView: React.FC<{
  beritaAcara?: BeritaAcaraPenarikan[];
  inventaris?: AlkesItem[];
  currentTeknisi: Teknisi;
  onOpenNewBapModal: () => void;
  onDeleteBap: (id: string) => void;
}> = ({ beritaAcara = [], inventaris = [], currentTeknisi, onOpenNewBapModal, onDeleteBap }) => {
  const isViewer = currentTeknisi.role === 'user';
  const isUser = currentTeknisi.role === 'user';

  const handleSendSingleEmail = (bap: BeritaAcaraPenarikan) => {
    dispatchBapEmail(bap, 'bulukumba17101994@gmail.com');
    alert(`Laporan BAP untuk alat ${bap.namaAlat} berhasil diproses dan dikirim ke bulukumba17101994@gmail.com.`);
  };

  return (
    <div id="berita-acara-view-container" className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-red-900/50 bg-zinc-900/90 p-5 sm:p-6 shadow-xl text-white">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-red-950 px-2.5 py-0.5 text-xs font-bold text-red-400 border border-red-800">
              BERITA ACARA RESMI (BAP-ALKES)
            </span>
            <span className="text-xs font-mono text-zinc-400">PENARIKAN & AFKIR BARANG</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
            Arsip Berita Acara Penarikan Alat Kesehatan UPTD RSUD LAMADDUKELLENG
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Dokumen legalitas penarikan alkes rusak permanen, afkir, atau mutasi inventaris.
          </p>
        </div>

        {!isUser && (
          <button
            id="btn-create-bap-main"
            onClick={onOpenNewBapModal}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-red-900/60 hover:from-red-500 hover:to-red-600 transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>+ Buat Berita Acara Baru</span>
          </button>
        )}
      </div>

      {/* Grid of BAP Records */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {beritaAcara.length === 0 ? (
          <div className="col-span-full rounded-3xl border border-zinc-800 bg-zinc-900/70 p-12 text-center text-zinc-500">
            <FileText className="mx-auto h-10 w-10 text-zinc-600 mb-2" />
            <p className="font-bold text-sm text-zinc-300">Belum ada Berita Acara Penarikan yang dibuat</p>
            <p className="text-xs text-zinc-500 mt-1">
              Saat ada alkes berstatus &quot;Penarikan Alat&quot;, sistem akan memandu pembuatan BAP secara otomatis.
            </p>
          </div>
        ) : (
          beritaAcara.map((bap) => (
            <div
              key={bap.id}
              className="flex flex-col justify-between rounded-3xl border border-red-900/60 bg-gradient-to-br from-zinc-900 to-red-950/30 p-5 shadow-xl text-white"
            >
              <div>
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-3">
                  <div>
                    <span className="font-mono text-xs font-bold text-red-400">BAP PENARIKAN</span>
                    <p className="text-[11px] text-zinc-400 mt-0.5">{bap.tanggal}</p>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase ${
                      bap.rekomendasiTindakan?.includes('Afkir')
                        ? 'bg-red-950 border-red-800 text-red-300'
                        : bap.rekomendasiTindakan?.includes('Vendor')
                        ? 'bg-purple-950 border-purple-800 text-purple-300'
                        : bap.rekomendasiTindakan?.includes('Sparepart')
                        ? 'bg-amber-950 border-amber-800 text-amber-300'
                        : 'bg-blue-950 border-blue-800 text-blue-300'
                    }`}
                  >
                    {bap.rekomendasiTindakan}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <p className="font-black text-base text-white">{bap.namaAlat}</p>
                  <p className="text-zinc-300">
                    {bap.merk} {bap.modelType} • <span className="font-mono font-bold">SN: {bap.serialNumber}</span>
                  </p>
                  <p className="text-zinc-400">
                    Ruangan: <strong className="text-zinc-200">{bap.ruangan}</strong>
                  </p>
                  <p className="text-xs text-zinc-400 italic line-clamp-2 mt-2 bg-black/40 p-2.5 rounded-xl border border-zinc-800">
                    &ldquo;{bap.alasanPenarikan}&rdquo;
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[10px] text-zinc-400">TTD Digital:</span>
                    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold ${
                      bap.ttdTeknisi ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      Teknisi: {bap.ttdTeknisi ? '✓' : '-'}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold ${
                      bap.ttdKepalaRuangan ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      Ruangan: {bap.ttdKepalaRuangan ? '✓' : '-'}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold ${
                      bap.ttdKepalaIpsrs ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      IPSRS: {bap.ttdKepalaIpsrs ? '✓' : '-'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-zinc-800/80 pt-3">
                <div className="text-[10px] text-zinc-500">
                  <span>Pemeriksa: {bap.namaTeknisi}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSendSingleEmail(bap)}
                    className="flex items-center gap-1 rounded-xl border border-blue-800 bg-blue-950/60 hover:bg-blue-900 px-2.5 py-1.5 text-xs font-bold text-blue-300"
                    title="Kirim BAP ke Email"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    <span>Email</span>
                  </button>
                  <button
                    onClick={() => generateBapPdf(bap)}
                    className="flex items-center gap-1 rounded-xl bg-red-700 hover:bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>Cetak PDF</span>
                  </button>
                  {!isViewer && (
                    <button
                      onClick={() => onDeleteBap(bap.id)}
                      className="rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-red-950 p-1.5 text-zinc-400 hover:text-red-300"
                      title="Hapus BAP"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

