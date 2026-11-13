import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  MessageSquare,
  Send,
  Wrench,
  Clock,
  Building2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Printer,
  User,
  Shield,
  Tag,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  Paperclip,
  Image as ImageIcon,
  ThumbsUp,
  Maximize2,
} from 'lucide-react';
import {
  PerbaikanItem,
  PerbaikanComment,
  Teknisi,
  StatusPerbaikanType,
  DAFTAR_STATUS_PERBAIKAN,
  AlkesItem,
} from '../types';
import { generatePerbaikanPdf } from '../utils/pdfGenerator';
import { playMessageSound, unlockAudio } from '../utils/soundAlerts';

interface DetailPerbaikanModalProps {
  isOpen: boolean;
  onClose: () => void;
  perbaikanItem: PerbaikanItem | null;
  inventaris?: AlkesItem[];
  currentTeknisi: Teknisi;
  onAddComment: (
    perbaikanId: string,
    comment: PerbaikanComment,
    updatedStatus?: StatusPerbaikanType
  ) => void;
  onUpdateStatus?: (perbaikanId: string, status: StatusPerbaikanType) => void;
  onRequestBap?: (alkes: any) => void;
  theme?: 'light' | 'dark';
}

const TEMPLATE_REPLIES_TEKNISI = [
  'Alat sedang dalam pengecekan fisik dan kelistrikan oleh tim teknisi elektromedis di ruangan.',
  'Suku cadang (sparepart) sedang dalam proses pengadaan ke distributor resmi.',
  'Perbaikan komponen telah selesai dilakukan. Mohon bantuan petugas ruangan untuk uji fungsi operasional.',
  'Alat perlu dipindahkan sementara ke workshop IPSRS / Elektromedis untuk pengujian lanjutan.',
  'Alat telah dikalibrasi dan dinyatakan layak pakai kembali untuk pelayanan pasien.',
];

const TEMPLATE_REPLIES_PELAPOR = [
  'Alat sudah kami uji fungsi di ruangan dan saat ini dapat beroperasi normal tanpa kendala.',
  'Kendala masih muncul saat alat dinyalakan. Mohon tim teknisi dapat mengecek kembali.',
  'Kerusakan terjadi secara tiba-tiba saat persiapan tindakan pasien. Mohon prioritas penanganan.',
  'Terima kasih banyak atas respon cepat dan perbaikan alat dari tim Elektromedis UPTD RSUD LAMADDUKELLENG.',
];

const STATUS_TAG_OPTIONS = [
  { label: 'Tanpa Tag Khusus', value: '' },
  { label: '🔍 Sedang Pengecekan', value: 'Sedang Pengecekan' },
  { label: '📦 Info Sparepart', value: 'Info Sparepart' },
  { label: '⚙️ Dalam Pengerjaan', value: 'Dalam Pengerjaan' },
  { label: '🧪 Uji Fungsi Ruangan', value: 'Uji Fungsi Ruangan' },
  { label: '✅ Selesai & Normal', value: 'Selesai & Normal' },
  { label: '⚠️ Kendala / Error Baru', value: 'Kendala / Error Baru' },
  { label: '📋 Catatan Administrasi', value: 'Catatan Administrasi' },
];

export const DetailPerbaikanModal: React.FC<DetailPerbaikanModalProps> = ({
  isOpen,
  onClose,
  perbaikanItem,
  currentTeknisi,
  onAddComment,
  onUpdateStatus,
  onRequestBap,
  theme,
}) => {
  const isLight = theme === 'light' || (typeof document !== 'undefined' && document.documentElement.classList.contains('light'));

  const [commentText, setCommentText] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [newStatus, setNewStatus] = useState<StatusPerbaikanType>('');
  const [alsoUpdateStatus, setAlsoUpdateStatus] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [attachmentData, setAttachmentData] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const commentsEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize or reset status when perbaikanItem changes
  useEffect(() => {
    if (perbaikanItem) {
      setNewStatus(perbaikanItem.statusPerbaikan);
      setAlsoUpdateStatus(false);
    }
  }, [perbaikanItem]);

  // Scroll to bottom of comment thread when opened or comments change
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [isOpen, perbaikanItem?.comments?.length]);

  if (!isOpen || !perbaikanItem) return null;

  const comments = perbaikanItem.comments || [];
  const isTeknisi = currentTeknisi.role === 'admin';

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (max 3MB for base64)
    if (file.size > 3 * 1024 * 1024) {
      alert('Ukuran gambar terlalu besar (maksimal 3MB).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAttachmentData(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSendComment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commentText.trim() && !attachmentData) return;

    unlockAudio();
    playMessageSound();

    const newComment: PerbaikanComment = {
      id: `COM-${Date.now().toString().slice(-6)}`,
      perbaikanId: perbaikanItem.id,
      senderName: currentTeknisi.namaLengkap,
      senderRole: isTeknisi ? 'teknisi' : 'pelapor',
      senderUsername: currentTeknisi.username,
      senderNip: currentTeknisi.nip,
      senderRuangan: isTeknisi ? 'IPSRS / Elektromedis' : perbaikanItem.ruangan,
      avatarColor: currentTeknisi.avatarColor || (isTeknisi ? 'bg-red-700' : 'bg-blue-700'),
      message: commentText.trim() || (attachmentData ? '[Foto Lampiran Kerusakan / Perbaikan]' : ''),
      statusTag: selectedTag || undefined,
      timestamp: new Date().toISOString(),
      attachments: attachmentData ? [attachmentData] : undefined,
    };

    const statusToUpdate = alsoUpdateStatus && newStatus ? newStatus : undefined;
    onAddComment(perbaikanItem.id, newComment, statusToUpdate);

    setCommentText('');
    setSelectedTag('');
    setAttachmentData(null);
    setAlsoUpdateStatus(false);

    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendComment();
    }
  };

  const handleApplyTemplate = (tpl: string) => {
    setCommentText((prev) => (prev ? `${prev} ${tpl}` : tpl));
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleQuickPelaporConfirmation = () => {
    const confirmText = `Peralatan medis ${perbaikanItem.namaAlat} telah kami uji fungsi di Ruang ${perbaikanItem.ruangan} dan saat ini berfungsi normal siap melayani pasien. Terima kasih atas respon cepat tim Elektromedis UPTD RSUD LAMADDUKELLENG.`;
    setSelectedTag('✅ Selesai & Normal');
    setCommentText(confirmText);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleQuickStatusChange = (status: StatusPerbaikanType) => {
    if (onUpdateStatus) {
      onUpdateStatus(perbaikanItem.id, status);
    }
  };

  const formatCommentTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const today = new Date();
      const isToday =
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();

      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (isToday) {
        return `Hari ini, ${timeStr} WITA`;
      }
      return `${date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })}, ${timeStr} WITA`;
    } catch (e) {
      return isoString;
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    if (isLight) {
      switch (status) {
        case 'Selesai (Alat Normal)':
          return 'bg-emerald-100 text-black border-emerald-500 font-extrabold';
        case 'Menunggu Sparepart':
          return 'bg-amber-100 text-black border-amber-500 font-extrabold';
        case 'Dalam Proses':
          return 'bg-cyan-100 text-black border-cyan-500 font-extrabold';
        case 'Rekomendasi Perbaikan Vendor':
          return 'bg-purple-100 text-black border-purple-500 font-extrabold';
        case 'Rekomendasi Penarikan':
          return 'bg-red-100 text-black border-red-500 font-extrabold';
        default:
          return 'bg-slate-100 text-black border-slate-300 font-extrabold';
      }
    }
    switch (status) {
      case 'Selesai (Alat Normal)':
        return 'bg-emerald-950 text-emerald-300 border-emerald-800';
      case 'Menunggu Sparepart':
        return 'bg-amber-950 text-amber-300 border-amber-800';
      case 'Dalam Proses':
        return 'bg-cyan-950 text-cyan-300 border-cyan-800';
      case 'Rekomendasi Perbaikan Vendor':
        return 'bg-purple-950 text-purple-300 border-purple-800';
      case 'Rekomendasi Penarikan':
        return 'bg-red-950 text-red-300 border-red-800';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  return (
    <div
      id="modal-detail-perbaikan"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto"
    >
      <div
        className={`relative w-full max-w-5xl rounded-3xl shadow-2xl my-4 flex flex-col max-h-[92vh] overflow-hidden transition-colors ${
          isLight
            ? 'bg-white border-2 border-slate-300 text-black'
            : 'bg-zinc-900 border border-red-900 text-white'
        }`}
      >
        {/* Header Banner */}
        <div
          className={`flex items-center justify-between p-4 sm:p-5 rounded-t-3xl shrink-0 transition-colors ${
            isLight
              ? 'bg-gradient-to-r from-red-600 via-red-700 to-red-800 text-white border-b border-red-700 shadow-sm'
              : 'bg-gradient-to-r from-red-950 via-zinc-900 to-zinc-900 border-b border-zinc-800 text-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-md ${
                isLight
                  ? 'bg-white/20 text-white border border-white/30'
                  : 'bg-red-950 text-red-400 border border-red-800'
              }`}
            >
              <MessageSquare className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase font-mono shadow-xs ${
                    isLight
                      ? 'bg-white text-red-900 border border-white/80'
                      : 'bg-red-900/80 text-red-200 border border-red-700/60'
                  }`}
                >
                  {perbaikanItem.nomorSpk}
                </span>
                <span className={`text-xs font-mono font-semibold ${isLight ? 'text-red-100' : 'text-zinc-400'}`}>
                  {perbaikanItem.ruangan} • {perbaikanItem.tanggal}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white truncate max-w-md sm:max-w-xl">
                {perbaikanItem.namaAlat}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => generatePerbaikanPdf(perbaikanItem)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all shadow-sm cursor-pointer ${
                isLight
                  ? 'bg-white text-red-800 border border-white/80 hover:bg-red-50'
                  : 'border border-zinc-700 bg-zinc-800/80 text-orange-400 hover:bg-zinc-700 hover:text-white'
              }`}
              title="Cetak SPK PDF"
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Cetak SPK</span>
            </button>
            <button
              onClick={onClose}
              className={`rounded-xl p-2 transition-colors cursor-pointer ${
                isLight
                  ? 'bg-white/10 text-white hover:bg-white/25 border border-white/30'
                  : 'border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
              title="Tutup Modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Body: Split View (Detail SPK on Left, Thread Komentar on Right) */}
        <div
          className={`flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-y-auto divide-y lg:divide-y-0 lg:divide-x ${
            isLight ? 'divide-slate-200 bg-slate-50' : 'divide-zinc-800 bg-zinc-950/40'
          }`}
        >
          {/* LEFT COLUMN: Ringkasan Laporan & Status Perbaikan (5 cols on lg) */}
          <div
            className={`lg:col-span-5 p-4 sm:p-5 space-y-4 overflow-y-auto ${
              isLight ? 'bg-slate-50 text-black' : 'bg-zinc-950/40 text-white'
            }`}
          >
            {/* Status Perbaikan Card with Live Switcher */}
            <div
              className={`rounded-2xl p-4 shadow-sm space-y-3 border transition-colors ${
                isLight ? 'bg-white border-slate-200 text-black' : 'bg-zinc-900/90 border-zinc-800 text-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] font-extrabold uppercase tracking-wider ${
                    isLight ? 'text-black' : 'text-zinc-400'
                  }`}
                >
                  Status Perbaikan
                </span>
                <span
                  className={`inline-block rounded-lg px-2.5 py-1 text-xs font-black uppercase border ${getStatusBadgeStyle(
                    perbaikanItem.statusPerbaikan
                  )}`}
                >
                  {perbaikanItem.statusPerbaikan}
                </span>
              </div>

              {/* Status Action Buttons for Teknisi */}
              {isTeknisi && onUpdateStatus && (
                <div className={`pt-2 border-t ${isLight ? 'border-slate-200' : 'border-zinc-800'}`}>
                  <p className={`text-[11px] font-bold mb-1.5 ${isLight ? 'text-black' : 'text-zinc-300'}`}>
                    Ubah Status Cepat (Teknisi IPSRS):
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {DAFTAR_STATUS_PERBAIKAN.map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => handleQuickStatusChange(st)}
                        className={`text-[10px] font-bold py-1.5 px-2 rounded-lg border text-center transition-all truncate cursor-pointer ${
                          perbaikanItem.statusPerbaikan === st
                            ? 'bg-red-600 text-white border-red-500 shadow-sm font-black'
                            : isLight
                            ? 'bg-slate-100 text-black border-slate-300 hover:bg-slate-200'
                            : 'bg-zinc-800/80 text-zinc-300 border-zinc-700 hover:bg-zinc-700 hover:text-white'
                        }`}
                        title={st}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick helper for Petugas Ruangan */}
              {!isTeknisi && (
                <div className={`pt-2 border-t ${isLight ? 'border-slate-200' : 'border-zinc-800'}`}>
                  <button
                    type="button"
                    onClick={handleQuickPelaporConfirmation}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Konfirmasi Uji Fungsi Alat Normal</span>
                  </button>
                </div>
              )}
            </div>

            {/* Keluhan Kerusakan Card */}
            <div
              className={`rounded-2xl p-4 space-y-2 border ${
                isLight ? 'bg-red-50/80 border-red-200 text-black' : 'bg-red-950/20 border-red-900/40 text-white'
              }`}
            >
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-extrabold text-xs uppercase tracking-wider">
                <AlertTriangle className="h-4 w-4" />
                <span>Keluhan Kerusakan dari Ruangan</span>
              </div>
              <p
                className={`text-xs leading-relaxed p-3 rounded-xl border ${
                  isLight
                    ? 'bg-white border-red-200 text-black font-semibold'
                    : 'bg-zinc-900/60 border-red-900/30 text-zinc-200'
                }`}
              >
                &ldquo;{perbaikanItem.keluhanKerusakan || 'Tidak ada catatan keluhan.'}&rdquo;
              </p>
              <div
                className={`flex items-center justify-between text-[11px] pt-1 ${
                  isLight ? 'text-black' : 'text-zinc-400'
                }`}
              >
                <span>
                  Pelapor:{' '}
                  <strong className={isLight ? 'text-black font-extrabold' : 'text-zinc-200'}>
                    {perbaikanItem.pelapor}
                  </strong>
                </span>
                <span>
                  Unit:{' '}
                  <strong className={isLight ? 'text-black font-extrabold' : 'text-zinc-200'}>
                    {perbaikanItem.ruangan}
                  </strong>
                </span>
              </div>
            </div>

            {/* Tindakan & Analisis Teknisi Card */}
            <div
              className={`rounded-2xl p-4 space-y-3 border transition-colors ${
                isLight ? 'bg-white border-slate-200 text-black' : 'bg-zinc-900/90 border-zinc-800 text-white'
              }`}
            >
              <div
                className={`flex items-center gap-2 font-extrabold text-xs uppercase tracking-wider ${
                  isLight ? 'text-black' : 'text-zinc-300'
                }`}
              >
                <Wrench className="h-4 w-4 text-orange-500" />
                <span>Analisis & Tindakan Perbaikan</span>
              </div>

              <div>
                <span
                  className={`text-[10px] font-extrabold uppercase ${
                    isLight ? 'text-black' : 'text-zinc-400'
                  }`}
                >
                  Analisis Teknisi:
                </span>
                <p
                  className={`text-xs mt-0.5 leading-relaxed ${
                    isLight ? 'text-black font-medium' : 'text-zinc-200'
                  }`}
                >
                  {perbaikanItem.analisisTeknisi || '-'}
                </p>
              </div>

              <div className={`pt-2 border-t ${isLight ? 'border-slate-200' : 'border-zinc-800'}`}>
                <span
                  className={`text-[10px] font-extrabold uppercase ${
                    isLight ? 'text-black' : 'text-zinc-400'
                  }`}
                >
                  Tindakan Penanganan:
                </span>
                <p
                  className={`text-xs mt-0.5 leading-relaxed ${
                    isLight ? 'text-black font-medium' : 'text-zinc-200'
                  }`}
                >
                  {perbaikanItem.tindakanPerbaikan || '-'}
                </p>
              </div>

              {perbaikanItem.sparepartDiganti && (
                <div className={`pt-2 border-t ${isLight ? 'border-slate-200' : 'border-zinc-800'}`}>
                  <span
                    className={`text-[10px] font-extrabold uppercase ${
                      isLight ? 'text-amber-800' : 'text-amber-400'
                    }`}
                  >
                    Suku Cadang Diganti:
                  </span>
                  <p
                    className={`text-xs mt-0.5 font-mono ${
                      isLight ? 'text-black font-bold' : 'text-zinc-200'
                    }`}
                  >
                    {perbaikanItem.sparepartDiganti}
                  </p>
                </div>
              )}

              {Boolean(perbaikanItem.biayaEstimasi) && (
                <div
                  className={`pt-2 border-t flex items-center justify-between text-xs ${
                    isLight ? 'border-slate-200 text-black' : 'border-zinc-800 text-zinc-400'
                  }`}
                >
                  <span className="font-semibold">Estimasi Biaya:</span>
                  <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                    Rp {Number(perbaikanItem.biayaEstimasi).toLocaleString('id-ID')}
                  </span>
                </div>
              )}

              <div
                className={`pt-2 border-t text-[11px] flex items-center justify-between ${
                  isLight ? 'border-slate-200 text-black' : 'border-zinc-800 text-zinc-400'
                }`}
              >
                <span>Teknisi Penanggungjawab:</span>
                <span className={isLight ? 'font-extrabold text-black' : 'font-bold text-zinc-200'}>
                  {perbaikanItem.teknisiPelaksana}
                </span>
              </div>
            </div>

            {/* Identitas Alat Kesehatan */}
            <div
              className={`rounded-2xl p-4 space-y-2 text-xs border ${
                isLight ? 'bg-white border-slate-200 text-black' : 'bg-zinc-900/90 border-zinc-800 text-white'
              }`}
            >
              <span
                className={`text-[11px] font-extrabold uppercase tracking-wider block ${
                  isLight ? 'text-black' : 'text-zinc-400'
                }`}
              >
                Spesifikasi Alat
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className={isLight ? 'text-slate-600 block' : 'text-zinc-400 block'}>Merk / Brand:</span>
                  <span className={isLight ? 'font-black text-black' : 'font-bold text-zinc-200'}>
                    {perbaikanItem.merk}
                  </span>
                </div>
                <div>
                  <span className={isLight ? 'text-slate-600 block' : 'text-zinc-400 block'}>Tipe / Model:</span>
                  <span className={isLight ? 'font-black text-black' : 'font-bold text-zinc-200'}>
                    {perbaikanItem.modelType}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className={isLight ? 'text-slate-600 block' : 'text-zinc-400 block'}>
                    Serial Number (SN):
                  </span>
                  <span className="font-mono font-black text-cyan-600 dark:text-cyan-400">
                    {perbaikanItem.serialNumber}
                  </span>
                </div>
              </div>
            </div>

            {/* BAP Action if Recommended */}
            {perbaikanItem.statusPerbaikan === 'Rekomendasi Penarikan' && onRequestBap && (
              <div
                className={`rounded-2xl p-3 flex items-center justify-between gap-2 border ${
                  isLight ? 'bg-red-50 border-red-300 text-black' : 'bg-red-950/40 border-red-800 text-red-200'
                }`}
              >
                <div className="text-xs">
                  <p className="font-black text-red-700 dark:text-red-300">Rekomendasi Penarikan Aktif</p>
                  <p className="text-[11px] text-slate-700 dark:text-red-300">
                    Alat membutuhkan Berita Acara Penarikan (BAP)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRequestBap(perbaikanItem)}
                  className="rounded-xl bg-red-700 hover:bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm cursor-pointer"
                >
                  Buka BAP
                </button>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Interactive Comment Thread (7 cols on lg) */}
          <div
            className={`lg:col-span-7 flex flex-col h-full overflow-hidden ${
              isLight ? 'bg-slate-100/60' : 'bg-zinc-900/30'
            }`}
          >
            {/* Thread Header Info */}
            <div
              className={`flex items-center justify-between px-4 sm:px-5 py-3 border-b shrink-0 ${
                isLight ? 'bg-white border-slate-200 text-black' : 'bg-zinc-950/60 border-zinc-800 text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                    isLight ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-red-950 text-red-400 border border-red-800'
                  }`}
                >
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <h3 className={`text-xs font-extrabold ${isLight ? 'text-black' : 'text-white'}`}>
                    Thread Diskusi Status & Progres Perbaikan
                  </h3>
                  <p className={`text-[10px] ${isLight ? 'text-slate-600 font-medium' : 'text-zinc-400'}`}>
                    Komunikasi langsung Petugas Ruangan & Teknisi Elektromedis UPTD RSUD LAMADDUKELLENG
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono font-black ${
                  isLight
                    ? 'bg-slate-200 text-black border border-slate-300'
                    : 'bg-zinc-800 text-zinc-300'
                }`}
              >
                {comments.length} Pesan
              </span>
            </div>

            {/* Messages Feed Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${
                      isLight
                        ? 'bg-white border-slate-300 text-slate-400'
                        : 'bg-zinc-800/80 border-zinc-700 text-zinc-400'
                    }`}
                  >
                    <MessageSquare className="h-7 w-7 opacity-60" />
                  </div>
                  <h4 className={`text-sm font-bold ${isLight ? 'text-black' : 'text-zinc-200'}`}>
                    Belum Ada Komentar
                  </h4>
                  <p className={`text-xs max-w-sm ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                    Kirim pesan pertama untuk mengabarkan perkembangan penanganan alat medis,
                    mengonfirmasi kendala, atau menanyakan perkiraan suku cadang.
                  </p>
                </div>
              ) : (
                comments.map((c) => {
                  const isCurrentUser =
                    c.senderUsername === currentTeknisi.username ||
                    c.senderName === currentTeknisi.namaLengkap;
                  const isCommentTeknisi = c.senderRole === 'teknisi' || c.senderRole === 'admin';

                  return (
                    <div
                      key={c.id}
                      className={`flex items-start gap-2.5 ${
                        isCurrentUser ? 'flex-row-reverse' : 'flex-row'
                      }`}
                    >
                      {/* Avatar */}
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-black text-xs text-white shadow-sm border border-white/20 ${
                          c.avatarColor || (isCommentTeknisi ? 'bg-red-700' : 'bg-blue-600')
                        }`}
                      >
                        {c.senderName ? c.senderName.charAt(0) : 'U'}
                      </div>

                      {/* Message Bubble */}
                      <div
                        className={`max-w-[85%] sm:max-w-md rounded-2xl p-3.5 shadow-md border ${
                          isCurrentUser
                            ? 'bg-gradient-to-br from-red-600 via-red-700 to-red-800 border-red-500 text-white rounded-tr-none'
                            : isLight
                            ? 'bg-white border-slate-300 text-black rounded-tl-none shadow-sm'
                            : isCommentTeknisi
                            ? 'bg-zinc-850 border-red-900/50 text-zinc-100 rounded-tl-none'
                            : 'bg-zinc-800/90 border-blue-900/40 text-zinc-100 rounded-tl-none'
                        }`}
                      >
                        {/* Header of message bubble */}
                        <div
                          className={`flex items-center justify-between gap-3 mb-1.5 border-b pb-1 ${
                            isCurrentUser
                              ? 'border-white/20 text-white'
                              : isLight
                              ? 'border-slate-200 text-black'
                              : 'border-white/10 text-zinc-300'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-[11px] font-extrabold leading-tight ${
                                isCurrentUser ? 'text-white' : isLight ? 'text-black' : 'text-zinc-100'
                              }`}
                            >
                              {c.senderName}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.2 text-[9px] font-bold ${
                                isCurrentUser
                                  ? 'bg-white/20 text-white border border-white/30'
                                  : isLight
                                  ? isCommentTeknisi
                                    ? 'bg-red-100 text-red-900 border border-red-300'
                                    : 'bg-blue-100 text-blue-900 border border-blue-300'
                                  : isCommentTeknisi
                                  ? 'bg-red-950 text-red-300 border border-red-800/50'
                                  : 'bg-blue-950 text-blue-300 border border-blue-800/50'
                              }`}
                            >
                              {isCommentTeknisi ? 'Teknisi Elektromedis' : 'Petugas Ruangan'}
                            </span>
                          </div>

                          <div
                            className={`flex items-center gap-1.5 text-[9px] font-mono ${
                              isCurrentUser
                                ? 'text-red-100'
                                : isLight
                                ? 'text-slate-500'
                                : 'text-zinc-400'
                            }`}
                          >
                            <span>{formatCommentTime(c.timestamp)}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyMessage(c.id, c.message)}
                              className={`hover:opacity-100 transition-opacity cursor-pointer ${
                                isCurrentUser ? 'text-white' : isLight ? 'text-black' : 'text-zinc-400'
                              }`}
                              title="Salin Pesan"
                            >
                              {copiedId === c.id ? (
                                <Check className="h-3 w-3 text-emerald-300" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Status Tag Badge if attached */}
                        {c.statusTag && (
                          <div className="mb-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold border ${
                                isCurrentUser
                                  ? 'bg-white/20 text-white border-white/40'
                                  : isLight
                                  ? 'bg-amber-50 text-black border-amber-300'
                                  : 'bg-white/10 text-amber-200 border-amber-300/30'
                              }`}
                            >
                              <Tag className="h-2.5 w-2.5" />
                              {c.statusTag}
                            </span>
                          </div>
                        )}

                        {/* Message text */}
                        <p
                          className={`text-xs leading-relaxed whitespace-pre-wrap select-text font-medium ${
                            isCurrentUser ? 'text-white' : isLight ? 'text-black' : 'text-zinc-100'
                          }`}
                        >
                          {c.message}
                        </p>

                        {/* Photo attachments */}
                        {c.attachments && c.attachments.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            {c.attachments.map((img, i) => (
                              <div
                                key={i}
                                onClick={() => setPreviewImage(img)}
                                className="group relative h-20 w-24 rounded-lg overflow-hidden border border-white/30 cursor-pointer shadow-sm"
                              >
                                <img
                                  src={img}
                                  alt="Lampiran"
                                  className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                                />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <Maximize2 className="h-4 w-4 text-white" />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={commentsEndRef} />
            </div>

            {/* Quick Templates Bar */}
            <div
              className={`p-2.5 shrink-0 border-t ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-zinc-950/70 border-zinc-800'
              }`}
            >
              <div
                className={`flex items-center gap-1.5 text-[10px] font-extrabold mb-1.5 px-1 ${
                  isLight ? 'text-black' : 'text-zinc-400'
                }`}
              >
                <Sparkles className="h-3 w-3 text-red-500" />
                <span>Balasan Cepat (Template {isTeknisi ? 'Teknisi' : 'Ruangan'}):</span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {(isTeknisi ? TEMPLATE_REPLIES_TEKNISI : TEMPLATE_REPLIES_PELAPOR).map((tpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleApplyTemplate(tpl)}
                    className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] transition-all whitespace-nowrap active:scale-95 cursor-pointer font-semibold border ${
                      isLight
                        ? 'border-slate-300 bg-white text-black hover:border-slate-400 hover:bg-slate-100 shadow-xs'
                        : 'border-zinc-700 bg-zinc-800/80 text-zinc-300 hover:border-zinc-500 hover:text-white'
                    }`}
                  >
                    {tpl.length > 40 ? `${tpl.slice(0, 40)}...` : tpl}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Bar */}
            <form
              onSubmit={handleSendComment}
              className={`p-3 sm:p-4 space-y-2.5 shrink-0 border-t ${
                isLight ? 'bg-white border-slate-200 text-black' : 'bg-zinc-950 border-zinc-800 text-white'
              }`}
            >
              {/* Optional Controls Bar (Role indicator & Status Tag attachment) */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className={`flex items-center gap-1.5 ${isLight ? 'text-slate-700' : 'text-zinc-400'}`}>
                  <User className="h-3.5 w-3.5 text-red-500" />
                  <span>Kirim sebagai:</span>
                  <span className={`font-black ${isLight ? 'text-black' : 'text-white'}`}>
                    {currentTeknisi.namaLengkap} ({isTeknisi ? 'Teknisi' : 'Pelapor Ruangan'})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <label htmlFor="select-comment-tag" className={`text-[10px] font-bold ${isLight ? 'text-black' : 'text-zinc-400'}`}>
                    Tag Status:
                  </label>
                  <select
                    id="select-comment-tag"
                    value={selectedTag}
                    onChange={(e) => setSelectedTag(e.target.value)}
                    className={`rounded-lg py-1 px-2 text-[11px] font-semibold border focus:outline-none ${
                      isLight
                        ? 'border-slate-300 bg-slate-50 text-black focus:border-red-600 focus:bg-white'
                        : 'border-zinc-700 bg-zinc-900 text-zinc-300 focus:border-red-500'
                    }`}
                  >
                    {STATUS_TAG_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Checkbox for Teknisi to advance status simultaneously */}
              {isTeknisi && onUpdateStatus && (
                <div
                  className={`flex items-center gap-2 p-2 rounded-xl border ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 text-black'
                      : 'bg-zinc-900/60 border-zinc-800 text-zinc-300'
                  }`}
                >
                  <input
                    id="check-also-update-status"
                    type="checkbox"
                    checked={alsoUpdateStatus}
                    onChange={(e) => setAlsoUpdateStatus(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-400 bg-white text-red-600 focus:ring-red-500 cursor-pointer"
                  />
                  <label
                    htmlFor="check-also-update-status"
                    className={`text-xs cursor-pointer select-none font-semibold ${
                      isLight ? 'text-black' : 'text-zinc-300'
                    }`}
                  >
                    Perbarui status perbaikan alat menjadi:
                  </label>
                  {alsoUpdateStatus && (
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as StatusPerbaikanType)}
                      className={`rounded-lg py-0.5 px-2 text-xs font-bold border focus:outline-none ${
                        isLight
                          ? 'border-red-400 bg-white text-red-800 focus:border-red-600'
                          : 'border-red-800 bg-red-950/80 text-red-200 focus:border-red-500'
                      }`}
                    >
                      {DAFTAR_STATUS_PERBAIKAN.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Attachment Preview thumbnail if selected */}
              {attachmentData && (
                <div className="flex items-center gap-2 p-1.5 rounded-xl border border-red-300 bg-red-50 text-xs">
                  <img
                    src={attachmentData}
                    alt="Lampiran"
                    className="h-10 w-12 object-cover rounded-lg border border-red-200"
                  />
                  <span className="text-black font-semibold text-[11px] flex-1 truncate">
                    Foto terlampir siap dikirim
                  </span>
                  <button
                    type="button"
                    onClick={() => setAttachmentData(null)}
                    className="text-red-700 hover:text-red-900 text-xs font-bold px-2 py-0.5"
                  >
                    Batal
                  </button>
                </div>
              )}

              {/* Textarea & Send button */}
              <div className="flex items-end gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-all cursor-pointer ${
                    attachmentData
                      ? 'bg-red-100 text-red-700 border-red-400'
                      : isLight
                      ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200 hover:text-black'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:bg-zinc-800 hover:text-white'
                  }`}
                  title="Lampirkan Foto Bukti Kerusakan / Perbaikan"
                >
                  <ImageIcon className="h-4 w-4" />
                </button>

                <div className="relative flex-1">
                  <textarea
                    ref={textareaRef}
                    rows={2}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Tulis pesan atau perkembangan penanganan alat di sini... (Enter untuk kirim)"
                    className={`w-full rounded-2xl p-2.5 text-xs focus:outline-none focus:ring-1 resize-none leading-relaxed border ${
                      isLight
                        ? 'border-slate-300 bg-slate-50 text-black placeholder-slate-400 focus:bg-white focus:border-red-600 focus:ring-red-600 font-medium'
                        : 'border-zinc-700 bg-zinc-900 text-white placeholder-zinc-500 focus:border-red-500 focus:ring-red-500'
                    }`}
                  />
                </div>

                <button
                  type="submit"
                  disabled={!commentText.trim() && !attachmentData}
                  className="flex h-10 items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-red-600 to-red-700 px-4 text-xs font-bold text-white shadow-md shadow-red-950/30 transition-all hover:from-red-500 hover:to-red-600 active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                  <span className="hidden sm:inline">Kirim</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Image Full Preview Modal if an attached image is clicked */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 p-4 cursor-pointer"
        >
          <div className="relative max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl">
            <img
              src={previewImage}
              alt="Preview Lampiran"
              className="max-h-[85vh] max-w-full object-contain rounded-2xl"
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 rounded-full bg-black/60 p-2 text-white hover:bg-black"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DetailPerbaikanModal;
