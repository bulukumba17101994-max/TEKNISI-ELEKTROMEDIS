import React, { useState, useRef, useEffect } from 'react';
import {
  QrCode,
  Camera,
  Upload,
  X,
  CheckCircle2,
  AlertTriangle,
  Layers,
  FileCheck2,
  Wrench,
  Search,
  ClipboardPaste,
} from 'lucide-react';
import { AlkesItem } from '../types';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventaris: AlkesItem[];
  onSelectAlkes: (alkes: AlkesItem, action?: 'view' | 'ppm' | 'perbaikan') => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  inventaris,
  onSelectAlkes,
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'paste' | 'quick'>('quick');
  const [scannedResult, setScannedResult] = useState<AlkesItem | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [quickSearch, setQuickSearch] = useState('');
  const [pasteInput, setPasteInput] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Robust QR Parser supporting both clean plain-text format and JSON
  const parseQrText = (raw: string): AlkesItem | null => {
    if (!raw || !raw.trim()) return null;
    const clean = raw.trim();

    let extractedSn = '';
    let extractedNama = '';
    let extractedRuangan = '';
    let extractedId = '';
    let extractedMerk = '';
    let extractedModel = '';
    let extractedThn = '-';
    let extractedKalTerakhir = '';
    let extractedKalBerikut = '';
    let extractedKondisi = 'Baik';
    let extractedKeterangan = 'Siap Digunakan';

    // 1. Plain-text lines format (New Clean Format)
    const lines = clean.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (/^sn\s*:\s*(.+)$/i.test(line)) extractedSn = line.replace(/^sn\s*:\s*/i, '').trim();
      else if (/^namaAlat\s*:\s*(.+)$/i.test(line)) extractedNama = line.replace(/^namaAlat\s*:\s*/i, '').trim();
      else if (/^ruangan\s*:\s*(.+)$/i.test(line)) extractedRuangan = line.replace(/^ruangan\s*:\s*/i, '').trim();
      else if (/^merk\s*:\s*(.+)$/i.test(line)) extractedMerk = line.replace(/^merk\s*:\s*/i, '').trim();
      else if (/^modelType\s*:\s*(.+)$/i.test(line)) extractedModel = line.replace(/^modelType\s*:\s*/i, '').trim();
      else if (/^thn\s*Pengadaan\s*:\s*(.+)$/i.test(line)) extractedThn = line.replace(/^thn\s*Pengadaan\s*:\s*/i, '').trim();
      else if (/^kalibrasi\s*Terakhir\s*:\s*(.+)$/i.test(line)) extractedKalTerakhir = line.replace(/^kalibrasi\s*Terakhir\s*:\s*/i, '').trim();
      else if (/^kalibrasi\s*Berikut\s*:\s*(.+)$/i.test(line)) extractedKalBerikut = line.replace(/^kalibrasi\s*Berikut\s*:\s*/i, '').trim();
      else if (/^kondisi\s*:\s*(.+)$/i.test(line)) extractedKondisi = line.replace(/^kondisi\s*:\s*/i, '').trim();
      else if (/^keterangan\s*:\s*(.+)$/i.test(line)) extractedKeterangan = line.replace(/^keterangan\s*:\s*/i, '').trim();
      else if (/^id\s*:\s*(.+)$/i.test(line)) extractedId = line.replace(/^id\s*:\s*/i, '').trim();
    }

    // 2. Legacy JSON fallback
    if (!extractedSn && clean.startsWith('{') && clean.endsWith('}')) {
      try {
        const p = JSON.parse(clean);
        extractedSn = p.sn || p.serialNumber || '';
        extractedNama = p.namaAlat || '';
        extractedRuangan = p.ruangan || '';
        extractedId = p.id || '';
        extractedMerk = p.merk || '';
        extractedModel = p.modelType || '';
        extractedThn = p.thnPengadaan || '-';
        extractedKalTerakhir = p.kalibrasiTerakhir || '';
        extractedKalBerikut = p.kalibrasiBerikut || '';
        extractedKondisi = p.kondisi || 'Baik';
        extractedKeterangan = p.keterangan || 'Siap Digunakan';
      } catch {}
    }

    // Match in local inventaris by ID or Serial Number
    let match = inventaris.find((item) => {
      if (extractedId && item.id.toLowerCase() === extractedId.toLowerCase()) return true;
      if (extractedSn && extractedSn !== '-' && item.serialNumber.toLowerCase() === extractedSn.toLowerCase()) return true;
      return false;
    });

    if (!match && extractedNama) {
      match = inventaris.find(
        (item) =>
          item.namaAlat.toLowerCase() === extractedNama.toLowerCase() &&
          (!extractedRuangan || item.ruangan.toLowerCase() === extractedRuangan.toLowerCase())
      );
    }

    if (match) return match;

    // If not found in database, construct from scanned QR payload
    if (extractedNama || extractedSn) {
      return {
        id: extractedId || `ALKES-SCAN-${Date.now()}`,
        ruangan: (extractedRuangan as any) || 'UGD',
        namaAlat: extractedNama || 'Alat Medis Terdeteksi',
        merk: extractedMerk || '-',
        modelType: extractedModel || '-',
        serialNumber: extractedSn || '-',
        tahunPengadaan: extractedThn,
        kalibrasiTerakhir: extractedKalTerakhir,
        kalibrasiBerikutnya: extractedKalBerikut,
        statusKalibrasi: 'Perlu Kalibrasi',
        kondisi: (extractedKondisi as any) || 'Baik',
        keterangan: (extractedKeterangan as any) || 'Siap Digunakan',
        nomorInventaris: '-',
        lokasiSpesifik: '-',
      };
    }

    return null;
  };

  const handleProcessPaste = () => {
    setParseError(null);
    const parsed = parseQrText(pasteInput);
    if (parsed) {
      setScannedResult(parsed);
    } else {
      setParseError('Data QR code tidak dikenali. Pastikan format teks sesuai standar SIM-ALKES.');
    }
  };

  // Start Camera
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }

        // Live detector if supported
        if ('BarcodeDetector' in window) {
          try {
            const detector = new (window as any).BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13'] });
            const checkFrame = async () => {
              if (videoRef.current && streamRef.current && videoRef.current.readyState >= 2) {
                try {
                  const codes = await detector.detect(videoRef.current);
                  if (codes && codes.length > 0 && codes[0].rawValue) {
                    const parsed = parseQrText(codes[0].rawValue);
                    if (parsed) {
                      setScannedResult(parsed);
                    }
                  }
                } catch (e) {}
              }
              if (streamRef.current) {
                requestAnimationFrame(checkFrame);
              }
            };
            requestAnimationFrame(checkFrame);
          } catch (e) {}
        }
      } else {
        setCameraError('Kamera tidak didukung di browser ini atau izin diblokir.');
      }
    } catch (err: any) {
      setCameraError('Tidak dapat mengakses kamera perangkat. Pastikan izin kamera telah diberikan.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  return (
    <div
      id="modal-qr-scanner"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
    >
      <div className="relative w-full max-w-lg rounded-3xl border border-red-900/80 bg-zinc-900 p-6 shadow-2xl text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-950 text-red-400 border border-red-800">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Pindai QR / Barcode Alkes</h3>
              <p className="text-xs text-zinc-400">UPTD RSUD LAMADDUKELLENG • Scanner Elektromedis</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl border border-zinc-800 p-1.5 text-zinc-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex rounded-xl bg-zinc-950 p-1 border border-zinc-800 mb-4">
          <button
            onClick={() => setActiveTab('quick')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'quick' ? 'bg-red-700 text-white shadow' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Pilih Cepat / SN
          </button>
          <button
            onClick={() => setActiveTab('camera')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'camera' ? 'bg-red-700 text-white shadow' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Kamera Live
          </button>
          <button
            onClick={() => setActiveTab('paste')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'paste' ? 'bg-red-700 text-white shadow' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Tempel Teks QR
          </button>
        </div>

        {/* Tab 1: Live Camera */}
        {activeTab === 'camera' && (
          <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-black aspect-video flex flex-col items-center justify-center">
            {cameraError ? (
              <div className="p-4 text-center text-xs text-zinc-400">
                <AlertTriangle className="mx-auto h-8 w-8 text-amber-500 mb-2" />
                <p className="font-bold text-zinc-300">Akses Kamera Terkendala</p>
                <p className="mt-1">{cameraError}</p>
                <p className="mt-2 text-zinc-500">Silakan gunakan tab &quot;Pilih Cepat / SN&quot; atau &quot;Tempel Teks QR&quot;.</p>
              </div>
            ) : (
              <>
                <video ref={videoRef} className="h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-44 w-44 rounded-2xl border-2 border-red-500/80 shadow-[0_0_20px_rgba(239,68,68,0.5)] relative">
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-400 animate-bounce" />
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 2: Paste QR Code Text */}
        {activeTab === 'paste' && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-400">
              Tempelkan hasil scan QR code dari scanner eksternal atau kamera ponsel Anda di bawah ini:
            </p>
            <textarea
              rows={5}
              placeholder={`UPTD RSUD LAMADDUKELLENG\nruangan: NICU\nnamaAlat: Infant warmer\nmerk: Fyrom\nsn: 1062209220027\n...`}
              value={pasteInput}
              onChange={(e) => setPasteInput(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-xs font-mono text-white placeholder-zinc-600 focus:border-red-500 focus:outline-none"
            />
            {parseError && (
              <p className="text-[11px] text-red-400 font-bold">{parseError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleProcessPaste}
                disabled={!pasteInput.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-red-700 hover:bg-red-600 disabled:opacity-50 py-2.5 text-xs font-bold text-white shadow transition-all"
              >
                <ClipboardPaste className="h-4 w-4" />
                <span>Deteksi Data Alat</span>
              </button>
              <button
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    if (text) {
                      setPasteInput(text);
                      const parsed = parseQrText(text);
                      if (parsed) setScannedResult(parsed);
                    }
                  } catch {}
                }}
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-xs font-bold text-zinc-300 hover:bg-zinc-700"
              >
                Paste Clipboard
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Quick Alkes / SN Selector */}
        {activeTab === 'quick' && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Ketik nama alat, serial number, atau ruangan..."
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2 pl-9 pr-3 text-xs text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none"
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {inventaris
                .filter(
                  (i) =>
                    i.namaAlat.toLowerCase().includes(quickSearch.toLowerCase()) ||
                    i.serialNumber.toLowerCase().includes(quickSearch.toLowerCase()) ||
                    i.ruangan.toLowerCase().includes(quickSearch.toLowerCase())
                )
                .map((alkes) => (
                  <div
                    key={alkes.id}
                    onClick={() => setScannedResult(alkes)}
                    className={`cursor-pointer flex items-center justify-between rounded-xl border p-2.5 transition-all ${
                      scannedResult?.id === alkes.id
                        ? 'border-red-500 bg-red-950/60 ring-1 ring-red-500'
                        : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-800/60'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-zinc-800 px-1.5 py-0.2 text-[9px] font-bold text-zinc-300">
                          {alkes.ruangan}
                        </span>
                        <p className="font-bold text-xs text-white truncate">{alkes.namaAlat}</p>
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        {alkes.merk} • SN: <strong className="font-mono text-zinc-300">{alkes.serialNumber}</strong>
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-red-400">Pilih</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Scanned Result Card */}
        {scannedResult && (
          <div className="mt-4 rounded-2xl border border-emerald-800 bg-emerald-950/40 p-4 text-xs">
            <div className="flex items-center justify-between border-b border-emerald-800/60 pb-2 mb-2">
              <span className="flex items-center gap-1.5 font-bold text-emerald-400">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Alat Terdeteksi: {scannedResult.serialNumber}
              </span>
              <span className="rounded bg-emerald-900 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                {scannedResult.ruangan}
              </span>
            </div>

            <p className="text-sm font-black text-white">{scannedResult.namaAlat}</p>
            <p className="text-zinc-300">
              Merk: {scannedResult.merk} • Model: {scannedResult.modelType}
            </p>
            <p className="text-zinc-400">
              Kondisi: <strong className="text-white">{scannedResult.kondisi}</strong> • Status Kalibrasi:{' '}
              <strong className="text-emerald-300">{scannedResult.statusKalibrasi}</strong>
            </p>

            {/* Actions for Scanned Item */}
            <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-emerald-900/60">
              <button
                onClick={() => {
                  onSelectAlkes(scannedResult, 'view');
                  onClose();
                }}
                className="flex-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 py-2 text-xs font-bold text-white shadow"
              >
                Lihat Detail
              </button>
              <button
                onClick={() => {
                  onSelectAlkes(scannedResult, 'ppm');
                  onClose();
                }}
                className="flex-1 rounded-xl bg-emerald-700 hover:bg-emerald-600 py-2 text-xs font-bold text-white shadow"
              >
                + Lembar PPM
              </button>
              <button
                onClick={() => {
                  onSelectAlkes(scannedResult, 'perbaikan');
                  onClose();
                }}
                className="flex-1 rounded-xl bg-red-700 hover:bg-red-600 py-2 text-xs font-bold text-white shadow"
              >
                + Form Perbaikan
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
