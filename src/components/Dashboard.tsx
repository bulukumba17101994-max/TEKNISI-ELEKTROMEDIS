import React, { useState, useMemo } from 'react';
import {
  Activity,
  Layers,
  FileCheck2,
  Wrench,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  QrCode,
  RefreshCw,
  TrendingUp,
  ShieldCheck,
  Building2,
  Calendar,
  Sparkles,
  ArrowUpRight,
  MessageSquare,
  ChevronRight,
  Printer,
  Download,
  Search,
  FileSpreadsheet,
  SlidersHorizontal,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { AlkesItem, PemeliharaanItem, PerbaikanItem, Teknisi, BeritaAcaraPenarikan, TabMenuType } from '../types';
import { EkgMonitor } from './EkgMonitor';
import { generateLaporanBulananPdf } from '../utils/pdfGenerator';

interface DashboardProps {
  currentTeknisi: Teknisi;
  inventaris?: AlkesItem[];
  pemeliharaan?: PemeliharaanItem[];
  perbaikan?: PerbaikanItem[];
  beritaAcara?: BeritaAcaraPenarikan[];
  ruanganList?: string[];
  onOpenRuanganModal?: () => void;
  onNavigate?: (tab: TabMenuType) => void;
  onNavigateTab?: (tab: TabMenuType) => void;
  onOpenQrScanner?: () => void;
  onOpenSyncModal?: () => void;
  onOpenNewAlkesModal?: () => void;
  onOpenNewPpmModal?: () => void;
  onOpenNewBapModal?: (alkes?: AlkesItem) => void;
  onRequestBap?: (alkes?: AlkesItem) => void;
  onOpenPerbaikanThread?: (item: PerbaikanItem) => void;
  theme?: 'light' | 'dark';
}

export const Dashboard: React.FC<DashboardProps> = ({
  currentTeknisi,
  inventaris = [],
  pemeliharaan = [],
  perbaikan = [],
  beritaAcara = [],
  ruanganList = [],
  onOpenRuanganModal,
  onNavigate,
  onNavigateTab,
  onOpenQrScanner,
  onOpenSyncModal,
  onOpenNewAlkesModal,
  onOpenNewPpmModal,
  onOpenNewBapModal,
  onRequestBap,
  onOpenPerbaikanThread,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const totalRuanganCount = ruanganList.length > 0 ? ruanganList.length : 28;
  const handleNav = (tab: TabMenuType) => {
    if (onNavigate) onNavigate(tab);
    else if (onNavigateTab) onNavigateTab(tab);
  };

  const handleBapTrigger = (alkes?: AlkesItem) => {
    if (onOpenNewBapModal) onOpenNewBapModal(alkes);
    else if (onRequestBap) onRequestBap(alkes);
  };
  // Personalized Greeting Text as per user instructions
  const getGreetingHeader = () => {
    switch (currentTeknisi.username) {
      case 'adi':
        return {
          title: `${currentTeknisi.namaLengkap}, ${currentTeknisi.gelar}`,
          sub: `NIP: ${currentTeknisi.nip} • Koordinator & Teknisi Elektromedis`,
        };
      case 'ramlan':
        return {
          title: `Selamat Datang, ${currentTeknisi.namaLengkap}, ${currentTeknisi.gelar}`,
          sub: `NIP: ${currentTeknisi.nip} • Teknisi Elektromedis`,
        };
      case 'uki':
        return {
          title: `Selamat Datang, ${currentTeknisi.namaLengkap}, ${currentTeknisi.gelar}`,
          sub: `NIP: ${currentTeknisi.nip} • Teknisi Elektromedis`,
        };
      case 'faisal':
        return {
          title: `Selamat Datang, ${currentTeknisi.namaLengkap}, ${currentTeknisi.gelar}`,
          sub: `NIP: ${currentTeknisi.nip} • Teknisi Elektromedis`,
        };
      case 'user':
        return {
          title: `Selamat Datang, Petugas Ruangan`,
          sub: `Pelapor Kerusakan Alat Medis Unit Ruangan UPTD RSUD LAMADDUKELLENG`,
        };
      default:
        return {
          title: `Selamat Datang, ${currentTeknisi.namaLengkap}`,
          sub: `NIP: ${currentTeknisi.nip}`,
        };
    }
  };

  const greeting = getGreetingHeader();

  // Check if admin or teknisi account (Laporan Bulanan is accessible for Admin & Teknisi)
  const isAdminOrTeknisi =
    currentTeknisi.role === 'admin' ||
    (currentTeknisi.role as string) === 'teknisi' ||
    currentTeknisi.username !== 'user';

  // Laporan Bulanan State & Period Management
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);
  const [activeReportTab, setActiveReportTab] = useState<'perbaikan' | 'pemeliharaan' | 'ruangan'>('perbaikan');
  const [reportSearchQuery, setReportSearchQuery] = useState('');

  const NAMA_BULAN = [
    { value: '01', label: 'Januari' },
    { value: '02', label: 'Februari' },
    { value: '03', label: 'Maret' },
    { value: '04', label: 'April' },
    { value: '05', label: 'Mei' },
    { value: '06', label: 'Juni' },
    { value: '07', label: 'Juli' },
    { value: '08', label: 'Agustus' },
    { value: '09', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'Desember' },
  ];

  const availableYears = ['2024', '2025', '2026', '2027'];
  const [selYear, selMonth] = selectedMonth.split('-');
  const namaBulanLabel = `${NAMA_BULAN.find((b) => b.value === selMonth)?.label || selMonth} ${selYear}`;
  const isCurrentMonthSelected = selectedMonth === currentMonthKey;

  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    let newY = y;
    let newM = m - 1;
    if (newM < 1) {
      newM = 12;
      newY -= 1;
    }
    setSelectedMonth(`${newY}-${String(newM).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    let newY = y;
    let newM = m + 1;
    if (newM > 12) {
      newM = 1;
      newY += 1;
    }
    setSelectedMonth(`${newY}-${String(newM).padStart(2, '0')}`);
  };

  const handleJumpToCurrentMonth = () => {
    setSelectedMonth(currentMonthKey);
  };

  // Filter perbaikan for selected month
  const perbaikanBulan = useMemo(() => {
    return perbaikan.filter((p) => p.tanggal && p.tanggal.startsWith(selectedMonth));
  }, [perbaikan, selectedMonth]);

  // Filter pemeliharaan for selected month
  const ppmBulan = useMemo(() => {
    return pemeliharaan.filter((p) => p.tanggal && p.tanggal.startsWith(selectedMonth));
  }, [pemeliharaan, selectedMonth]);

  // Metrics for perbaikan
  const totalPerbaikanBulan = perbaikanBulan.length;
  const perbaikanSelesaiBulan = perbaikanBulan.filter((p) => p.statusPerbaikan === 'Selesai (Alat Normal)').length;
  const perbaikanProsesBulan = perbaikanBulan.filter(
    (p) => p.statusPerbaikan === 'Dalam Proses' || p.statusPerbaikan === 'Menunggu Sparepart'
  ).length;
  const perbaikanPenarikanBulan = perbaikanBulan.filter(
    (p) => p.statusPerbaikan === 'Rekomendasi Penarikan' || p.statusPerbaikan === 'Rekomendasi Perbaikan Vendor'
  ).length;
  const totalBiayaBulan = perbaikanBulan.reduce((acc, curr) => acc + (curr.biayaEstimasi || 0), 0);
  const rasioSelesaiBulan = totalPerbaikanBulan > 0 ? Math.round((perbaikanSelesaiBulan / totalPerbaikanBulan) * 100) : 0;

  // Metrics for PPM
  const totalPpmBulan = ppmBulan.length;
  const ppmLayakBulan = ppmBulan.filter((p) => p.status === 'layak pakai').length;
  const ppmPerluPerbaikanBulan = totalPpmBulan - ppmLayakBulan;
  const rasioLayakPpm = totalPpmBulan > 0 ? Math.round((ppmLayakBulan / totalPpmBulan) * 100) : 0;

  // Total Activity
  const totalAktivitas = totalPerbaikanBulan + totalPpmBulan;

  // Filtered lists by search query
  const filteredPerbaikanBulan = useMemo(() => {
    if (!reportSearchQuery.trim()) return perbaikanBulan;
    const q = reportSearchQuery.toLowerCase();
    return perbaikanBulan.filter(
      (p) =>
        p.namaAlat.toLowerCase().includes(q) ||
        p.nomorSpk.toLowerCase().includes(q) ||
        p.ruangan.toLowerCase().includes(q) ||
        p.pelapor.toLowerCase().includes(q) ||
        p.keluhanKerusakan.toLowerCase().includes(q) ||
        (p.teknisiPelaksana && p.teknisiPelaksana.toLowerCase().includes(q))
    );
  }, [perbaikanBulan, reportSearchQuery]);

  const filteredPpmBulan = useMemo(() => {
    if (!reportSearchQuery.trim()) return ppmBulan;
    const q = reportSearchQuery.toLowerCase();
    return ppmBulan.filter(
      (p) =>
        p.namaAlat.toLowerCase().includes(q) ||
        p.ruangan.toLowerCase().includes(q) ||
        p.namaTeknisi.toLowerCase().includes(q) ||
        (p.catatan && p.catatan.toLowerCase().includes(q))
    );
  }, [ppmBulan, reportSearchQuery]);

  // Room Activity Distribution in Selected Month
  const roomActivityMap = useMemo(() => {
    const map: Record<string, { perbaikan: number; ppm: number; biaya: number }> = {};
    perbaikanBulan.forEach((p) => {
      if (!map[p.ruangan]) map[p.ruangan] = { perbaikan: 0, ppm: 0, biaya: 0 };
      map[p.ruangan].perbaikan += 1;
      map[p.ruangan].biaya += p.biayaEstimasi || 0;
    });
    ppmBulan.forEach((p) => {
      if (!map[p.ruangan]) map[p.ruangan] = { perbaikan: 0, ppm: 0, biaya: 0 };
      map[p.ruangan].ppm += 1;
    });
    return Object.entries(map)
      .map(([ruangan, data]) => ({
        ruangan,
        ...data,
        total: data.perbaikan + data.ppm,
      }))
      .sort((a, b) => b.total - a.total);
  }, [perbaikanBulan, ppmBulan]);

  const handlePrintMonthlyPdf = () => {
    generateLaporanBulananPdf(selectedMonth, namaBulanLabel, perbaikanBulan, ppmBulan, currentTeknisi);
  };

  const handleExportMonthlyCsv = () => {
    const lines: string[] = [];
    lines.push(`"LAPORAN KINERJA BULANAN INSTALASI ELEKTROMEDIS (IPSRS) - UPTD RSUD LAMADDUKELLENG"`);
    lines.push(`"Periode: ${namaBulanLabel}"`);
    lines.push(`"Tanggal Unduh: ${new Date().toLocaleDateString('id-ID')}"`);
    lines.push(``);
    lines.push(`"RINGKASAN KINERJA BULANAN"`);
    lines.push(`"Total Laporan Perbaikan (SPK)",${totalPerbaikanBulan}`);
    lines.push(`"Perbaikan Selesai",${perbaikanSelesaiBulan}`);
    lines.push(`"Dalam Proses / Menunggu Sparepart",${perbaikanProsesBulan}`);
    lines.push(`"Total Pemeliharaan Berkala (PPM)",${totalPpmBulan}`);
    lines.push(`"PPM Layak Pakai",${ppmLayakBulan}`);
    lines.push(`"PPM Perlu Perbaikan",${ppmPerluPerbaikanBulan}`);
    lines.push(`"Total Estimasi Biaya Perbaikan (Rp)",${totalBiayaBulan}`);
    lines.push(``);
    lines.push(`"BAGIAN 1: REKAPITULASI LAPORAN & PERBAIKAN ALKES (SPK)"`);
    lines.push(`"No","Tanggal","Nomor SPK","Ruangan","Nama Alat","Merk","Tipe","SN","Pelapor","Keluhan","Tindakan","Suku Cadang","Estimasi Biaya (Rp)","Status Akhir","Teknisi"`);
    perbaikanBulan.forEach((p, idx) => {
      lines.push(
        [
          idx + 1,
          `"${p.tanggal}"`,
          `"${p.nomorSpk}"`,
          `"${p.ruangan}"`,
          `"${p.namaAlat.replace(/"/g, '""')}"`,
          `"${p.merk.replace(/"/g, '""')}"`,
          `"${(p.modelType || '').replace(/"/g, '""')}"`,
          `"${p.serialNumber}"`,
          `"${p.pelapor.replace(/"/g, '""')}"`,
          `"${(p.keluhanKerusakan || '').replace(/"/g, '""')}"`,
          `"${(p.tindakanPerbaikan || '').replace(/"/g, '""')}"`,
          `"${(p.sparepartDiganti || '').replace(/"/g, '""')}"`,
          p.biayaEstimasi || 0,
          `"${p.statusPerbaikan}"`,
          `"${p.teknisiPelaksana}"`,
        ].join(',')
      );
    });
    lines.push(``);
    lines.push(`"BAGIAN 2: REKAPITULASI RIWAYAT PEMELIHARAAN ALKES (PPM)"`);
    lines.push(`"No","Tanggal","Ruangan","Nama Alat","Merk","Tipe","SN","Teknisi","Pemeriksaan Fisik","Setting & Pemanasan","Cleaning","Kondisi","Status Kelayakan","Catatan"`);
    ppmBulan.forEach((m, idx) => {
      lines.push(
        [
          idx + 1,
          `"${m.tanggal}"`,
          `"${m.ruangan}"`,
          `"${m.namaAlat.replace(/"/g, '""')}"`,
          `"${m.merk.replace(/"/g, '""')}"`,
          `"${(m.modelType || '').replace(/"/g, '""')}"`,
          `"${m.serialNumber}"`,
          `"${m.namaTeknisi}"`,
          m.kegiatanFisik ? '"Ya"' : '"Tidak"',
          m.kegiatanSetting ? '"Ya"' : '"Tidak"',
          m.kegiatanCleaning ? '"Ya"' : '"Tidak"',
          `"${m.kondisi}"`,
          `"${m.status}"`,
          `"${(m.catatan || '').replace(/"/g, '""')}"`,
        ].join(',')
      );
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(lines.join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `LAPORAN_BULANAN_IPSRS_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Metrics Calculation
  const totalAlkes = inventaris.length;
  const baikAlkes = inventaris.filter((i) => i.kondisi === 'Baik').length;
  const rusakRingan = inventaris.filter((i) => i.kondisi === 'Rusak Ringan').length;
  const rusakSedang = inventaris.filter((i) => i.kondisi === 'Rusak Sedang').length;
  const rusakBerat = inventaris.filter((i) => i.kondisi === 'Rusak Berat').length;

  const terkalibrasi = inventaris.filter((i) => i.statusKalibrasi === 'Terkalibrasi').length;
  const perluKalibrasi = inventaris.filter((i) => i.statusKalibrasi === 'Perlu Kalibrasi' || i.statusKalibrasi === 'Kadaluarsa').length;
  const penarikanAlatCount = inventaris.filter((i) => i.keterangan === 'Penarikan Alat').length;

  // Chart 1: Donut Chart data for Kondisi Alat
  const kondisiChartData = [
    { name: 'Baik', value: baikAlkes, color: '#16a34a' },
    { name: 'Rusak Ringan', value: rusakRingan, color: '#eab308' },
    { name: 'Rusak Sedang', value: rusakSedang, color: '#f97316' },
    { name: 'Rusak Berat', value: rusakBerat, color: '#dc2626' },
  ].filter((d) => d.value > 0);

  // Chart 2: Bar Chart data for Alkes Distribution across Top Rooms
  const roomMap: Record<string, number> = {};
  inventaris.forEach((item) => {
    roomMap[item.ruangan] = (roomMap[item.ruangan] || 0) + 1;
  });

  const roomChartData = Object.entries(roomMap)
    .map(([ruangan, jumlah]) => ({ ruangan, jumlah }))
    .sort((a, b) => b.jumlah - a.jumlah)
    .slice(0, 10);

  // Urgent list: Alkes with 'Penarikan Alat' or 'Kadaluarsa'
  const urgentList = inventaris.filter(
    (item) => item.keterangan === 'Penarikan Alat' || item.statusKalibrasi === 'Kadaluarsa' || item.kondisi === 'Rusak Berat'
  );

  const reportsWithComments = useMemo(() => {
    return perbaikan
      .filter((p) => p.comments && p.comments.length > 0)
      .sort((a, b) => {
        const lastA = a.comments?.[a.comments.length - 1]?.timestamp || a.updatedAt || '';
        const lastB = b.comments?.[b.comments.length - 1]?.timestamp || b.updatedAt || '';
        return new Date(lastB).getTime() - new Date(lastA).getTime();
      });
  }, [perbaikan]);

  return (
    <div id="dashboard-view" className="space-y-6 pb-12">
      {/* Welcome Banner Card with Medical Blood Red Theme */}
      <div className="relative overflow-hidden rounded-3xl border border-red-900/60 bg-gradient-to-r from-red-950 via-zinc-900 to-black p-6 sm:p-8 text-white shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-red-900/50 border border-red-700/50 px-3 py-1 text-xs font-bold text-red-200 mb-3">
              <ShieldCheck className="h-3.5 w-3.5 text-red-400" />
              SISTEM ELEKTROMEDIS UPTD RSUD LAMADDUKELLENG
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white drop-shadow">
              {greeting.title}
            </h1>
            <p className="text-sm text-red-200/80 font-mono mt-1 font-medium">
              {greeting.sub}
            </p>
            <p className="text-xs text-zinc-400 mt-2 max-w-2xl leading-relaxed">
              Monitoring kesiapan alat medis di {totalRuanganCount} ruangan UPTD RSUD LAMADDUKELLENG, pelaksanaan Planned Preventive Maintenance (PPM), kalibrasi berkala, dan penarikan alkes afkir.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <button
              id="btn-quick-scan-qr"
              onClick={onOpenQrScanner}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-red-700 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-900/60 hover:from-red-500 hover:to-red-600 transition-all active:scale-95"
            >
              <QrCode className="h-4 w-4" />
              <span>Scan QR Alkes</span>
            </button>

            <button
              id="btn-quick-add-alkes"
              onClick={onOpenNewAlkesModal}
              className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/90 px-4 py-2.5 text-xs font-bold text-zinc-100 hover:border-zinc-500 hover:bg-zinc-700 transition-all active:scale-95"
            >
              <Layers className="h-4 w-4 text-red-400" />
              <span>+ Input Alkes</span>
            </button>

            {isAdminOrTeknisi && onOpenRuanganModal && (
              <button
                id="btn-quick-kelola-ruangan"
                onClick={onOpenRuanganModal}
                className="flex items-center gap-2 rounded-xl border border-amber-800/80 bg-amber-950/70 px-4 py-2.5 text-xs font-bold text-amber-300 hover:border-amber-600 hover:bg-amber-900/60 transition-all active:scale-95 shadow-md shadow-amber-950/30"
                title="Kelola Master Data Ruangan (Tambah, Edit, Hapus)"
              >
                <Building2 className="h-4 w-4 text-amber-400" />
                <span>Kelola Ruangan</span>
              </button>
            )}

            <button
              id="btn-quick-add-ppm"
              onClick={onOpenNewPpmModal}
              className="flex items-center gap-2 rounded-xl border border-red-800/60 bg-red-950/60 px-4 py-2.5 text-xs font-bold text-red-200 hover:border-red-600 hover:bg-red-900/50 transition-all active:scale-95"
            >
              <FileCheck2 className="h-4 w-4 text-emerald-400" />
              <span>+ Lembar PPM</span>
            </button>

            <button
              id="btn-quick-open-ai"
              onClick={() => handleNav('aiChat')}
              className="flex items-center gap-2 rounded-xl border border-red-500/60 bg-gradient-to-r from-red-800/80 to-rose-900/80 px-4 py-2.5 text-xs font-bold text-white hover:from-red-700 hover:to-rose-800 transition-all active:scale-95 shadow-md shadow-red-950/40"
            >
              <Sparkles className="h-4 w-4 text-yellow-300 animate-pulse" />
              <span>Tanya AI Elektromedis</span>
            </button>
          </div>
        </div>

        {/* Ambient Medical Glow Behind */}
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-red-600/15 blur-3xl" />
      </div>

      {/* Realtime EKG Waveform & Heartbeat Monitor */}
      <EkgMonitor bpm={75} />

      {/* KPI Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Total Alkes */}
        <div
          id="kpi-total-alkes"
          onClick={() => handleNav('inventaris')}
          className="cursor-pointer group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4 sm:p-5 shadow-lg hover:border-red-600/80 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Total Inventaris</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-950 text-red-400 border border-red-800/50">
              <Layers className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white">{totalAlkes}</span>
            <span className="text-xs text-zinc-400">Unit Alkes</span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500 font-medium">Tersebar di {totalRuanganCount} Ruangan RSUD</p>
        </div>

        {/* Metric 2: Siap Pakai (Kondisi Baik) */}
        <div
          id="kpi-siap-pakai"
          onClick={() => handleNav('inventaris')}
          className="cursor-pointer group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4 sm:p-5 shadow-lg hover:border-emerald-600/80 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Kondisi Baik (Siap)</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800/50">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-400">{baikAlkes}</span>
            <span className="text-xs text-emerald-500 font-bold">
              {totalAlkes ? Math.round((baikAlkes / totalAlkes) * 100) : 0}%
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500 font-medium">Kelaikan Operasional Optimal</p>
        </div>

        {/* Metric 3: Terkalibrasi */}
        <div
          id="kpi-terkalibrasi"
          onClick={() => handleNav('inventaris')}
          className="cursor-pointer group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4 sm:p-5 shadow-lg hover:border-cyan-600/80 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Terkalibrasi</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800/50">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-cyan-400">{terkalibrasi}</span>
            <span className="text-xs text-zinc-400">Unit Valid</span>
          </div>
          <p className="mt-1 text-[11px] text-amber-400/90 font-medium">
            {perluKalibrasi} Perlu Kalibrasi Ulang
          </p>
        </div>

        {/* Metric 4: Penarikan / Rusak Berat */}
        <div
          id="kpi-penarikan"
          onClick={() => handleNav('beritaAcara')}
          className="cursor-pointer group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4 sm:p-5 shadow-lg hover:border-red-600/80 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Penarikan / BAP</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-950 text-red-400 border border-red-800/50">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-red-500">{penarikanAlatCount}</span>
            <span className="text-xs text-red-400 font-bold">Afkir/Tarik</span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500 font-medium">{(beritaAcara || []).length} Berita Acara Dibuat</p>
        </div>
      </div>

      {/* Charts Section (Donut & Bar) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chart 1: Donut Chart Kondisi Alkes */}
        <div
          id="chart-donut-kondisi"
          className="lg:col-span-5 rounded-3xl border border-zinc-800 bg-zinc-900/90 p-5 sm:p-6 shadow-xl text-white"
        >
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
            <div>
              <h2 className="text-base font-black text-white">Distribusi Kondisi Alkes</h2>
              <p className="text-xs text-zinc-400">Proporsi kondisi fisik & fungsi alat medis</p>
            </div>
            <span className="rounded-lg bg-zinc-800 px-2 py-1 text-[10px] font-mono text-zinc-300">
              {totalAlkes} TOTAL
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={kondisiChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {kondisiChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke={isLight ? '#ffffff' : '#18181b'} strokeWidth={2} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: isLight ? '#ffffff' : '#18181b',
                    borderColor: isLight ? '#e2e8f0' : '#7f1d1d',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: isLight ? '#0f172a' : '#fff',
                    boxShadow: isLight ? '0 10px 15px -3px rgb(0 0 0 / 0.1)' : undefined,
                  }}
                  itemStyle={{ color: isLight ? '#0f172a' : '#fff' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Bar Chart Alkes per Ruangan */}
        <div
          id="chart-bar-ruangan"
          className="lg:col-span-7 rounded-3xl border border-zinc-800 bg-zinc-900/90 p-5 sm:p-6 shadow-xl text-white"
        >
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
            <div>
              <h2 className="text-base font-black text-white">Data Alkes per Ruangan Terbanyak</h2>
              <p className="text-xs text-zinc-400">Sebaran 10 unit/ruangan dengan peralatan medis tertinggi</p>
            </div>
            <div className="flex items-center gap-2">
              {isAdminOrTeknisi && onOpenRuanganModal && (
                <button
                  type="button"
                  onClick={onOpenRuanganModal}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-800/80 bg-amber-950/70 px-2.5 py-1 text-[11px] font-bold text-amber-300 hover:bg-amber-900 transition-colors shadow-xs"
                  title="Kelola Master Data Ruangan (Tambah, Edit, Hapus)"
                >
                  <Building2 className="h-3.5 w-3.5 text-amber-400" />
                  <span>Kelola Ruangan</span>
                </button>
              )}
              <button
                onClick={() => handleNav('inventaris')}
                className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
              >
                <span>Lihat {totalRuanganCount} Ruangan</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roomChartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isLight ? '#e2e8f0' : '#27272a'} />
                <XAxis
                  dataKey="ruangan"
                  stroke={isLight ? '#64748b' : '#71717a'}
                  fontSize={10}
                  angle={-25}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis stroke={isLight ? '#64748b' : '#71717a'} fontSize={11} allowDecimals={false} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: isLight ? '#ffffff' : '#18181b',
                    borderColor: isLight ? '#e2e8f0' : '#7f1d1d',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: isLight ? '#0f172a' : '#fff',
                    boxShadow: isLight ? '0 10px 15px -3px rgb(0 0 0 / 0.1)' : undefined,
                  }}
                  itemStyle={{ color: isLight ? '#0f172a' : '#fff' }}
                />
                <Bar dataKey="jumlah" name="Jumlah Alkes" fill="#dc2626" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FITUR LAPORAN BULANAN KINERJA ELEKTROMEDIS (IPSRS) - AKUN ADMIN & TEKNISI */}
      {/* ========================================================================= */}
      {isAdminOrTeknisi && (
        <div
          id="section-laporan-bulanan"
          className={`rounded-3xl border p-5 sm:p-7 shadow-2xl transition-all ${
            isLight
              ? 'border-red-200 bg-white text-slate-900 shadow-slate-200/60'
              : 'border-red-900/60 bg-gradient-to-br from-zinc-900 via-zinc-900 to-red-950/30 text-white shadow-red-950/20'
          }`}
        >
          {/* Header Panel & Filter Periode Bulan */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-inherit pb-5 mb-6">
            <div className="flex items-start sm:items-center gap-3">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm ${
                  isLight
                    ? 'bg-red-100 text-red-700 border border-red-200'
                    : 'bg-red-950 text-red-400 border border-red-800'
                }`}
              >
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className={`text-lg sm:text-xl font-black tracking-tight ${isLight ? 'text-black' : 'text-white'}`}>
                    Laporan Kinerja Bulanan IPSRS
                  </h2>
                  <span className="rounded-full bg-red-950/80 border border-red-700/60 px-2.5 py-0.5 text-[10px] font-black uppercase text-red-300">
                    Akses: Admin & Teknisi
                  </span>
                </div>
                <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-600 font-medium' : 'text-zinc-400'}`}>
                  Rangkuman penanganan perbaikan (Corrective) & riwayat pemeliharaan berkala (PPM) berdasarkan periode bulan
                </p>
              </div>
            </div>

            {/* Controls: Month Selector & Export Buttons */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Month & Year Selectors */}
              <div
                className={`flex items-center rounded-2xl border p-1 ${
                  isLight ? 'border-slate-300 bg-slate-50' : 'border-zinc-700 bg-zinc-950'
                }`}
              >
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className={`rounded-xl px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                    isLight ? 'hover:bg-slate-200 text-slate-700' : 'hover:bg-zinc-800 text-zinc-300'
                  }`}
                  title="Bulan Sebelumnya"
                >
                  ◀
                </button>

                <select
                  value={selMonth}
                  onChange={(e) => setSelectedMonth(`${selYear}-${e.target.value}`)}
                  className={`rounded-xl bg-transparent py-1.5 px-2 text-xs font-bold focus:outline-none cursor-pointer ${
                    isLight ? 'text-black' : 'text-white'
                  }`}
                >
                  {NAMA_BULAN.map((b) => (
                    <option key={b.value} value={b.value} className={isLight ? 'bg-white text-black' : 'bg-zinc-900 text-white'}>
                      {b.label}
                    </option>
                  ))}
                </select>

                <select
                  value={selYear}
                  onChange={(e) => setSelectedMonth(`${e.target.value}-${selMonth}`)}
                  className={`rounded-xl bg-transparent py-1.5 px-2 text-xs font-bold focus:outline-none cursor-pointer ${
                    isLight ? 'text-black' : 'text-white'
                  }`}
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y} className={isLight ? 'bg-white text-black' : 'bg-zinc-900 text-white'}>
                      {y}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  className={`rounded-xl px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                    isLight ? 'hover:bg-slate-200 text-slate-700' : 'hover:bg-zinc-800 text-zinc-300'
                  }`}
                  title="Bulan Berikutnya"
                >
                  ▶
                </button>
              </div>

              {/* Jump to Current Month */}
              <button
                type="button"
                onClick={handleJumpToCurrentMonth}
                className={`rounded-xl border px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
                  isCurrentMonthSelected
                    ? isLight
                      ? 'border-red-600 bg-red-50 text-red-700 font-black'
                      : 'border-red-600 bg-red-950/80 text-red-300 font-black ring-1 ring-red-500'
                    : isLight
                    ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
                title="Bulan Berjalan Saat Ini"
              >
                Bulan Ini
              </button>

              {/* Print PDF */}
              <button
                type="button"
                id="btn-print-laporan-bulanan"
                onClick={handlePrintMonthlyPdf}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-red-950/60 hover:from-red-500 hover:to-red-600 transition-all cursor-pointer active:scale-95"
                title="Cetak Laporan Kinerja Bulanan PDF"
              >
                <Printer className="h-4 w-4" />
                <span>Cetak PDF</span>
              </button>

              {/* Export CSV */}
              <button
                type="button"
                id="btn-export-csv-bulanan"
                onClick={handleExportMonthlyCsv}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                  isLight
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    : 'border-emerald-800 bg-emerald-950/70 text-emerald-300 hover:bg-emerald-900/60'
                }`}
                title="Download CSV format Excel / Spreadsheet"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
            </div>
          </div>

          {/* KPI Summary Cards Grid for Selected Month */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            {/* Card 1: Total Perbaikan */}
            <div
              className={`rounded-2xl border p-4 sm:p-5 transition-all shadow-sm ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-zinc-950/70 border-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                  Total Perbaikan (SPK)
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-950/80 text-orange-400 border border-orange-800/60">
                  <Wrench className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2.5 flex items-baseline gap-2">
                <span className={`text-2xl sm:text-3xl font-black ${isLight ? 'text-black' : 'text-white'}`}>
                  {totalPerbaikanBulan}
                </span>
                <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>Laporan</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] flex-wrap">
                <span className="inline-flex items-center gap-1 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 px-1.5 py-0.2 font-bold">
                  ✓ {perbaikanSelesaiBulan} Selesai ({rasioSelesaiBulan}%)
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-amber-950/60 text-amber-300 border border-amber-800/40 px-1.5 py-0.2 font-bold">
                  ⏳ {perbaikanProsesBulan} Proses
                </span>
              </div>
            </div>

            {/* Card 2: Total Pemeliharaan (PPM) */}
            <div
              className={`rounded-2xl border p-4 sm:p-5 transition-all shadow-sm ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-zinc-950/70 border-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                  Riwayat Pemeliharaan (PPM)
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                  <FileCheck2 className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2.5 flex items-baseline gap-2">
                <span className={`text-2xl sm:text-3xl font-black ${isLight ? 'text-black' : 'text-white'}`}>
                  {totalPpmBulan}
                </span>
                <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>Kegiatan</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] flex-wrap">
                <span className="inline-flex items-center gap-1 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 px-1.5 py-0.2 font-bold">
                  ✓ {ppmLayakBulan} Layak Pakai ({rasioLayakPpm}%)
                </span>
                {ppmPerluPerbaikanBulan > 0 && (
                  <span className="inline-flex items-center gap-1 rounded bg-red-950/60 text-red-300 border border-red-800/40 px-1.5 py-0.2 font-bold">
                    ⚠️ {ppmPerluPerbaikanBulan} Perlu Servis
                  </span>
                )}
              </div>
            </div>

            {/* Card 3: Total Estimasi Biaya */}
            <div
              className={`rounded-2xl border p-4 sm:p-5 transition-all shadow-sm ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-zinc-950/70 border-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                  Estimasi Biaya Perbaikan
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-950/80 text-red-400 border border-red-800/60 font-black text-xs font-mono">
                  Rp
                </div>
              </div>
              <div className="mt-2.5">
                <span className={`text-xl sm:text-2xl font-black font-mono ${isLight ? 'text-black' : 'text-white'}`}>
                  Rp {totalBiayaBulan.toLocaleString('id-ID')}
                </span>
              </div>
              <p className={`mt-2 text-[11px] ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                {totalPerbaikanBulan > 0
                  ? `Rata-rata: Rp ${Math.round(totalBiayaBulan / totalPerbaikanBulan).toLocaleString('id-ID')} / unit`
                  : 'Belum ada pengeluaran biaya'}
              </p>
            </div>

            {/* Card 4: Total Beban Aktivitas */}
            <div
              className={`rounded-2xl border p-4 sm:p-5 transition-all shadow-sm ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-zinc-950/70 border-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                  Total Aktivitas Bulanan
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-950/80 text-blue-400 border border-blue-800/60">
                  <Activity className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2.5 flex items-baseline gap-2">
                <span className={`text-2xl sm:text-3xl font-black ${isLight ? 'text-black' : 'text-white'}`}>
                  {totalAktivitas}
                </span>
                <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>Tindakan</span>
              </div>
              <p className={`mt-2 text-[11px] ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Periode: <strong className={isLight ? 'text-black' : 'text-white'}>{namaBulanLabel}</strong>
              </p>
            </div>
          </div>

          {/* Sub-tabs Navigation & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-inherit pb-4 mb-4">
            <div className="flex items-center gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveReportTab('perbaikan')}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
                  activeReportTab === 'perbaikan'
                    ? isLight
                      ? 'bg-red-700 text-white shadow-md'
                      : 'bg-red-700 text-white shadow-md shadow-red-950/50'
                    : isLight
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                <Wrench className="h-3.5 w-3.5" />
                <span>Rangkuman Perbaikan ({totalPerbaikanBulan})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveReportTab('pemeliharaan')}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
                  activeReportTab === 'pemeliharaan'
                    ? isLight
                      ? 'bg-red-700 text-white shadow-md'
                      : 'bg-red-700 text-white shadow-md shadow-red-950/50'
                    : isLight
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                <FileCheck2 className="h-3.5 w-3.5" />
                <span>Riwayat Pemeliharaan PPM ({totalPpmBulan})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveReportTab('ruangan')}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
                  activeReportTab === 'ruangan'
                    ? isLight
                      ? 'bg-red-700 text-white shadow-md'
                      : 'bg-red-700 text-white shadow-md shadow-red-950/50'
                    : isLight
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>Distribusi Ruangan ({roomActivityMap.length})</span>
              </button>
            </div>

            {/* Quick Search inside this month's report */}
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Cari alat, SPK, ruangan..."
                value={reportSearchQuery}
                onChange={(e) => setReportSearchQuery(e.target.value)}
                className={`w-full rounded-xl border py-1.5 pl-8 pr-3 text-xs focus:outline-none ${
                  isLight
                    ? 'border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:border-red-500'
                    : 'border-zinc-700 bg-zinc-950 text-white placeholder-zinc-500 focus:border-red-500'
                }`}
              />
            </div>
          </div>

          {/* Subtab Content 1: Rangkuman Perbaikan (SPK) */}
          {activeReportTab === 'perbaikan' && (
            <div>
              {filteredPerbaikanBulan.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
                      isLight ? 'bg-slate-100 border-slate-300 text-slate-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                    }`}
                  >
                    <Wrench className="h-6 w-6 opacity-60" />
                  </div>
                  <p className={`text-sm font-bold ${isLight ? 'text-black' : 'text-zinc-200'}`}>
                    Tidak ada laporan perbaikan pada periode {namaBulanLabel}
                  </p>
                  <p className={`text-xs max-w-md ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
                    Gunakan pemilih bulan di atas untuk melihat periode lain atau buat formulir SPK perbaikan baru di menu Perbaikan.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleNav('perbaikan')}
                    className="mt-2 rounded-xl bg-red-700 hover:bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
                  >
                    Buka Menu Perbaikan
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-inherit">
                  <table className={`w-full text-left text-xs ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>
                    <thead
                      className={`border-b text-[10px] font-black uppercase tracking-wider ${
                        isLight
                          ? 'border-slate-200 bg-slate-100 text-slate-800'
                          : 'border-zinc-800 bg-zinc-950 text-red-300'
                      }`}
                    >
                      <tr>
                        <th className="py-3 pl-3 pr-2">No</th>
                        <th className="px-2.5 py-3">Tanggal & SPK</th>
                        <th className="px-2.5 py-3">Nama Alat & Ruangan</th>
                        <th className="px-2.5 py-3">Pelapor</th>
                        <th className="px-2.5 py-3">Keluhan & Penanganan</th>
                        <th className="px-2.5 py-3 text-right">Biaya (Rp)</th>
                        <th className="px-2.5 py-3 text-center">Status</th>
                        <th className="px-2.5 py-3">Teknisi</th>
                        <th className="py-3 pl-2 pr-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-inherit">
                      {filteredPerbaikanBulan.map((item, idx) => (
                        <tr
                          key={item.id}
                          className={`transition-colors ${
                            isLight ? 'hover:bg-slate-100/70' : 'hover:bg-zinc-800/50'
                          }`}
                        >
                          <td className="py-2.5 pl-3 pr-2 font-mono text-[11px] text-zinc-500">{idx + 1}</td>
                          <td className="px-2.5 py-2.5 font-mono text-[11px]">
                            <p className="font-bold">{item.tanggal}</p>
                            <span className="text-[10px] text-red-600 dark:text-red-400 font-bold">{item.nomorSpk}</span>
                          </td>
                          <td className="px-2.5 py-2.5">
                            <p className={`font-bold text-xs ${isLight ? 'text-black' : 'text-white'}`}>{item.namaAlat}</p>
                            <p className="text-[11px] text-zinc-400">
                              <span className="font-semibold">{item.ruangan}</span> • {item.merk} {item.modelType}
                            </p>
                          </td>
                          <td className="px-2.5 py-2.5 text-[11px]">{item.pelapor}</td>
                          <td className="px-2.5 py-2.5 max-w-xs text-[11px]">
                            <p className="line-clamp-1 italic text-zinc-400">&ldquo;{item.keluhanKerusakan}&rdquo;</p>
                            {item.tindakanPerbaikan && (
                              <p className="line-clamp-1 font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                                Tindakan: {item.tindakanPerbaikan}
                              </p>
                            )}
                          </td>
                          <td className="px-2.5 py-2.5 text-right font-mono font-bold text-xs">
                            {item.biayaEstimasi ? `Rp ${item.biayaEstimasi.toLocaleString('id-ID')}` : '-'}
                          </td>
                          <td className="px-2.5 py-2.5 text-center">
                            <span
                              className={`inline-block rounded-lg px-2 py-0.5 text-[10px] font-black uppercase ${
                                item.statusPerbaikan === 'Selesai (Alat Normal)'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : item.statusPerbaikan === 'Dalam Proses'
                                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                  : item.statusPerbaikan === 'Menunggu Sparepart'
                                  ? 'bg-blue-950 text-blue-300 border border-blue-800'
                                  : 'bg-red-950 text-red-300 border border-red-800'
                              }`}
                            >
                              {item.statusPerbaikan}
                            </span>
                          </td>
                          <td className="px-2.5 py-2.5 text-[11px] font-medium">{item.teknisiPelaksana}</td>
                          <td className="py-2.5 pl-2 pr-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {onOpenPerbaikanThread && (
                                <button
                                  type="button"
                                  onClick={() => onOpenPerbaikanThread(item)}
                                  className={`rounded-lg border px-2 py-1 text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                    isLight
                                      ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                                      : 'border-red-800 bg-red-950/70 text-red-300 hover:bg-red-900'
                                  }`}
                                  title="Buka Thread Komentar"
                                >
                                  <MessageSquare className="h-3 w-3" />
                                  <span>{item.comments?.length || 0}</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleNav('perbaikan')}
                                className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-[10px] font-bold text-zinc-300 hover:text-white cursor-pointer"
                                title="Lihat di Menu Perbaikan"
                              >
                                Detail
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Subtab Content 2: Riwayat Pemeliharaan (PPM) */}
          {activeReportTab === 'pemeliharaan' && (
            <div>
              {filteredPpmBulan.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
                      isLight ? 'bg-slate-100 border-slate-300 text-slate-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                    }`}
                  >
                    <FileCheck2 className="h-6 w-6 opacity-60" />
                  </div>
                  <p className={`text-sm font-bold ${isLight ? 'text-black' : 'text-zinc-200'}`}>
                    Tidak ada riwayat pemeliharaan pada periode {namaBulanLabel}
                  </p>
                  <p className={`text-xs max-w-md ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
                    Jadwal Planned Preventive Maintenance (PPM) pada bulan ini belum diinput atau pilih periode bulan lain.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleNav('pemeliharaan')}
                    className="mt-2 rounded-xl bg-red-700 hover:bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
                  >
                    Buka Menu Pemeliharaan
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-inherit">
                  <table className={`w-full text-left text-xs ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>
                    <thead
                      className={`border-b text-[10px] font-black uppercase tracking-wider ${
                        isLight
                          ? 'border-slate-200 bg-slate-100 text-slate-800'
                          : 'border-zinc-800 bg-zinc-950 text-red-300'
                      }`}
                    >
                      <tr>
                        <th className="py-3 pl-3 pr-2">No</th>
                        <th className="px-2.5 py-3">Tanggal</th>
                        <th className="px-2.5 py-3">Nama Alat & Ruangan</th>
                        <th className="px-2.5 py-3">Teknisi</th>
                        <th className="px-2.5 py-3 text-center">Fisik</th>
                        <th className="px-2.5 py-3 text-center">Setting</th>
                        <th className="px-2.5 py-3 text-center">Cleaning</th>
                        <th className="px-2.5 py-3">Kondisi</th>
                        <th className="px-2.5 py-3 text-center">Status Kelayakan</th>
                        <th className="py-3 pl-2 pr-3">Catatan / Rekomendasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-inherit">
                      {filteredPpmBulan.map((item, idx) => (
                        <tr
                          key={item.id}
                          className={`transition-colors ${
                            isLight ? 'hover:bg-slate-100/70' : 'hover:bg-zinc-800/50'
                          }`}
                        >
                          <td className="py-2.5 pl-3 pr-2 font-mono text-[11px] text-zinc-500">{idx + 1}</td>
                          <td className="px-2.5 py-2.5 font-mono text-[11px] font-bold">{item.tanggal}</td>
                          <td className="px-2.5 py-2.5">
                            <p className={`font-bold text-xs ${isLight ? 'text-black' : 'text-white'}`}>{item.namaAlat}</p>
                            <p className="text-[11px] text-zinc-400">
                              <span className="font-semibold">{item.ruangan}</span> • {item.merk} {item.modelType}
                            </p>
                          </td>
                          <td className="px-2.5 py-2.5 text-[11px] font-medium">{item.namaTeknisi}</td>
                          <td className="px-2.5 py-2.5 text-center font-bold">
                            {item.kegiatanFisik ? <span className="text-emerald-500">✓</span> : <span className="text-zinc-500">✗</span>}
                          </td>
                          <td className="px-2.5 py-2.5 text-center font-bold">
                            {item.kegiatanSetting ? <span className="text-emerald-500">✓</span> : <span className="text-zinc-500">✗</span>}
                          </td>
                          <td className="px-2.5 py-2.5 text-center font-bold">
                            {item.kegiatanCleaning ? <span className="text-emerald-500">✓</span> : <span className="text-zinc-500">✗</span>}
                          </td>
                          <td className="px-2.5 py-2.5 text-[11px]">
                            <span
                              className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${
                                item.kondisi === 'Baik'
                                  ? 'bg-emerald-950 text-emerald-300'
                                  : item.kondisi === 'Rusak Ringan'
                                  ? 'bg-yellow-950 text-yellow-300'
                                  : 'bg-red-950 text-red-300'
                              }`}
                            >
                              {item.kondisi}
                            </span>
                          </td>
                          <td className="px-2.5 py-2.5 text-center">
                            <span
                              className={`inline-block rounded-lg px-2.5 py-0.5 text-[10px] font-black uppercase ${
                                item.status === 'layak pakai'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : 'bg-red-950 text-red-300 border border-red-800'
                              }`}
                            >
                              {item.status === 'layak pakai' ? 'Layak Pakai' : 'Perlu Perbaikan'}
                            </span>
                          </td>
                          <td className="py-2.5 pl-2 pr-3 text-[11px] max-w-xs text-zinc-400">
                            {item.catatan || item.rekomendasi || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Subtab Content 3: Distribusi Aktivitas per Ruangan */}
          {activeReportTab === 'ruangan' && (
            <div>
              {roomActivityMap.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
                  <Building2 className="h-10 w-10 text-zinc-500 opacity-60" />
                  <p className={`text-sm font-bold ${isLight ? 'text-black' : 'text-zinc-200'}`}>
                    Belum ada data aktivitas ruangan pada periode {namaBulanLabel}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-inherit">
                  <table className={`w-full text-left text-xs ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>
                    <thead
                      className={`border-b text-[10px] font-black uppercase tracking-wider ${
                        isLight
                          ? 'border-slate-200 bg-slate-100 text-slate-800'
                          : 'border-zinc-800 bg-zinc-950 text-red-300'
                      }`}
                    >
                      <tr>
                        <th className="py-3 pl-3 pr-2">No</th>
                        <th className="px-3 py-3">Nama Ruangan / Unit Pelayanan</th>
                        <th className="px-3 py-3 text-center">Perbaikan (SPK)</th>
                        <th className="px-3 py-3 text-center">Pemeliharaan (PPM)</th>
                        <th className="px-3 py-3 text-center font-black">Total Aktivitas</th>
                        <th className="py-3 pl-3 pr-4 text-right">Total Biaya Perbaikan (Rp)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-inherit">
                      {roomActivityMap.map((r, idx) => (
                        <tr
                          key={r.ruangan}
                          className={`transition-colors ${
                            isLight ? 'hover:bg-slate-100/70' : 'hover:bg-zinc-800/50'
                          }`}
                        >
                          <td className="py-2.5 pl-3 pr-2 font-mono text-[11px] text-zinc-500">{idx + 1}</td>
                          <td className="px-3 py-2.5 font-bold text-xs">
                            <span className="rounded bg-zinc-800 text-zinc-200 px-2 py-0.5 border border-zinc-700 mr-2">
                              {r.ruangan}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold text-orange-400">{r.perbaikan}</td>
                          <td className="px-3 py-2.5 text-center font-bold text-emerald-400">{r.ppm}</td>
                          <td className="px-3 py-2.5 text-center font-black text-xs">
                            <span className="rounded-full bg-red-950 text-red-300 px-2.5 py-0.5 border border-red-800">
                              {r.total} Kegiatan
                            </span>
                          </td>
                          <td className="py-2.5 pl-3 pr-4 text-right font-mono font-bold text-xs">
                            {r.biaya > 0 ? `Rp ${r.biaya.toLocaleString('id-ID')}` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Urgent Warning Panel: Alkes needing Immediate Attention */}
      <div
        id="panel-urgent-alerts"
        className={`rounded-3xl border p-5 sm:p-6 shadow-xl transition-all ${
          isLight
            ? 'border-red-200 bg-gradient-to-br from-white via-white to-red-50 text-slate-800 shadow-slate-200/50'
            : 'border-red-900/60 bg-gradient-to-br from-zinc-900 via-zinc-900 to-red-950/40 text-white'
        }`}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-950 text-red-400 border border-red-800">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Alat Medis Butuh Perhatian Segera</h2>
              <p className="text-xs text-zinc-400">Kalibrasi kadaluarsa, rusak berat, atau rekomendasi penarikan alat</p>
            </div>
          </div>
          <span className="rounded-full bg-red-950 border border-red-800 px-2.5 py-0.5 text-xs font-bold text-red-300">
            {urgentList.length} Unit
          </span>
        </div>

        {urgentList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mb-2" />
            <p className="text-sm font-bold text-zinc-200">Semua Peralatan Kesehatan Berfungsi Optimal</p>
            <p className="text-xs text-zinc-500">Tidak ada alkes yang membutuhkan penarikan mendesak.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {urgentList.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-red-900/40 bg-zinc-950/70 p-3.5 hover:border-red-700 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-red-950 px-2 py-0.5 text-[10px] font-bold text-red-300 border border-red-800/40">
                      {item.ruangan}
                    </span>
                    <span className="text-xs font-mono text-zinc-400 font-bold">{item.serialNumber}</span>
                  </div>
                  <h4 className="text-sm font-bold text-white mt-1 truncate">{item.namaAlat}</h4>
                  <p className="text-xs text-zinc-400">
                    {item.merk} {item.modelType} • Kondisi: <span className="text-red-400 font-bold">{item.kondisi}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.keterangan === 'Penarikan Alat' ? (
                    <button
                      onClick={() => handleBapTrigger(item)}
                      className="rounded-xl bg-red-700 hover:bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow transition-all"
                    >
                      Buat BAP Penarikan
                    </button>
                  ) : (
                    <button
                      onClick={() => handleNav('inventaris')}
                      className="rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs font-bold text-zinc-200 transition-all"
                    >
                      Detail Alat
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Real-Time Comment Thread & Communication Hub */}
      <div
        id="dashboard-comment-threads"
        className={`rounded-3xl p-5 sm:p-6 shadow-xl border transition-colors ${
          isLight
            ? 'bg-white border-2 border-slate-300 text-black'
            : 'bg-zinc-900/90 border border-zinc-800 text-white'
        }`}
      >
        <div className="flex items-center justify-between pb-4 border-b border-inherit mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-2xl shadow-sm ${
                isLight
                  ? 'bg-red-100 text-red-700 border border-red-200'
                  : 'bg-red-950 text-red-400 border border-red-800'
              }`}
            >
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h2 className={`text-base font-black ${isLight ? 'text-black' : 'text-white'}`}>
                Thread Komentar & Komunikasi Perbaikan Alat
              </h2>
              <p className={`text-xs ${isLight ? 'text-slate-600 font-medium' : 'text-zinc-400'}`}>
                Saluran komunikasi langsung antara Teknisi Elektromedis & Petugas Ruangan Pelapor
              </p>
            </div>
          </div>
          <button
            onClick={() => handleNav('perbaikan')}
            className={`flex items-center gap-1 text-xs font-bold transition-colors cursor-pointer ${
              isLight ? 'text-red-700 hover:text-red-900 underline' : 'text-red-400 hover:text-red-300'
            }`}
          >
            <span>Semua Diskusi ({reportsWithComments.length})</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {reportsWithComments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
                isLight ? 'bg-slate-100 border-slate-300 text-slate-500' : 'bg-zinc-800 border-zinc-700 text-zinc-400'
              }`}
            >
              <MessageSquare className="h-6 w-6 opacity-60" />
            </div>
            <p className={`text-sm font-bold ${isLight ? 'text-black' : 'text-zinc-200'}`}>
              Belum Ada Percakapan Thread Aktif
            </p>
            <p className={`text-xs max-w-md ${isLight ? 'text-slate-600' : 'text-zinc-500'}`}>
              Buka menu <strong>Perbaikan</strong> lalu klik tombol <strong>&ldquo;Thread Komentar&rdquo;</strong> pada laporan untuk memulai diskusi penanganan alat kesehatan.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {reportsWithComments.slice(0, 4).map((item) => {
              const lastComment = item.comments?.[item.comments.length - 1];
              const isTeknisi = lastComment?.senderRole === 'teknisi' || lastComment?.senderRole === 'admin';

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (onOpenPerbaikanThread) {
                      onOpenPerbaikanThread(item);
                    } else {
                      handleNav('perbaikan');
                    }
                  }}
                  className={`group rounded-2xl p-4 border transition-all cursor-pointer shadow-xs ${
                    isLight
                      ? 'bg-slate-50 hover:bg-white border-slate-300 hover:border-red-400 hover:shadow-md'
                      : 'bg-zinc-950/60 hover:bg-zinc-800/60 border-zinc-800 hover:border-red-700/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-mono font-black border ${
                          isLight
                            ? 'bg-white border-slate-300 text-red-900'
                            : 'bg-red-950/80 border-red-800/60 text-red-200'
                        }`}
                      >
                        {item.nomorSpk}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold border ${
                          isLight ? 'bg-slate-200 text-black border-slate-300' : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                        }`}
                      >
                        {item.ruangan}
                      </span>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-bold ${
                        isLight ? 'bg-red-100 text-red-900' : 'bg-red-950 text-red-300'
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {item.comments?.length || 0} Pesan
                    </span>
                  </div>

                  <h3
                    className={`text-sm font-extrabold truncate group-hover:text-red-600 transition-colors ${
                      isLight ? 'text-black' : 'text-white'
                    }`}
                  >
                    {item.namaAlat}
                  </h3>

                  {lastComment && (
                    <div
                      className={`mt-2.5 p-2.5 rounded-xl border text-xs ${
                        isLight
                          ? 'bg-white border-slate-200 text-black shadow-2xs'
                          : 'bg-zinc-900/90 border-zinc-800/80 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className={`font-black ${isLight ? 'text-black' : 'text-zinc-200'}`}>
                          {lastComment.senderName}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.2 text-[9px] font-bold ${
                            isLight
                              ? isTeknisi
                                ? 'bg-red-100 text-red-900'
                                : 'bg-blue-100 text-blue-900'
                              : isTeknisi
                              ? 'bg-red-950 text-red-300'
                              : 'bg-blue-950 text-blue-300'
                          }`}
                        >
                          {isTeknisi ? 'Teknisi' : 'Pelapor'}
                        </span>
                      </div>
                      <p className={`line-clamp-2 text-[11px] leading-relaxed ${isLight ? 'text-black font-medium' : 'text-zinc-300'}`}>
                        &ldquo;{lastComment.message}&rdquo;
                      </p>
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between text-[11px] pt-1">
                    <span className={`font-semibold ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                      Status: <strong className={isLight ? 'text-black' : 'text-zinc-200'}>{item.statusPerbaikan}</strong>
                    </span>
                    <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-bold group-hover:underline">
                      <span>Buka Diskusi</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
