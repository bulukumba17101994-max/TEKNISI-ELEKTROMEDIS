import React, { useState, useEffect, useRef } from 'react';
import {
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Copy,
  ExternalLink,
  Save,
  Send,
  Download,
  Mail,
  Layers,
  FileCheck2,
  Wrench,
  FileText,
  X,
  Code2,
  HelpCircle,
  Database,
  ArrowRight,
  DownloadCloud,
  UploadCloud,
  ShieldCheck,
  Zap,
  Upload,
  Link as LinkIcon,
  PlusCircle,
  Check,
  Eye,
  Trash2,
} from 'lucide-react';
import { AlkesItem, BeritaAcaraPenarikan, PemeliharaanItem, PerbaikanItem, Teknisi } from '../types';
import {
  exportToCsv,
  getSystemConfig,
  GOOGLE_APPS_SCRIPT_SAMPLE,
  pullFromGoogleSheets,
  saveSystemConfig,
  syncToGoogleSheets,
  testGoogleSheetsConnection,
  importFromGoogleSheetUrl,
  parseCsvStringToAlkes,
  parseExcelBufferToAlkes,
  pushBatchAlkesToBackend,
  normalizeDateString,
  purgeDemoDataFromServerAndSheets,
} from '../utils/syncEngine';

interface GoogleSheetSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventaris: AlkesItem[];
  pemeliharaan: PemeliharaanItem[];
  perbaikan: PerbaikanItem[];
  beritaAcara: BeritaAcaraPenarikan[];
  currentTeknisi: Teknisi;
  onShowNotification?: (type: 'info' | 'warning' | 'sync', title: string, message: string) => void;
  onDataSynced?: (data: {
    inventaris?: AlkesItem[];
    pemeliharaan?: PemeliharaanItem[];
    perbaikan?: PerbaikanItem[];
    beritaAcara?: BeritaAcaraPenarikan[];
  }) => void;
}

export const GoogleSheetSyncModal: React.FC<GoogleSheetSyncModalProps> = ({
  isOpen,
  onClose,
  inventaris = [],
  pemeliharaan = [],
  perbaikan = [],
  beritaAcara = [],
  currentTeknisi,
  onShowNotification,
  onDataSynced,
}) => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [designatedEmail, setDesignatedEmail] = useState('bulukumba17101994@gmail.com');
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);
  const [activeTab, setActiveTab] = useState<'sync' | 'import' | 'script' | 'csv' | 'email'>('sync');

  // Direct Google Spreadsheet URL Import state
  const [directSheetUrl, setDirectSheetUrl] = useState('');
  const [isImportingUrl, setIsImportingUrl] = useState(false);
  const [importedPreview, setImportedPreview] = useState<AlkesItem[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing config on open
  useEffect(() => {
    if (isOpen) {
      getSystemConfig().then((cfg) => {
        if (cfg) {
          setWebhookUrl(cfg.googleSheetsWebhookUrl || '');
          setDesignatedEmail(cfg.designatedEmail || 'bulukumba17101994@gmail.com');
          setAutoSyncEnabled(cfg.autoSyncEnabled ?? true);
        }
      });
    }
  }, [isOpen]);

  const handleSaveConfig = async () => {
    await saveSystemConfig({
      googleSheetsWebhookUrl: webhookUrl.trim(),
      designatedEmail: designatedEmail.trim(),
      autoSyncEnabled,
    });
    if (onShowNotification) {
      onShowNotification(
        'info',
        'Konfigurasi Disimpan',
        'Pengaturan Google Spreadsheet & Email Laporan berhasil diperbarui.'
      );
    }
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl.trim()) {
      setTestResult({ success: false, message: 'Harap masukkan URL Google Apps Script Webhook terlebih dahulu.' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testGoogleSheetsConnection(webhookUrl.trim());
      if (res && res.success) {
        setTestResult({ success: true, message: res.message || 'Koneksi ke Google Apps Script Berhasil Aktif!' });
      } else {
        setTestResult({ success: false, message: res?.error || 'Gagal terhubung. Pastikan izin deployment diatur "Anyone".' });
      }
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || 'Koneksi gagal terhubung.' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    setSyncStatus('idle');
    setStatusMessage('');

    try {
      const res = await syncToGoogleSheets({
        webhookUrl: webhookUrl.trim(),
        inventaris,
        pemeliharaan,
        perbaikan,
        beritaAcara,
      });

      if (res && res.success) {
        setSyncStatus('success');
        const hasWebhook = res.webhook?.attempted;
        const webhookOk = res.webhook?.ok;
        setStatusMessage(
          hasWebhook
            ? webhookOk
              ? `Berhasil disinkronisasi ke Google Spreadsheet Webhook (${res.counts.inventaris} alkes, ${res.counts.pemeliharaan} PPM, ${res.counts.perbaikan} SPK, ${res.counts.beritaAcara} BAP)`
              : `Data disimpan di server. Webhook merespons: ${res.webhook?.error || 'Periksa izin Web App'}`
            : `Seluruh data (${res.counts.inventaris} alkes, ${res.counts.pemeliharaan} PPM, ${res.counts.perbaikan} SPK, ${res.counts.beritaAcara} BAP) siap disinkronkan.`
        );
        if (onShowNotification) {
          onShowNotification(
            'sync',
            'Sinkronisasi Google Sheet Berhasil',
            `Format header & ${inventaris.length} baris alkes telah diperbarui.`
          );
        }
      } else {
        setSyncStatus('error');
        setStatusMessage('Gagal menghubungi server sinkronisasi. Periksa koneksi Anda.');
      }
    } catch (e: any) {
      setSyncStatus('error');
      setStatusMessage(e.message || 'Terjadi kesalahan saat sinkronisasi');
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullData = async () => {
    setIsPulling(true);
    setSyncStatus('idle');
    setStatusMessage('');

    try {
      const res = await pullFromGoogleSheets(webhookUrl.trim());
      if (res && res.success && res.data) {
        setSyncStatus('success');
        setStatusMessage(
          `Berhasil menarik data terbaru dari Google Spreadsheet (${res.counts.inventaris} alkes, ${res.counts.pemeliharaan} PPM, ${res.counts.perbaikan} SPK, ${res.counts.beritaAcara} BAP).`
        );
        if (onDataSynced) {
          const sanitizedData = {
            ...res.data,
            inventaris: (res.data.inventaris || []).map((i: AlkesItem) => ({
              ...i,
              kalibrasiTerakhir: normalizeDateString(i.kalibrasiTerakhir),
              kalibrasiBerikutnya: normalizeDateString(i.kalibrasiBerikutnya),
            })),
          };
          onDataSynced(sanitizedData);
        }
        if (onShowNotification) {
          onShowNotification(
            'sync',
            'Tarik Data Berhasil',
            `Data terbaru dari Google Sheet telah dimuat (${res.counts.inventaris} alkes).`
          );
        }
      } else {
        setSyncStatus('error');
        setStatusMessage(res?.error || 'Gagal menarik data dari Google Spreadsheet. Periksa URL Web App atau izin link.');
      }
    } catch (e: any) {
      setSyncStatus('error');
      setStatusMessage(e.message || 'Terjadi kesalahan saat menarik data');
    } finally {
      setIsPulling(false);
    }
  };

  const [isPurgingDemo, setIsPurgingDemo] = useState(false);

  const handlePurgeDemo = async () => {
    if (!window.confirm('Yakin ingin menghapus seluruh data demo bawaan dari aplikasi dan Google Spreadsheet? Data riil alkes yang Anda input tidak akan terpengaruh.')) {
      return;
    }
    setIsPurgingDemo(true);
    setStatusMessage('');
    try {
      const res = await purgeDemoDataFromServerAndSheets();
      if (res && res.success) {
        if (onDataSynced) {
          onDataSynced({
            inventaris: [],
            pemeliharaan: [],
            perbaikan: [],
            beritaAcara: [],
          });
        }
        setSyncStatus('success');
        setStatusMessage('Seluruh data demo bawaan berhasil dihapus permanen dari aplikasi dan Google Spreadsheet!');
        if (onShowNotification) {
          onShowNotification(
            'sync',
            'Data Demo Berhasil Dihapus',
            'Semua data demo telah dibersihkan secara permanen dari aplikasi dan spreadsheet.'
          );
        }
      } else {
        setSyncStatus('error');
        setStatusMessage(res?.error || 'Gagal menghapus data demo.');
      }
    } catch (e: any) {
      setSyncStatus('error');
      setStatusMessage('Gagal: ' + (e.message || String(e)));
    } finally {
      setIsPurgingDemo(false);
    }
  };

  // Handler: Import directly from Google Spreadsheet Link
  const handleImportDirectUrl = async () => {
    if (!directSheetUrl.trim()) {
      alert('Silakan masukkan link Google Spreadsheet (misal: https://docs.google.com/spreadsheets/d/.../edit).');
      return;
    }

    setIsImportingUrl(true);
    try {
      const res = await importFromGoogleSheetUrl(directSheetUrl.trim());
      if (res && res.success && res.data) {
        if (onDataSynced) {
          const sanitizedData = {
            ...res.data,
            inventaris: (res.data.inventaris || []).map((i: AlkesItem) => ({
              ...i,
              kalibrasiTerakhir: normalizeDateString(i.kalibrasiTerakhir),
              kalibrasiBerikutnya: normalizeDateString(i.kalibrasiBerikutnya),
            })),
          };
          onDataSynced(sanitizedData);
        }
        if (onShowNotification) {
          onShowNotification(
            'sync',
            'Impor Google Spreadsheet Berhasil',
            `${res.importedCount || res.counts?.inventaris || 0} data inventaris alat kesehatan berhasil diimpor ke aplikasi!`
          );
        }
        alert(`Berhasil! Sebanyak ${res.importedCount || res.counts?.inventaris || 0} data alkes dari Google Spreadsheet berhasil dimasukkan ke sistem.`);
        setDirectSheetUrl('');
      } else {
        alert(res?.error || 'Gagal mengimpor dari link Google Spreadsheet. Pastikan akses sharing diatur "Anyone with link".');
      }
    } catch (e: any) {
      alert('Gagal mengimpor: ' + (e.message || String(e)));
    } finally {
      setIsImportingUrl(false);
    }
  };

  // Handler: Upload Excel / CSV file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const reader = new FileReader();

    if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        if (text) {
          const parsed = parseCsvStringToAlkes(text);
          if (parsed.length === 0) {
            alert('File CSV tidak memiliki data alkes yang valid atau kolom tidak terdeteksi.');
          } else {
            setImportedPreview(parsed);
          }
        }
      };
      reader.readAsText(file);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      reader.onload = (evt) => {
        const buffer = evt.target?.result as ArrayBuffer;
        if (buffer) {
          const parsed = parseExcelBufferToAlkes(buffer);
          if (parsed.length === 0) {
            alert('File Excel tidak memiliki data alkes yang valid atau kolom tidak terdeteksi.');
          } else {
            setImportedPreview(parsed);
          }
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert('Format file tidak didukung. Harap unggah file .xlsx, .xls, atau .csv.');
    }
  };

  // Handler: Confirm Save Imported Preview to Inventaris
  const handleConfirmImportPreview = async () => {
    if (!importedPreview || importedPreview.length === 0) return;

    // Merge preview with existing inventaris
    const map = new Map<string, AlkesItem>();
    inventaris.forEach((i) => map.set(i.id, i));
    importedPreview.forEach((item) => {
      map.set(item.id, item);
    });

    const merged = Array.from(map.values());

    if (onDataSynced) {
      onDataSynced({ inventaris: merged });
    }

    await pushBatchAlkesToBackend(merged);

    if (onShowNotification) {
      onShowNotification(
        'sync',
        'Impor Berhasil',
        `Sebanyak ${importedPreview.length} alat kesehatan berhasil ditambahkan ke inventaris.`
      );
    }

    alert(`Sukses! ${importedPreview.length} data alat kesehatan berhasil diinput ke inventaris aplikasi.`);
    setImportedPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_SAMPLE);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div
      id="modal-google-sheets-sync"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
    >
      <div className="relative w-full max-w-4xl rounded-3xl border border-red-900 bg-zinc-900 shadow-2xl text-white my-6 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 p-5 bg-gradient-to-r from-red-950 via-zinc-900 to-zinc-900 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-950 text-emerald-400 border border-emerald-800 shadow-md">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-emerald-950 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-400 border border-emerald-800">
                  SMART CLOUD SYNC & IMPORT
                </span>
                <span className="text-[11px] font-mono text-zinc-400">UPTD RSUD LAMADDUKELLENG ↔ SPREADSHEET</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white">
                Pusat Sinkronisasi & Impor Data Google Spreadsheet
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-zinc-800 p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-b border-zinc-800 bg-zinc-950/60 px-5 pt-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('sync')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === 'sync'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-950/20'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Sinkronisasi Webhook 2-Arah</span>
          </button>

          <button
            onClick={() => setActiveTab('import')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === 'import'
                ? 'border-red-500 text-red-400 bg-red-950/20'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Impor Link Sheet / File Excel / CSV</span>
            <span className="rounded-full bg-red-600 px-1.5 py-0.2 text-[9px] text-white">Praktis</span>
          </button>

          <button
            onClick={() => setActiveTab('script')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === 'script'
                ? 'border-red-500 text-red-400 bg-red-950/20'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Code2 className="h-3.5 w-3.5" />
            <span>Kode Apps Script (Code.gs v3.5)</span>
          </button>

          <button
            onClick={() => setActiveTab('csv')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === 'csv'
                ? 'border-red-500 text-red-400 bg-red-950/20'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Download className="h-3.5 w-3.5" />
            <span>Unduh CSV</span>
          </button>

          <button
            onClick={() => setActiveTab('email')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === 'email'
                ? 'border-red-500 text-red-400 bg-red-950/20'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Mail className="h-3.5 w-3.5" />
            <span>Email Laporan BAP</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Tab 1: Sync Realtime Webhook */}
          {activeTab === 'sync' && (
            <div className="space-y-5">
              {/* Summary card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="text-[11px] font-bold uppercase">Inventaris</span>
                    <Layers className="h-4 w-4 text-red-400" />
                  </div>
                  <div className="mt-2 text-xl font-black text-white">{inventaris.length} Alkes</div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="text-[11px] font-bold uppercase">PPM Terjadwal</span>
                    <FileCheck2 className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="mt-2 text-xl font-black text-white">{pemeliharaan.length} Kegiatan</div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="text-[11px] font-bold uppercase">SPK Perbaikan</span>
                    <Wrench className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="mt-2 text-xl font-black text-white">{perbaikan.length} SPK</div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="text-[11px] font-bold uppercase">BAP Penarikan</span>
                    <FileText className="h-4 w-4 text-rose-400" />
                  </div>
                  <div className="mt-2 text-xl font-black text-white">{beritaAcara.length} Dokumen</div>
                </div>
              </div>

              {/* Webhook Configuration Section */}
              <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Zap className="h-4 w-4 text-emerald-400" />
                      <span>URL Google Apps Script Webhook (Auto-Sync)</span>
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Masukkan URL Web App hasil deploy Apps Script Anda (akhiran <code>/exec</code>).
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('script')}
                    className="text-xs font-bold text-red-400 hover:text-red-300 underline flex items-center gap-1 self-start sm:self-auto"
                  >
                    <span>Lihat Cara Pasang Script</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      id="input-google-sheets-webhook-url"
                      type="url"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                      className="flex-1 rounded-2xl border border-zinc-700 bg-zinc-900 py-3 px-4 text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                    <div className="flex gap-2">
                      <button
                        id="btn-test-webhook"
                        onClick={handleTestWebhook}
                        disabled={isTesting || !webhookUrl.trim()}
                        className="flex items-center justify-center gap-1.5 rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-xs font-bold text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 transition-all"
                        title="Tes konektivitas ke Google Apps Script Webhook"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                        <span>{isTesting ? 'Mengecek...' : 'Tes Koneksi'}</span>
                      </button>
                      <button
                        id="btn-save-sheet-config"
                        onClick={handleSaveConfig}
                        className="flex items-center justify-center gap-1.5 rounded-2xl bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 px-4 py-2.5 text-xs font-bold text-white transition-all"
                      >
                        <Save className="h-3.5 w-3.5" />
                        <span>Simpan</span>
                      </button>
                    </div>
                  </div>

                  {/* Test Result Indicator */}
                  {testResult && (
                    <div
                      className={`flex items-center gap-2 rounded-xl p-3 text-xs ${
                        testResult.success
                          ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                          : 'bg-red-950/80 border border-red-800 text-red-300'
                      }`}
                    >
                      {testResult.success ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                      )}
                      <span>{testResult.message}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Sync Actions */}
              <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold text-white">Aksi Sinkronisasi Data Google Spreadsheet</h3>
                    <p className="text-xs text-zinc-400">
                      Tarik data terbaru dari Spreadsheet ke aplikasi atau kirim data dari aplikasi ke Spreadsheet.
                    </p>
                  </div>
                </div>

                {statusMessage && (
                  <div
                    className={`rounded-2xl p-4 text-xs font-mono leading-relaxed ${
                      syncStatus === 'success'
                        ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-200'
                        : syncStatus === 'error'
                        ? 'bg-red-950/60 border border-red-800 text-red-200'
                        : 'bg-zinc-900 border border-zinc-800 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {syncStatus === 'success' ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                      )}
                      <div>{statusMessage}</div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                  <button
                    id="btn-pull-sheet-data"
                    onClick={handlePullData}
                    disabled={isPulling || isSyncing || isPurgingDemo}
                    className="flex-1 w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl bg-zinc-800 border border-zinc-700 px-5 py-3 text-xs font-black uppercase tracking-wider text-zinc-100 hover:bg-zinc-700 hover:text-white transition-all active:scale-95 disabled:opacity-50 shadow-md"
                    title="Tarik data terbaru dari Google Spreadsheet ke dalam aplikasi ini"
                  >
                    <DownloadCloud className={`h-4 w-4 text-emerald-400 ${isPulling ? 'animate-bounce' : ''}`} />
                    <span>{isPulling ? 'Menarik Data...' : 'Tarik Data dari Sheet (Pull)'}</span>
                  </button>

                  <button
                    id="btn-trigger-full-sheet-sync"
                    onClick={handleTriggerSync}
                    disabled={isSyncing || isPulling || isPurgingDemo}
                    className="flex-1 w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 px-5 py-3 text-xs font-black uppercase tracking-wider text-white shadow-xl shadow-emerald-950 hover:from-emerald-500 hover:to-teal-600 transition-all active:scale-95 disabled:opacity-50"
                    title="Kirim dan sinkronkan seluruh data aplikasi ke Google Spreadsheet"
                  >
                    <UploadCloud className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Menyinkronkan...' : 'Kirim Data ke Sheet (Push)'}</span>
                  </button>
                </div>

                {/* Tombol Khusus: Hapus / Bersihkan Data Demo */}
                <div className="pt-2 border-t border-zinc-800/80">
                  <button
                    id="btn-purge-demo-data"
                    onClick={handlePurgeDemo}
                    disabled={isPurgingDemo || isSyncing || isPulling}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-red-950/40 hover:bg-red-900/60 border border-red-800/70 px-4 py-2.5 text-xs font-bold text-red-300 hover:text-red-100 transition-all active:scale-95 disabled:opacity-50"
                    title="Hapus permanen seluruh data demo dari database aplikasi dan Google Spreadsheet"
                  >
                    <Trash2 className={`h-4 w-4 text-red-400 ${isPurgingDemo ? 'animate-spin' : ''}`} />
                    <span>{isPurgingDemo ? 'Menghapus Data Demo...' : 'Hapus Semua Data Demo dari Aplikasi & Spreadsheet'}</span>
                  </button>
                  <p className="mt-1 text-[11px] text-zinc-500 text-center">
                    Data yang sudah dihapus tidak akan pernah dimunculkan lagi baik di aplikasi maupun spreadsheet.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Direct Import from Google Sheet Link / Excel / CSV */}
          {activeTab === 'import' && (
            <div className="space-y-6">
              {/* Opsi 1: Link Google Spreadsheet */}
              <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-950 text-red-400 border border-red-900">
                    <LinkIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Cara 1: Tempel Link Google Spreadsheet Langsung</h3>
                    <p className="text-xs text-zinc-400">
                      Cukup salin link Google Spreadsheet Anda (Pastikan akses sharing diatur: &quot;Siapa saja yang memiliki link&quot;).
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      value={directSheetUrl}
                      onChange={(e) => setDirectSheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5.../edit"
                      className="flex-1 rounded-2xl border border-zinc-700 bg-zinc-900 py-3 px-4 text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:border-red-500 focus:outline-none"
                    />
                    <button
                      onClick={handleImportDirectUrl}
                      disabled={isImportingUrl || !directSheetUrl.trim()}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-red-700 hover:bg-red-600 px-5 py-3 text-xs font-bold text-white transition-all disabled:opacity-50 shrink-0 shadow-lg shadow-red-950"
                    >
                      <DownloadCloud className={`h-4 w-4 ${isImportingUrl ? 'animate-bounce' : ''}`} />
                      <span>{isImportingUrl ? 'Mengimpor...' : 'Tarik & Impor ke Aplikasi'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Format kolom akan otomatis dicocokkan (Nama Alat, Ruangan, Merk, Tipe, SN, Kondisi, Kalibrasi, dll).
                  </p>
                </div>
              </div>

              {/* Opsi 2: Upload File Excel / CSV */}
              <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-950 text-emerald-400 border border-emerald-900">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Cara 2: Unggah File Excel (.xlsx, .xls) atau CSV (.csv)</h3>
                    <p className="text-xs text-zinc-400">
                      Pilih file data alkes dari laptop atau HP Anda untuk diinput langsung ke sistem SIM-ALKES.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls, .csv, .txt"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload-alkes-input"
                  />
                  <label
                    htmlFor="file-upload-alkes-input"
                    className="w-full sm:w-auto flex-1 cursor-pointer flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-700 hover:border-emerald-500 bg-zinc-900/60 p-4 text-xs font-bold text-zinc-300 hover:text-white transition-all text-center"
                  >
                    <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
                    <span>Pilih File Excel / CSV dari Perangkat</span>
                  </label>
                </div>

                {/* Preview Table of Uploaded File */}
                {importedPreview && (
                  <div className="rounded-2xl border border-emerald-800 bg-zinc-900 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Terdeteksi {importedPreview.length} Data Alkes Siap Diimpor</span>
                      </div>
                      <button
                        onClick={handleConfirmImportPreview}
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-black text-white shadow-lg shadow-emerald-950 transition-all"
                      >
                        <PlusCircle className="h-4 w-4" />
                        <span>Masukkan ke Inventaris ({importedPreview.length})</span>
                      </button>
                    </div>

                    <div className="max-h-48 overflow-y-auto rounded-xl border border-zinc-800 text-[11px] font-mono">
                      <table className="w-full text-left">
                        <thead className="bg-zinc-950 text-zinc-400 sticky top-0">
                          <tr>
                            <th className="p-2">No</th>
                            <th className="p-2">Nama Alat</th>
                            <th className="p-2">Ruangan</th>
                            <th className="p-2">Merk/Tipe</th>
                            <th className="p-2">Serial Number</th>
                            <th className="p-2">Kondisi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800 text-zinc-300">
                          {importedPreview.slice(0, 15).map((item, idx) => (
                            <tr key={idx} className="hover:bg-zinc-800/50">
                              <td className="p-2 text-zinc-500">{idx + 1}</td>
                              <td className="p-2 font-bold text-white">{item.namaAlat}</td>
                              <td className="p-2 text-emerald-400">{item.ruangan}</td>
                              <td className="p-2">{item.merk} {item.modelType}</td>
                              <td className="p-2 text-zinc-400">{item.serialNumber}</td>
                              <td className="p-2">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${item.kondisi === 'Baik' ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'}`}>
                                  {item.kondisi}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {importedPreview.length > 15 && (
                        <div className="p-2 text-center text-xs text-zinc-500 bg-zinc-950">
                          ... dan {importedPreview.length - 15} alkes lainnya
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Apps Script Code */}
          {activeTab === 'script' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Kode Google Apps Script Otomatis (Code.gs v3.5)</h3>
                  <p className="text-xs text-zinc-400">
                    Mendukung Simpan (doPost), Tarik Data (doGet), Pemetaan Kolom Fleksibel, dan Anti-Bentrok Konkurensi.
                  </p>
                </div>
                <button
                  onClick={handleCopyScript}
                  className="flex items-center gap-1.5 rounded-xl bg-red-700 hover:bg-red-600 px-3.5 py-1.5 text-xs font-bold text-white transition-all shadow"
                >
                  {copiedScript ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedScript ? 'Tersalin ke Clipboard!' : 'Salin Seluruh Script'}</span>
                </button>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-[11px] text-zinc-300 overflow-x-auto max-h-72">
                <pre>{GOOGLE_APPS_SCRIPT_SAMPLE}</pre>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-xs space-y-2 text-zinc-400">
                <p className="font-bold text-zinc-200">Langkah Pemasangan 3 Menit:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-zinc-300">
                  <li>Buka <a href="https://sheets.new" target="_blank" rel="noreferrer" className="text-red-400 underline font-bold">Google Spreadsheet Baru</a>.</li>
                  <li>Klik menu <strong>Extensions (Ekstensi) &gt; Apps Script</strong>.</li>
                  <li>Hapus kode bawaan <code>function myFunction() &#123;&#125;</code>, lalu <strong>Paste (Tempel)</strong> seluruh kode di atas.</li>
                  <li>Klik ikon <strong>Simpan (Disket / Ctrl+S)</strong>.</li>
                  <li>Klik tombol biru <strong>Deploy (Terapkan) &gt; New deployment (Deployment baru)</strong> di pojok kanan atas.</li>
                  <li>Klik ikon gerigi &gt; pilih tipe <strong>Web app (Aplikasi web)</strong>.</li>
                  <li>Isi konfigurasi:
                    <ul className="list-disc list-inside ml-4 mt-1 space-y-0.5 text-zinc-400">
                      <li><strong>Execute as (Jalankan sebagai)</strong>: <code>Me (Email Anda)</code></li>
                      <li><strong>Who has access (Yang memiliki akses)</strong>: <strong className="text-emerald-400">Anyone (Siapa saja)</strong></li>
                    </ul>
                  </li>
                  <li>Klik <strong>Deploy</strong>, lalu salin <strong>Web app URL</strong> (akhiran <code>/exec</code>) dan tempelkan pada tab <strong>Sinkronisasi Webhook</strong>.</li>
                </ol>
              </div>
            </div>
          )}

          {/* Tab 4: Direct CSV Download */}
          {activeTab === 'csv' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white">Unduh File CSV / Spreadsheet Langsung</h3>
                <p className="text-xs text-zinc-400">
                  Unduh data terformat lengkap dengan header standar medis Kemenkes RI.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => exportToCsv('inventaris', inventaris)}
                  className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 p-4 hover:border-red-600 hover:bg-zinc-900 text-left transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-950 text-red-400 border border-red-900">
                      <Layers className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white group-hover:text-red-400">CSV Inventaris Alkes</p>
                      <p className="text-[11px] text-zinc-400">{inventaris.length} Data Lengkap</p>
                    </div>
                  </div>
                  <Download className="h-4 w-4 text-zinc-400 group-hover:text-white" />
                </button>

                <button
                  onClick={() => exportToCsv('pemeliharaan', pemeliharaan)}
                  className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 p-4 hover:border-blue-600 hover:bg-zinc-900 text-left transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-950 text-blue-400 border border-blue-900">
                      <FileCheck2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white group-hover:text-blue-400">CSV Pemeliharaan (PPM)</p>
                      <p className="text-[11px] text-zinc-400">{pemeliharaan.length} Rekam Kegiatan</p>
                    </div>
                  </div>
                  <Download className="h-4 w-4 text-zinc-400 group-hover:text-white" />
                </button>

                <button
                  onClick={() => exportToCsv('perbaikan', perbaikan)}
                  className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 p-4 hover:border-amber-600 hover:bg-zinc-900 text-left transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-950 text-amber-400 border border-amber-900">
                      <Wrench className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white group-hover:text-amber-400">CSV Perbaikan (SPK)</p>
                      <p className="text-[11px] text-zinc-400">{perbaikan.length} Laporan SPK</p>
                    </div>
                  </div>
                  <Download className="h-4 w-4 text-zinc-400 group-hover:text-white" />
                </button>

                <button
                  onClick={() => exportToCsv('bap', beritaAcara)}
                  className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 p-4 hover:border-rose-600 hover:bg-zinc-900 text-left transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-950 text-rose-400 border border-rose-900">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white group-hover:text-rose-400">CSV Berita Acara (BAP)</p>
                      <p className="text-[11px] text-zinc-400">{beritaAcara.length} Berita Acara</p>
                    </div>
                  </div>
                  <Download className="h-4 w-4 text-zinc-400 group-hover:text-white" />
                </button>
              </div>
            </div>
          )}

          {/* Tab 5: Email Pelaporan BAP */}
          {activeTab === 'email' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white">Alamat Email Tujuan Pelaporan Otomatis BAP</h3>
                <p className="text-xs text-zinc-400">
                  Setiap kali teknisi memilih status &quot;Penarikan Alat&quot;, laporan BAP otomatis disimpan dan dapat langsung dikirimkan ke email pimpinan / direktur / pengurus barang ini.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 block">
                  Email Tujuan Pelaporan (Designated Email)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    value={designatedEmail}
                    onChange={(e) => setDesignatedEmail(e.target.value)}
                    placeholder="bulukumba17101994@gmail.com"
                    className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 py-2 px-3 text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:border-red-500 focus:outline-none"
                  />
                  <button
                    onClick={handleSaveConfig}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-red-700 hover:bg-red-600 px-4 py-2 text-xs font-bold text-white"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>Simpan Email</span>
                  </button>
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-400 pt-1">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Email default aktif: <strong>{designatedEmail}</strong></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-950/90 p-4 rounded-b-3xl text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Database SIM-ALKES UPTD RSUD LAMADDUKELLENG Siap Sinkron</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl bg-zinc-800 hover:bg-zinc-700 px-4 py-2 text-xs font-bold text-white transition-all"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
