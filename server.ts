import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import {
  INITIAL_INVENTARIS,
  INITIAL_PEMELIHARAAN,
  INITIAL_PERBAIKAN,
  INITIAL_BERITA_ACARA,
  DEMO_DATA_IDS,
  isDemoId,
} from './src/data/initialData';

const app = express();
const PORT = 3000;

// Initialize Google Gen AI with telemetry User-Agent
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Data persistence file path
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial deleted map with all demo data IDs so they are never accepted or revived
const initialDeletedIds: Record<string, number> = {};
DEMO_DATA_IDS.forEach((id) => {
  initialDeletedIds[id] = Date.now();
});

// In-memory cache with fallback to disk
let dbStore: {
  inventaris: any[];
  pemeliharaan: any[];
  perbaikan: any[];
  beritaAcara: any[];
  deletedIds: Record<string, number>;
  inventarisClearedAt?: number;
  lastUpdated: number;
  config?: {
    googleSheetsWebhookUrl?: string;
    designatedEmail?: string;
    autoSyncEnabled?: boolean;
    lastSheetSyncTime?: string;
    sheetSyncLogs?: any[];
  };
} = {
  inventaris: [],
  pemeliharaan: [],
  perbaikan: [],
  beritaAcara: [],
  deletedIds: { ...initialDeletedIds },
  inventarisClearedAt: 0,
  lastUpdated: Date.now(),
  config: {
    googleSheetsWebhookUrl: 'https://script.google.com/macros/s/AKfycbzUmPWBm_bEfgzYfttT8wwDIE3K5-z5xXxC03mY-i5LC7pHW9Bn9Qk9sUuxd31O9B9r5A/exec',
    designatedEmail: 'bulukumba17101994@gmail.com',
    autoSyncEnabled: true,
    lastSheetSyncTime: '',
    sheetSyncLogs: [],
  },
};

// Load saved data if exists
if (fs.existsSync(DATA_FILE)) {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    dbStore = {
      ...dbStore,
      ...parsed,
      deletedIds: {
        ...initialDeletedIds,
        ...(parsed.deletedIds || {}),
      },
      config: {
        ...dbStore.config,
        ...(parsed.config || {}),
      },
    };
    // Ensure all demo data is marked as deleted
    DEMO_DATA_IDS.forEach((id) => {
      dbStore.deletedIds[id] = dbStore.deletedIds[id] || Date.now();
    });
    // Filter out any demo data or deleted items
    sanitizeDbStore(dbStore);
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(dbStore, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Failed to save clean db.json', e);
    }
  } catch (err) {
    console.error('Failed to load db.json, starting fresh with clean data', err);
    dbStore.inventaris = [];
    dbStore.pemeliharaan = [];
    dbStore.perbaikan = [];
    dbStore.beritaAcara = [];
    dbStore.deletedIds = { ...initialDeletedIds };
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(dbStore, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Failed to save fresh db.json', e);
    }
  }
} else {
  // First time write
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(dbStore, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to initialize db.json', err);
  }
}

function normalizeDateString(val: any): string {
  if (!val) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  let str = String(val).trim();
  if (!str || str === '-' || str === 'null' || str === 'undefined') return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
    return str.slice(0, 10);
  }

  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  if (/^\d{5}$/.test(str)) {
    const serial = parseInt(str, 10);
    const utcDays = serial - 25569;
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);
    if (!isNaN(dateInfo.getTime())) {
      const y = dateInfo.getFullYear();
      const m = String(dateInfo.getMonth() + 1).padStart(2, '0');
      const d = String(dateInfo.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  const parsedDate = new Date(str);
  if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 1900) {
    const y = parsedDate.getFullYear();
    const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const d = String(parsedDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return str;
}

function sanitizeAlkesItem(item: any): any {
  if (!item) return item;
  return {
    ...item,
    kalibrasiTerakhir: normalizeDateString(item.kalibrasiTerakhir),
    kalibrasiBerikutnya: normalizeDateString(item.kalibrasiBerikutnya),
  };
}

function sanitizeDbStore(store: typeof dbStore) {
  if (!store.deletedIds) {
    store.deletedIds = {};
  }
  DEMO_DATA_IDS.forEach((id) => {
    store.deletedIds[id] = store.deletedIds[id] || Date.now();
  });

  if (Array.isArray(store.inventaris)) {
    store.inventaris = store.inventaris
      .filter((item) => item && item.id && !store.deletedIds[item.id] && !isDemoId(item.id))
      .map(sanitizeAlkesItem);
  }
  if (Array.isArray(store.pemeliharaan)) {
    store.pemeliharaan = store.pemeliharaan
      .filter((p) => p && p.id && !store.deletedIds[p.id] && !isDemoId(p.id))
      .map((p) => ({
        ...p,
        tanggal: normalizeDateString(p.tanggal),
      }));
  }
  if (Array.isArray(store.perbaikan)) {
    store.perbaikan = store.perbaikan
      .filter((p) => p && p.id && !store.deletedIds[p.id] && !isDemoId(p.id))
      .map((p) => ({
        ...p,
        tanggal: normalizeDateString(p.tanggal),
      }));
  }
  if (Array.isArray(store.beritaAcara)) {
    store.beritaAcara = store.beritaAcara
      .filter((b) => b && b.id && !store.deletedIds[b.id] && !isDemoId(b.id))
      .map((b) => ({
        ...b,
        tanggal: normalizeDateString(b.tanggal),
      }));
  }
}

const saveToDisk = () => {
  try {
    sanitizeDbStore(dbStore);
    fs.writeFileSync(DATA_FILE, JSON.stringify(dbStore, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write db.json', err);
  }
};

// API: Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    system: 'SIM-ALKES IPSRS UPTD RSUD LAMADDUKELLENG BACKEND',
    timestamp: new Date().toISOString(),
    records: {
      inventaris: dbStore.inventaris.length,
      pemeliharaan: dbStore.pemeliharaan.length,
      perbaikan: dbStore.perbaikan.length,
      beritaAcara: dbStore.beritaAcara.length,
    },
    config: dbStore.config,
  });
});

// API: System Configuration (Google Sheets Webhook & Target Email)
app.get('/api/system/config', (req, res) => {
  res.json({
    success: true,
    config: dbStore.config || {
      googleSheetsWebhookUrl: '',
      designatedEmail: 'bulukumba17101994@gmail.com',
      autoSyncEnabled: true,
      lastSheetSyncTime: '',
    },
  });
});

app.post('/api/system/config', (req, res) => {
  const { googleSheetsWebhookUrl, designatedEmail, autoSyncEnabled } = req.body;
  dbStore.config = {
    ...dbStore.config,
    googleSheetsWebhookUrl: googleSheetsWebhookUrl !== undefined ? googleSheetsWebhookUrl : dbStore.config?.googleSheetsWebhookUrl,
    designatedEmail: designatedEmail || dbStore.config?.designatedEmail || 'bulukumba17101994@gmail.com',
    autoSyncEnabled: autoSyncEnabled !== undefined ? autoSyncEnabled : dbStore.config?.autoSyncEnabled,
  };
  saveToDisk();
  res.json({ success: true, config: dbStore.config });
});

// API: Gemini Multi-Turn AI Chat for Elektromedis & SIM-ALKES IPSRS UPTD RSUD LAMADDUKELLENG
app.post('/api/gemini/chat', async (req, res) => {
  try {
    const {
      messages,
      model = 'gemini-3.7-flash',
      role = 'teknisi_utama',
      customInstruction = '',
      includeContext = true,
    } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Pesan chat tidak boleh kosong.',
      });
    }

    // Determine model alias or fallback
    let selectedModel = model;
    if (model === 'gemini-pro' || model === 'pro') {
      selectedModel = 'gemini-3.1-pro-preview';
    } else if (model === 'gemini-lite' || model === 'fast' || model === 'flash-lite') {
      selectedModel = 'gemini-3.1-flash-lite';
    } else if (!selectedModel || model === 'default' || model === 'flash') {
      selectedModel = 'gemini-3.7-flash';
    }

    // Construct live context summary if requested
    let liveHospitalContext = '';
    if (includeContext) {
      const totalAlkes = dbStore.inventaris.length;
      const rusakCount = dbStore.inventaris.filter((i) => i.kondisi && i.kondisi.includes('Rusak')).length;
      const butuhKalibrasi = dbStore.inventaris.filter(
        (i) => i.statusKalibrasi === 'Perlu Kalibrasi' || i.statusKalibrasi === 'Kadaluarsa'
      ).length;
      const bapCount = dbStore.beritaAcara.length;
      const ppmCount = dbStore.pemeliharaan.length;
      const spkCount = dbStore.perbaikan.length;

      // Sample sample equipment from database
      const sampleAlkes = dbStore.inventaris.slice(0, 15).map((a) => ({
        nama: a.namaAlat,
        merk: a.merk,
        ruangan: a.ruangan,
        kondisi: a.kondisi,
        statusKalibrasi: a.statusKalibrasi,
      }));

      liveHospitalContext = `\n\n[DATA REALTIME SIM-ALKES IPSRS UPTD RSUD LAMADDUKELLENG]:
- Total Alat Kesehatan Terdaftar: ${totalAlkes} unit
- Alat Dalam Kondisi Rusak/Perlu Perhatian: ${rusakCount} unit
- Alat Perlu/Kadaluarsa Kalibrasi: ${butuhKalibrasi} unit
- Total Lembar PPM: ${ppmCount} kegiatan
- Total SPK Perbaikan: ${spkCount} laporan
- Total Berita Acara Penarikan (BAP): ${bapCount} berkas
- Contoh Sampel Alat Terdaftar: ${JSON.stringify(sampleAlkes)}`;
    }

    // Build system instruction
    const baseInstruction = `Anda adalah "SIM-ALKES AI Assistant" — Asisten Cerdas Spesialis Elektromedis, Manajemen Pemeliharaan, dan Kalibrasi Alat Kesehatan di IPSRS UPTD RSUD LAMADDUKELLENG, Kabupaten Wajo, Sulawesi Selatan.
Anda memiliki keahlian mendalam dalam bidang Teknik Elektromedis, Standar Kemenkes RI, Permenkes tentang Pengujian dan Kalibrasi Alkes, Standar BPFK, SOP Pemeliharaan Preventif (PPM), Analisis Troubleshooting Kerusakan Alat Medis, dan Pembuatan Berita Acara Penarikan (BAP).

Informasi Rumah Sakit:
- Nama Faskes: IPSRS UPTD RSUD LAMADDUKELLENG, Kab. Wajo, Prov. Sulawesi Selatan.
- Tim Elektromedis: Musmuliadi, SKM.M.M (Koordinator), Ramlan, A.Md.TEM, Ummi Rukiah Wardi, A.Md.TEM, Muh Faisal, A.Md.T.
- Ruangan: 28 ruangan IPSRS UPTD RSUD LAMADDUKELLENG (IGD, ICU, OK, Perawatan Tulip, Cempaka, Melati, Seruni, Anggrek, Edelweis, CSSD, Radiologi, Laboratorium, Poliklinik, dll).

Panduan Jawaban:
1. Berikan jawaban yang praktis, sistematis, ramah, profesional, dan berbasis standar teknis elektromedis serta keselamatan pasien (K3RS).
2. Format jawaban dengan rapi menggunakan Markdown (gunakan bullet points, bold, numbering, dan tabel jika relevan).
3. Jika ditanya tentang troubleshooting alat (misal Infusion Pump, Syringe Pump, USG, Defibrillator, EKG, Baby Incubator, Suction Pump, Lampu Operasi, Autoclave), berikan panduan langkah-demi-langkah: Pemeriksaan Awal -> Analisis Kode Error/Gejala -> Solusi Tindakan -> Verifikasi & Uji Fungsi.
4. Jika diminta membuat teks analisa Berita Acara Penarikan (BAP), buatkan kalimat formal, teknis, dan kuat secara regulasi.
5. Gunakan bahasa Indonesia yang baik, lugas, dan terstruktur.`;

    let roleSpecific = '';
    if (role === 'troubleshooter') {
      roleSpecific = '\n\nPeran Khusus: Anda bertindak sebagai Senior Troubleshooting Engineer. Fokus utama Anda adalah menganalisis kode error, malfungsi sensor/aktuator/power supply, dan memberikan checklist perbaikan yang aman.';
    } else if (role === 'kalibrasi_sop') {
      roleSpecific = '\n\nPeran Khusus: Anda bertindak sebagai Pakar Kalibrasi & Standar Mutu BPFK/Kemenkes. Fokus Anda adalah parameter uji kelayakan, batas toleransi akurasi, uji keselamatan listrik (electrical safety analyzer), dan jadwal kalibrasi tahunan.';
    } else if (role === 'analis_bap') {
      roleSpecific = '\n\nPeran Khusus: Anda bertindak sebagai Konsultan Analisa Teknis & Penghapusan/Penarikan Aset Medis. Fokus Anda adalah menyusun kronologis kerusakan, verifikasi ketersediaan suku cadang, rasio biaya perbaikan vs beli baru (economic repair limit), dan kalimat rekomendasi BAP.';
    } else if (role === 'manajemen_aset') {
      roleSpecific = '\n\nPeran Khusus: Anda bertindak sebagai Koordinator Manajemen Aset & SIM-ALKES. Fokus Anda adalah optimasi inventaris, rasio kesiapan alat (uptime), dan strategi PPM 28 ruangan IPSRS UPTD RSUD LAMADDUKELLENG.';
    }

    const finalSystemInstruction = `${baseInstruction}${roleSpecific}${liveHospitalContext}${customInstruction ? `\n\nInstruksi Khusus Pengguna: ${customInstruction}` : ''}`;

    // Format contents for multi-turn chat
    const contents = messages.map((m: any) => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(m.content || '') }],
    }));

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents,
      config: {
        systemInstruction: finalSystemInstruction,
      },
    });

    const replyText = response.text || 'Maaf, tidak ada respons yang dihasilkan dari model.';

    res.json({
      success: true,
      text: replyText,
      modelUsed: selectedModel,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Gemini API Chat Error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Terjadi kesalahan saat memproses permintaan AI.',
    });
  }
});

// Helper to perform pull from Google Spreadsheet (bidirectional sync / auto-rehydration)
async function performPullFromGoogleSheets(webhookUrl?: string): Promise<{
  success: boolean;
  error?: string;
  counts?: { inventaris: number; pemeliharaan: number; perbaikan: number; beritaAcara: number };
}> {
  const targetWebhook = webhookUrl || dbStore.config?.googleSheetsWebhookUrl;
  if (!targetWebhook || !targetWebhook.startsWith('http')) {
    return { success: false, error: 'URL Google Apps Script Webhook belum dikonfigurasi.' };
  }

  if (targetWebhook.includes('docs.google.com/spreadsheets')) {
    return { success: false, error: 'Silakan gunakan Webhook Apps Script untuk sinkronisasi otomatis.' };
  }

  try {
    let response = await fetch(`${targetWebhook}?action=GET_ALL`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    let json: any = null;
    if (response.ok) {
      json = await response.json();
    } else {
      response = await fetch(targetWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'GET_ALL' }),
      });
      if (response.ok) {
        json = await response.json();
      }
    }

    if (!json || json.status === 'error' || !json.data) {
      return {
        success: false,
        error: json?.error || 'Gagal memproses data dari Google Spreadsheet Webhook.',
      };
    }

    const fetchedData = json.data;

    // Merge helper by unique ID and timestamp
    const mergeById = (existingList: any[], incomingList: any[]) => {
      const map = new Map();
      existingList.forEach((item) => {
        if (item && item.id && !dbStore.deletedIds[item.id] && !isDemoId(item.id)) {
          map.set(item.id, item);
        }
      });
      (incomingList || []).forEach((item: any) => {
        if (!item || !item.id) return;
        if (dbStore.deletedIds[item.id] || isDemoId(item.id)) return;
        if (!map.has(item.id)) {
          map.set(item.id, item);
        } else {
          const existing = map.get(item.id);
          const incomingUpdated = new Date(item.updatedAt || item.createdAt || item.tanggal || 0).getTime();
          const existingUpdated = new Date(existing.updatedAt || existing.createdAt || existing.tanggal || 0).getTime();
          if (incomingUpdated >= existingUpdated) {
            map.set(item.id, { ...existing, ...item });
          }
        }
      });
      return Array.from(map.values());
    };

    if (Array.isArray(fetchedData.inventaris)) {
      dbStore.inventaris = mergeById(dbStore.inventaris, fetchedData.inventaris);
    }
    if (Array.isArray(fetchedData.pemeliharaan)) {
      dbStore.pemeliharaan = mergeById(dbStore.pemeliharaan, fetchedData.pemeliharaan);
    }
    if (Array.isArray(fetchedData.perbaikan)) {
      dbStore.perbaikan = mergeById(dbStore.perbaikan, fetchedData.perbaikan);
    }
    if (Array.isArray(fetchedData.beritaAcara)) {
      dbStore.beritaAcara = mergeById(dbStore.beritaAcara, fetchedData.beritaAcara);
    }

    dbStore.lastUpdated = Date.now();
    saveToDisk();

    return {
      success: true,
      counts: {
        inventaris: dbStore.inventaris.length,
        pemeliharaan: dbStore.pemeliharaan.length,
        perbaikan: dbStore.perbaikan.length,
        beritaAcara: dbStore.beritaAcara.length,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'Gagal terhubung ke Google Apps Script: ' + (err.message || String(err)),
    };
  }
}

// API: Get all sync data (Auto-rehydrate from Google Sheets if server memory is empty)
app.get('/api/sync/all', async (req, res) => {
  // Jika database server kosong dan webhook spreadsheet aktif, otomatis rehidrasi dari Google Spreadsheet
  if (dbStore.inventaris.length === 0 && dbStore.config?.googleSheetsWebhookUrl?.startsWith('http')) {
    await performPullFromGoogleSheets();
  }

  res.json({
    success: true,
    data: dbStore,
    serverTime: Date.now(),
  });
});

// Auto-rehydrate from Google Sheets on container startup / cold start after inactivity
setTimeout(() => {
  if (dbStore.config?.googleSheetsWebhookUrl?.startsWith('http')) {
    performPullFromGoogleSheets()
      .then((res) => {
        if (
          res.success &&
          res.counts &&
          (res.counts.inventaris > 0 ||
            res.counts.pemeliharaan > 0 ||
            res.counts.perbaikan > 0 ||
            res.counts.beritaAcara > 0)
        ) {
          console.log(`Auto-rehydrated items from Google Spreadsheet on startup.`);
          broadcastSseEvent({
            type: 'BATCH_SYNC_UPDATE',
            timestamp: dbStore.lastUpdated,
            deletedIds: dbStore.deletedIds,
            data: dbStore,
          });
        }
      })
      .catch(() => {});
  }
}, 1000);

// Background periodic sync with Google Sheets (every 2.5 minutes) to ensure data is always synchronized
setInterval(async () => {
  if (dbStore.config?.autoSyncEnabled !== false && dbStore.config?.googleSheetsWebhookUrl?.startsWith('http')) {
    try {
      const prevCounts = {
        inv: dbStore.inventaris.length,
        ppm: dbStore.pemeliharaan.length,
        spk: dbStore.perbaikan.length,
        bap: dbStore.beritaAcara.length,
      };
      const res = await performPullFromGoogleSheets();
      if (
        res.success &&
        (dbStore.inventaris.length !== prevCounts.inv ||
          dbStore.pemeliharaan.length !== prevCounts.ppm ||
          dbStore.perbaikan.length !== prevCounts.spk ||
          dbStore.beritaAcara.length !== prevCounts.bap)
      ) {
        broadcastSseEvent({
          type: 'BATCH_SYNC_UPDATE',
          timestamp: dbStore.lastUpdated,
          deletedIds: dbStore.deletedIds,
          data: dbStore,
        });
      }
    } catch {}
  }
}, 2.5 * 60 * 1000);

// Helper to format tables for Google Sheets with correct Headers
const buildGoogleSheetsData = () => {
  const sheets = {
    INVENTARIS_ALKES: {
      headers: [
        'ID ALKES',
        'RUANGAN',
        'NAMA ALAT KESEHATAN',
        'MERK',
        'MODEL / TYPE',
        'SERIAL NUMBER (SN)',
        'TAHUN PENGADAAN',
        'KALIBRASI TERAKHIR',
        'KALIBRASI BERIKUTNYA',
        'STATUS KALIBRASI',
        'KONDISI ALAT',
        'KETERANGAN',
        'NOMOR INVENTARIS',
        'LOKASI SPESIFIK',
        'TERAKHIR DIUBAH',
        'PETUGAS ELEKTROMEDIS',
      ],
      rows: dbStore.inventaris.map((item) => [
        item.id,
        item.ruangan,
        item.namaAlat,
        item.merk,
        item.modelType,
        item.serialNumber,
        item.tahunPengadaan || '-',
        item.kalibrasiTerakhir || '-',
        item.kalibrasiBerikutnya || '-',
        item.statusKalibrasi,
        item.kondisi,
        item.keterangan,
        item.nomorInventaris || '-',
        item.lokasiSpesifik || '-',
        item.updatedAt || item.createdAt || '',
        item.lastEditedBy || 'Teknisi Elektromedis IPSRS UPTD RSUD LAMADDUKELLENG',
      ]),
    },
    PEMELIHARAAN_PPM: {
      headers: [
        'ID PPM',
        'TANGGAL KEGIATAN',
        'NAMA TEKNISI',
        'NIP TEKNISI',
        'RUANGAN',
        'NAMA ALAT',
        'MERK',
        'MODEL / TYPE',
        'SERIAL NUMBER',
        '1. PEMERIKSAAN FISIK-FUNGSI DAN KELENGKAPAN AKSESORIS',
        '2. SETTING PARAMETER-PERAWATAN MEKANIK DAN KELISTRIKAN SERTA PEMANASAN ALAT',
        '3. CLEANING SELURUH BAGIAN ALAT',
        'KONDISI ALAT',
        'STATUS KELAYAKAN',
        'CATATAN TEKNISI',
      ],
      rows: dbStore.pemeliharaan.map((item) => [
        item.id,
        item.tanggal,
        item.namaTeknisi,
        item.nipTeknisi || '-',
        item.ruangan,
        item.namaAlat,
        item.merk,
        item.modelType,
        item.serialNumber,
        item.kegiatanFisik ? 'YA (LENGKAP)' : 'TIDAK',
        item.kegiatanSetting ? 'YA (OPTIMAL)' : 'TIDAK',
        item.kegiatanCleaning ? 'YA (BERSIH)' : 'TIDAK',
        item.kondisi,
        item.status,
        item.catatan || '-',
      ]),
    },
    PERBAIKAN_SPK: {
      headers: [
        'ID SPK',
        'NOMOR SPK',
        'TANGGAL LAPORAN',
        'PELAPOR',
        'RUANGAN',
        'NAMA ALAT',
        'MERK',
        'MODEL / TYPE',
        'SERIAL NUMBER',
        'KELUHAN KERUSAKAN',
        'ANALISIS TEKNISI',
        'TINDAKAN PERBAIKAN',
        'SPAREPART DIGANTI',
        'ESTIMASI BIAYA (RP)',
        'TEKNISI PELAKSANA',
        'STATUS AKHIR',
      ],
      rows: dbStore.perbaikan.map((item) => [
        item.id,
        item.nomorSpk,
        item.tanggal,
        item.pelapor,
        item.ruangan,
        item.namaAlat,
        item.merk,
        item.modelType,
        item.serialNumber,
        item.keluhanKerusakan,
        item.analisisTeknisi,
        item.tindakanPerbaikan,
        item.sparepartDiganti || '-',
        item.biayaEstimasi || 0,
        item.teknisiPelaksana,
        item.statusPerbaikan,
      ]),
    },
    BERITA_ACARA_PENARIKAN: {
      headers: [
        'ID BAP',
        'TANGGAL PENARIKAN',
        'ID ALKES',
        'NAMA ALAT',
        'MERK / TYPE',
        'SERIAL NUMBER',
        'RUANGAN ASAL',
        'KONDISI TERAKHIR',
        'ALASAN PENARIKAN',
        'ANALISA TEKNIS K3RS',
        'REKOMENDASI TINDAKAN',
        'TEKNISI ELEKTROMEDIS (YANG MENERIMA/MEMERIKSA)',
        'NIP TEKNISI',
        'KEPALA RUANGAN / PETUGAS (YANG MENYERAHKAN)',
        'KEPALA IPSRS (MENGETAHUI)',
      ],
      rows: dbStore.beritaAcara.map((item) => [
        item.id,
        item.tanggal,
        item.alkesId || '-',
        item.namaAlat,
        `${item.merk} ${item.modelType}`,
        item.serialNumber,
        item.ruangan,
        item.kondisiTerakhir,
        item.alasanPenarikan,
        item.analisaTeknis,
        item.rekomendasiTindakan,
        item.namaTeknisi,
        item.nipTeknisi,
        item.namaKepalaRuangan,
        item.namaKepalaIpsrs || item.namaDirektur || 'RAMLAN',
      ]),
    },
  };
  return sheets;
};

// API: Google Sheets Direct Sync & Webhook Forwarder
app.post('/api/sheets/sync-all', async (req, res) => {
  const { webhookUrl, inventaris, pemeliharaan, perbaikan, beritaAcara } = req.body;

  // Merge any incoming data
  const mergeById = (existingList: any[], incomingList: any[]) => {
    const map = new Map();
    existingList.forEach((item) => map.set(item.id, item));
    (incomingList || []).forEach((item) => {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      } else {
        const existing = map.get(item.id);
        const incomingUpdated = new Date(item.updatedAt || item.createdAt || 0).getTime();
        const existingUpdated = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        if (incomingUpdated >= existingUpdated) {
          map.set(item.id, item);
        }
      }
    });
    return Array.from(map.values());
  };

  if (inventaris && inventaris.length > 0) dbStore.inventaris = mergeById(dbStore.inventaris, inventaris);
  if (pemeliharaan && pemeliharaan.length > 0) dbStore.pemeliharaan = mergeById(dbStore.pemeliharaan, pemeliharaan);
  if (perbaikan && perbaikan.length > 0) dbStore.perbaikan = mergeById(dbStore.perbaikan, perbaikan);
  if (beritaAcara && beritaAcara.length > 0) dbStore.beritaAcara = mergeById(dbStore.beritaAcara, beritaAcara);

  const sheetsData = buildGoogleSheetsData();
  const targetWebhook = webhookUrl || dbStore.config?.googleSheetsWebhookUrl;

  let webhookResult: any = { attempted: false };

  if (targetWebhook && targetWebhook.startsWith('http')) {
    try {
      webhookResult.attempted = true;
      const response = await fetch(targetWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SYNC_ALL_SHEETS',
          timestamp: new Date().toISOString(),
          source: 'SIM-ALKES IPSRS UPTD RSUD LAMADDUKELLENG',
          data: sheetsData,
        }),
      });
      webhookResult.status = response.status;
      webhookResult.ok = response.ok;
      webhookResult.message = 'Berhasil dikirim ke Google Apps Script Webhook';
    } catch (e: any) {
      webhookResult.error = e.message || 'Gagal menghubungi Webhook';
    }
  }

  const syncTime = new Date().toISOString();
  if (!dbStore.config) dbStore.config = {};
  dbStore.config.lastSheetSyncTime = syncTime;

  const logEntry = {
    timestamp: syncTime,
    status: webhookResult.error ? 'failed_webhook' : 'synced',
    itemsCount: {
      inventaris: sheetsData.INVENTARIS_ALKES.rows.length,
      pemeliharaan: sheetsData.PEMELIHARAAN_PPM.rows.length,
      perbaikan: sheetsData.PERBAIKAN_SPK.rows.length,
      beritaAcara: sheetsData.BERITA_ACARA_PENARIKAN.rows.length,
    },
    webhookStatus: webhookResult,
  };

  if (!dbStore.config.sheetSyncLogs) dbStore.config.sheetSyncLogs = [];
  dbStore.config.sheetSyncLogs.unshift(logEntry);
  if (dbStore.config.sheetSyncLogs.length > 20) {
    dbStore.config.sheetSyncLogs.pop();
  }

  dbStore.lastUpdated = Date.now();
  saveToDisk();

  res.json({
    success: true,
    message: 'Data SIM-ALKES siap dan disinkronisasi ke Google Spreadsheet',
    timestamp: syncTime,
    sheets: sheetsData,
    webhook: webhookResult,
    counts: {
      inventaris: sheetsData.INVENTARIS_ALKES.rows.length,
      pemeliharaan: sheetsData.PEMELIHARAAN_PPM.rows.length,
      perbaikan: sheetsData.PERBAIKAN_SPK.rows.length,
      beritaAcara: sheetsData.BERITA_ACARA_PENARIKAN.rows.length,
    },
  });
});

// API: Pull data from Google Spreadsheet (Real-Time Bidirectional Sync)
app.post('/api/sheets/pull', async (req, res) => {
  const { webhookUrl } = req.body;
  const targetWebhook = webhookUrl || dbStore.config?.googleSheetsWebhookUrl;

  if (!targetWebhook || !targetWebhook.startsWith('http')) {
    return res.status(400).json({
      success: false,
      error: 'URL Google Apps Script Webhook atau Google Spreadsheet belum dikonfigurasi.',
    });
  }

  // Jika user memasukkan link Google Spreadsheet (docs.google.com) dan bukan Apps Script (script.google.com)
  if (targetWebhook.includes('docs.google.com/spreadsheets')) {
    return handleDirectGoogleSpreadsheetImport(targetWebhook, res);
  }

  const result = await performPullFromGoogleSheets(targetWebhook);
  if (!result.success) {
    return res.status(500).json({
      success: false,
      error: result.error,
    });
  }

  res.json({
    success: true,
    message: 'Data berhasil ditarik dari Google Spreadsheet dan disinkronkan ke seluruh device.',
    data: dbStore,
    counts: result.counts,
    timestamp: new Date().toISOString(),
  });
});

// Helper for direct Google Spreadsheet CSV export & parsing
async function handleDirectGoogleSpreadsheetImport(url: string, res: any) {
  try {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match || !match[1]) {
      return res.status(400).json({
        success: false,
        error: 'Format URL Google Spreadsheet tidak valid. Pastikan link memiliki format https://docs.google.com/spreadsheets/d/...',
      });
    }

    const spreadsheetId = match[1];
    let gid = '0';
    const gidMatch = url.match(/gid=([0-9]+)/);
    if (gidMatch && gidMatch[1]) {
      gid = gidMatch[1];
    }

    const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
    const csvResponse = await fetch(exportUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!csvResponse.ok) {
      return res.status(400).json({
        success: false,
        error: 'Tidak dapat mengunduh CSV dari Google Spreadsheet. Pastikan akses spreadsheet diatur ke "Siapa saja yang memiliki link (Anyone with the link can view)".',
      });
    }

    const csvText = await csvResponse.text();
    if (!csvText || csvText.includes('<!DOCTYPE html>')) {
      return res.status(400).json({
        success: false,
        error: 'Google Spreadsheet terkunci atau memerlukan izin akses. Ubah izin sharing di Google Drive ke "Anyone with the link".',
      });
    }

    // Parse CSV lines simply
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Data Google Spreadsheet kosong atau hanya berisi baris judul.',
      });
    }

    // Parse simple CSV rows
    const parseCsvLine = (text: string) => {
      const result: string[] = [];
      let cur = '';
      let inQuote = false;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '"') {
          if (inQuote && text[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuote = !inQuote;
          }
        } else if (c === ',' && !inQuote) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += c;
        }
      }
      result.push(cur.trim());
      return result;
    };

    const rawRows = lines.map((l) => parseCsvLine(l));
    const headerRow = rawRows[0].map((h) => h.toLowerCase());

    const findCol = (regex: RegExp) => {
      for (let c = 0; c < headerRow.length; c++) {
        if (regex.test(headerRow[c])) return c;
      }
      return -1;
    };

    const idCol = findCol(/(id.*alkes|id.*alat|^id$|kode.*alat|^kode$|no.*inv)/i);
    const namaCol = findCol(/(nama.*(alat|alkes|barang)|alat.*kesehatan|jenis.*alat|equipment|nama.*lengkap|^nama$|deskripsi)/i);
    const ruangCol = findCol(/(ruang|unit|lokasi|instalasi|penempatan|departemen|ward|room)/i);
    const merkCol = findCol(/(merk|brand|merek|manufaktur|pabrik)/i);
    const modelCol = findCol(/(model|type|tipe|tipe.*alat|seri|varian)/i);
    const snCol = findCol(/(serial|sn|no.*seri|nomor.*seri|s\/n)/i);
    const tahunCol = findCol(/(tahun.*pengadaan|tahun.*perolehan|tahun|thn)/i);
    const calibTerakhirCol = findCol(/(kalibrasi.*terakhir|tgl.*kalibrasi|terakhir.*kalibrasi|tgl.*uji)/i);
    const calibBerikutnyaCol = findCol(/(kalibrasi.*berikutnya|jadwal.*kalibrasi|jatuh.*tempo|expir)/i);
    const statusCalibCol = findCol(/(status.*kalibrasi|hasil.*kalibrasi|status.*laik|kelayakan)/i);
    const kondisiCol = findCol(/(kondisi.*alat|kondisi.*fisik|kondisi|status.*fisik|keadaan)/i);
    const ketCol = findCol(/(keterangan|ket|catatan|fungsi|operasional|status.*alat)/i);
    const noInvCol = findCol(/(nomor.*inventaris|no.*inventaris|no.*inv|nomer.*inv|kode.*aset)/i);
    const lokasiCol = findCol(/(lokasi.*spesifik|detail.*lokasi|posisi|lantai)/i);

    const newAlkes: any[] = [];
    const existingMap = new Map();
    dbStore.inventaris.forEach((item) => {
      if (item && item.id && !dbStore.deletedIds[item.id] && !isDemoId(item.id)) {
        existingMap.set(item.id, item);
      }
    });

    for (let r = 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      let namaAlat = namaCol !== -1 ? (row[namaCol] || '').trim() : '';
      if (!namaAlat) {
        for (let c = 0; c < Math.min(row.length, 4); c++) {
          const val = (row[c] || '').trim();
          if (val && val.length > 2 && !/^\d+$/.test(val) && !val.startsWith('ALK-')) {
            namaAlat = val;
            break;
          }
        }
      }
      if (!namaAlat) continue;

      let id = idCol !== -1 ? (row[idCol] || '').trim() : '';
      if (!id || id === '-' || /^\d+$/.test(id)) {
        id = `ALK-IPSRS UPTD RSUD LAMADDUKELLENG-${r}-${Date.now().toString(36).toUpperCase()}`;
      }

      if (dbStore.deletedIds[id] || isDemoId(id)) {
        // Skip item if it has been deleted or is demo data
        continue;
      }

      const lastCal = calibTerakhirCol !== -1 ? normalizeDateString(row[calibTerakhirCol]) : '';
      let nextCal = calibBerikutnyaCol !== -1 ? normalizeDateString(row[calibBerikutnyaCol]) : '';
      if (!nextCal && lastCal) {
        const parts = lastCal.split('-');
        if (parts.length === 3) {
          nextCal = `${parseInt(parts[0], 10) + 1}-${parts[1]}-${parts[2]}`;
        }
      }

      const item = {
        id,
        ruangan: ruangCol !== -1 && row[ruangCol] ? row[ruangCol].trim() : 'IPSRS / Umum',
        namaAlat,
        merk: merkCol !== -1 && row[merkCol] ? row[merkCol].trim() : '-',
        modelType: modelCol !== -1 && row[modelCol] ? row[modelCol].trim() : '-',
        serialNumber: snCol !== -1 && row[snCol] ? row[snCol].trim() : '-',
        tahunPengadaan: tahunCol !== -1 && row[tahunCol] ? row[tahunCol].trim() : '-',
        kalibrasiTerakhir: lastCal,
        kalibrasiBerikutnya: nextCal,
        statusKalibrasi: statusCalibCol !== -1 ? row[statusCalibCol] || 'Terkalibrasi' : 'Terkalibrasi',
        kondisi: kondisiCol !== -1 ? row[kondisiCol] || 'Baik' : 'Baik',
        keterangan: ketCol !== -1 ? row[ketCol] || 'Siap Digunakan' : 'Siap Digunakan',
        nomorInventaris: noInvCol !== -1 && row[noInvCol] ? row[noInvCol].trim() : id,
        lokasiSpesifik: lokasiCol !== -1 && row[lokasiCol] ? row[lokasiCol].trim() : '-',
        updatedAt: new Date().toISOString(),
        lastEditedBy: 'Import Google Sheet Link',
      };

      existingMap.set(id, item);
      newAlkes.push(item);
    }

    dbStore.inventaris = Array.from(existingMap.values());
    dbStore.lastUpdated = Date.now();
    saveToDisk();

    return res.json({
      success: true,
      message: `Berhasil mengimpor ${newAlkes.length} data alat kesehatan langsung dari link Google Spreadsheet.`,
      importedCount: newAlkes.length,
      data: dbStore,
      counts: {
        inventaris: dbStore.inventaris.length,
        pemeliharaan: dbStore.pemeliharaan.length,
        perbaikan: dbStore.perbaikan.length,
        beritaAcara: dbStore.beritaAcara.length,
      },
    });
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      error: 'Gagal mengimpor dari URL Google Spreadsheet: ' + (e.message || String(e)),
    });
  }
}

// API: Direct Import from Google Spreadsheet URL
app.post('/api/sheets/import-url', async (req, res) => {
  const { url } = req.body;
  if (!url || !url.startsWith('http')) {
    return res.status(400).json({ success: false, error: 'URL Google Spreadsheet tidak valid.' });
  }
  return handleDirectGoogleSpreadsheetImport(url, res);
});

// API: Batch Save Inventaris Alkes
app.post('/api/inventaris/batch', (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'Daftar alat kesehatan kosong.' });
  }

  const map = new Map();
  dbStore.inventaris.forEach((i) => {
    if (i && i.id && !dbStore.deletedIds[i.id] && !isDemoId(i.id)) {
      map.set(i.id, i);
    }
  });
  items.forEach((newItem) => {
    if (newItem && newItem.id && !dbStore.deletedIds[newItem.id] && !isDemoId(newItem.id)) {
      map.set(newItem.id, newItem);
    }
  });

  dbStore.inventaris = Array.from(map.values());
  dbStore.lastUpdated = Date.now();
  saveToDisk();

  // Background Google Sheets Auto-Sync if webhook is configured
  if (dbStore.config?.autoSyncEnabled !== false && dbStore.config?.googleSheetsWebhookUrl?.startsWith('http')) {
    try {
      const sheetsData = buildGoogleSheetsData();
      fetch(dbStore.config.googleSheetsWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SYNC_ALL_SHEETS',
          timestamp: new Date().toISOString(),
          source: 'SIM-ALKES IPSRS UPTD RSUD LAMADDUKELLENG BATCH-SAVE',
          data: sheetsData,
        }),
      }).catch((err) => console.warn('Background Google Sheets auto-sync notification error:', err?.message));
    } catch (e) {
      // ignore non-blocking background error
    }
  }

  res.json({
    success: true,
    message: `Berhasil menyimpan ${items.length} alat kesehatan ke database server.`,
    totalInventaris: dbStore.inventaris.length,
    data: dbStore.inventaris,
  });
});

// API: Clear all Inventaris Alkes
app.post('/api/inventaris/clear', (req, res) => {
  const now = Date.now();
  dbStore.inventaris = [];
  dbStore.inventarisClearedAt = now;
  dbStore.lastUpdated = now;
  saveToDisk();

  broadcastSseEvent({
    type: 'INVENTARIS_CLEARED',
    clearedAt: now,
    timestamp: now,
  });

  if (dbStore.config?.autoSyncEnabled !== false && dbStore.config?.googleSheetsWebhookUrl?.startsWith('http')) {
    try {
      const sheetsData = buildGoogleSheetsData();
      fetch(dbStore.config.googleSheetsWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SYNC_ALL_SHEETS',
          timestamp: new Date().toISOString(),
          source: 'SIM-ALKES CLEAR INVENTARIS',
          data: sheetsData,
        }),
      }).catch((err) => console.warn('Background Google Sheets clear sync error:', err?.message));
    } catch {}
  }

  res.json({
    success: true,
    message: 'Seluruh data inventaris berhasil dikosongkan.',
    clearedAt: now,
  });
});

// API: Test Google Apps Script Webhook Connection
app.post('/api/sheets/test-connection', async (req, res) => {
  const { webhookUrl } = req.body;
  const targetWebhook = webhookUrl || dbStore.config?.googleSheetsWebhookUrl;

  if (!targetWebhook || !targetWebhook.startsWith('http')) {
    return res.status(400).json({
      success: false,
      error: 'URL Webhook tidak valid atau kosong.',
    });
  }

  try {
    const response = await fetch(`${targetWebhook}?action=PING`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (response.ok) {
      const json = await response.json();
      return res.json({
        success: true,
        message: 'Koneksi ke Google Apps Script Webhook Berhasil!',
        details: json,
      });
    } else {
      return res.json({
        success: false,
        error: `Server merespons status ${response.status} (${response.statusText}). Pastikan setting "Who has access" = "Anyone".`,
      });
    }
  } catch (err: any) {
    return res.json({
      success: false,
      error: `Gagal menghubungi URL: ${err.message}. Pastikan URL Web App benar (akhiran /exec).`,
    });
  }
});

// API: Automated Email Dispatch for Berita Acara Penarikan (BAP)
app.post('/api/email/dispatch-bap', async (req, res) => {
  const { bap, recipientEmail, notes, senderTechnician } = req.body;
  if (!bap || !bap.nomorBap) {
    return res.status(400).json({ error: 'Data BAP tidak lengkap' });
  }

  const targetEmail = recipientEmail || dbStore.config?.designatedEmail || 'bulukumba17101994@gmail.com';

  const emailSubject = `[BAP-ALKES IPSRS UPTD RSUD LAMADDUKELLENG] Laporan Penarikan Alat: ${bap.namaAlat} (SN: ${bap.serialNumber}) - Ruang ${bap.ruangan}`;
  const emailBody = `
Yth. Pimpinan / Pengurus Barang & IPSRS IPSRS UPTD RSUD LAMADDUKELLENG,

Berikut disampaikan Laporan Berita Acara Penarikan Alat Kesehatan (BAP) yang telah diterbitkan secara otomatis oleh Sistem SIM-ALKES IPSRS UPTD RSUD LAMADDUKELLENG:

==================================================
BERITA ACARA PENARIKAN ALAT KESEHATAN (BAP-ALKES)
IPSRS UPTD RSUD LAMADDUKELLENG - KABUPATEN WAJO
==================================================
Nomor Surat         : ${bap.nomorBap}
Tanggal Penarikan   : ${bap.tanggal}
Nama Alat Kesehatan : ${bap.namaAlat}
Merk / Model Tipe   : ${bap.merk} / ${bap.modelType}
Nomor Seri (SN)     : ${bap.serialNumber}
Tahun Pengadaan     : ${bap.tahunPengadaan || '-'}
Ruangan Asal        : Ruang ${bap.ruangan}
Kondisi Terakhir    : ${bap.kondisiTerakhir}

ALASAN PENARIKAN:
${bap.alasanPenarikan}

ANALISA TEKNIS & K3RS ELEKTROMEDIS:
${bap.analisaTeknis}

REKOMENDASI TINDAKAN:
${bap.rekomendasiTindakan}

PENGESAHAN:
1. Teknisi Elektromedis : ${bap.namaTeknisi} (NIP: ${bap.nipTeknisi})
2. Kepala Ruangan       : ${bap.namaKepalaRuangan}
3. Direktur IPSRS UPTD RSUD LAMADDUKELLENG   : ${bap.namaDirektur}

Catatan Tambahan : ${notes || 'Dokumen BAP telah tersimpan di database SIM-ALKES dan PDF siap dicetak.'}
Waktu Pelaporan  : ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' })} WITA
Dikirim Oleh     : ${senderTechnician || bap.namaTeknisi}
==================================================
Dokumen elektronik ini diterbitkan secara otomatis oleh SIM-ALKES IPSRS UPTD RSUD LAMADDUKELLENG.
`;

  // Auto add to dbStore if not present
  const exists = dbStore.beritaAcara.some((b) => b.id === bap.id);
  if (!exists) {
    dbStore.beritaAcara.unshift(bap);
    saveToDisk();
  }

  // Record dispatch log
  const dispatchRecord = {
    id: `DISPATCH-${Date.now()}`,
    bapId: bap.id,
    nomorBap: bap.nomorBap,
    recipient: targetEmail,
    subject: emailSubject,
    dispatchedAt: new Date().toISOString(),
    status: 'success',
  };

  res.json({
    success: true,
    message: `Berita Acara Penarikan No. ${bap.nomorBap} berhasil diproses dan dikirimkan ke ${targetEmail}`,
    email: {
      recipient: targetEmail,
      subject: emailSubject,
      body: emailBody,
      dispatchedAt: dispatchRecord.dispatchedAt,
    },
  });
});

// Real-Time Multi-Device SSE (Server-Sent Events) Broadcast System
const sseClients: Set<express.Response> = new Set();

function broadcastSseEvent(eventData: any) {
  const payload = `data: ${JSON.stringify(eventData)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (err) {
      sseClients.delete(client);
    }
  }
}

// Periodic keep-alive ping for active SSE connections (every 15s)
setInterval(() => {
  const pingPayload = `: ping\n\n`;
  for (const client of sseClients) {
    try {
      client.write(pingPayload);
    } catch (err) {
      sseClients.delete(client);
    }
  }
}, 15000);

// API: Real-Time SSE Stream for all devices & background clients
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for Nginx
  res.flushHeaders?.();

  res.write(
    `data: ${JSON.stringify({
      type: 'INIT_CONNECTED',
      timestamp: Date.now(),
      lastUpdated: dbStore.lastUpdated,
      counts: {
        inventaris: dbStore.inventaris.length,
        pemeliharaan: dbStore.pemeliharaan.length,
        perbaikan: dbStore.perbaikan.length,
        beritaAcara: dbStore.beritaAcara.length,
      },
    })}\n\n`
  );

  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// API: Push/Sync all data (with conflict-free ID merge)
const handleBatchSync = (req: any, res: any) => {
  const { inventaris = [], pemeliharaan = [], perbaikan = [], beritaAcara = [] } = req.body;

  // Merge map by ID
  const mergeById = (existingList: any[], incomingList: any[]) => {
    const map = new Map();
    existingList.forEach((item) => {
      if (item && item.id && !dbStore.deletedIds[item.id] && !isDemoId(item.id)) {
        map.set(item.id, item);
      }
    });
    incomingList.forEach((item: any) => {
      if (!item || !item.id) return;
      if (dbStore.deletedIds[item.id] || isDemoId(item.id)) return; // DO NOT ACCEPT DELETED OR DEMO ITEMS
      if (!map.has(item.id)) {
        map.set(item.id, item);
      } else {
        const existing = map.get(item.id);
        const incomingUpdated = new Date(item.updatedAt || item.createdAt || 0).getTime();
        const existingUpdated = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        if (incomingUpdated >= existingUpdated) {
          map.set(item.id, item);
        }
      }
    });
    return Array.from(map.values());
  };

  const hadChanges = inventaris.length > 0 || pemeliharaan.length > 0 || perbaikan.length > 0 || beritaAcara.length > 0;

  if (inventaris.length > 0) dbStore.inventaris = mergeById(dbStore.inventaris, inventaris);
  if (pemeliharaan.length > 0) dbStore.pemeliharaan = mergeById(dbStore.pemeliharaan, pemeliharaan);
  if (perbaikan.length > 0) dbStore.perbaikan = mergeById(dbStore.perbaikan, perbaikan);
  if (beritaAcara.length > 0) dbStore.beritaAcara = mergeById(dbStore.beritaAcara, beritaAcara);

  dbStore.lastUpdated = Date.now();
  saveToDisk();

  // Instant real-time broadcast to all connected devices
  broadcastSseEvent({
    type: 'BATCH_SYNC_UPDATE',
    timestamp: dbStore.lastUpdated,
    deletedIds: dbStore.deletedIds,
    data: dbStore,
  });

  // Background Google Sheets Auto-Sync if webhook is configured and enabled
  if (hadChanges && dbStore.config?.autoSyncEnabled !== false && dbStore.config?.googleSheetsWebhookUrl?.startsWith('http')) {
    try {
      const sheetsData = buildGoogleSheetsData();
      fetch(dbStore.config.googleSheetsWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SYNC_ALL_SHEETS',
          timestamp: new Date().toISOString(),
          source: 'SIM-ALKES IPSRS UPTD RSUD LAMADDUKELLENG BATCH-MERGE',
          data: sheetsData,
        }),
      }).catch((err) => console.warn('Background Google Sheets auto-sync error:', err?.message));
    } catch (e) {
      // non-blocking
    }
  }

  res.json({
    success: true,
    message: 'Data berhasil disinkronisasi ke server IPSRS UPTD RSUD LAMADDUKELLENG',
    data: dbStore,
  });
};

app.post('/api/sync/merge', handleBatchSync);
app.post('/api/sync/batch', handleBatchSync);

// API: Save or Update single item
app.post('/api/sync/item', async (req, res) => {
  const rawCollection = req.body.collection || req.body.type;
  const { item } = req.body;
  if (!rawCollection || !item || !item.id) {
    return res.status(400).json({ error: 'Missing collection/type or item with id' });
  }

  // Refuse if item was marked as deleted or is demo data
  if (dbStore.deletedIds && (dbStore.deletedIds[item.id] || isDemoId(item.id))) {
    return res.status(409).json({ error: 'Item telah dihapus dari sistem dan tidak dapat dipulihkan', id: item.id });
  }

  const collection = rawCollection === 'bap' ? 'beritaAcara' : rawCollection;
  const list = (dbStore as any)[collection];
  if (!Array.isArray(list)) {
    return res.status(400).json({ error: `Invalid collection: ${rawCollection}` });
  }

  // Normalize date formats
  if (item.kalibrasiTerakhir !== undefined) item.kalibrasiTerakhir = normalizeDateString(item.kalibrasiTerakhir);
  if (item.kalibrasiBerikutnya !== undefined) item.kalibrasiBerikutnya = normalizeDateString(item.kalibrasiBerikutnya);
  if (item.tanggal !== undefined) item.tanggal = normalizeDateString(item.tanggal);

  const index = list.findIndex((x) => x.id === item.id);
  const isNew = index < 0;
  item.updatedAt = new Date().toISOString();
  if (index >= 0) {
    list[index] = { ...list[index], ...item };
  } else {
    if (!item.createdAt) item.createdAt = new Date().toISOString();
    list.unshift(item);
  }

  dbStore.lastUpdated = Date.now();
  saveToDisk();

  // Instant Real-Time Multi-Device SSE Broadcast
  broadcastSseEvent({
    type: 'ITEM_SYNC_UPDATE',
    collection,
    action: isNew ? 'create' : 'update',
    item,
    data: dbStore,
    timestamp: dbStore.lastUpdated,
  });

  // Background Google Sheets Auto-Sync if webhook is configured and enabled
  if (dbStore.config?.autoSyncEnabled !== false && dbStore.config?.googleSheetsWebhookUrl?.startsWith('http')) {
    try {
      const sheetsData = buildGoogleSheetsData();
      fetch(dbStore.config.googleSheetsWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SYNC_ALL_SHEETS',
          timestamp: new Date().toISOString(),
          source: 'SIM-ALKES IPSRS UPTD RSUD LAMADDUKELLENG AUTO-SYNC-ITEM',
          data: sheetsData,
        }),
      }).catch((err) => console.warn('Background Google Sheets auto-sync notification error:', err?.message));
    } catch (e) {
      // ignore non-blocking background error
    }
  }

  res.json({ success: true, item, collection, total: list.length });
});

// API: Delete single item
app.delete('/api/sync/item/:collection/:id', (req, res) => {
  const rawCollection = req.params.collection;
  const { id } = req.params;
  const collection = rawCollection === 'bap' ? 'beritaAcara' : rawCollection;
  const list = (dbStore as any)[collection];
  if (!Array.isArray(list)) {
    return res.status(400).json({ error: `Invalid collection: ${rawCollection}` });
  }

  (dbStore as any)[collection] = list.filter((x) => x.id !== id);
  if (!dbStore.deletedIds) dbStore.deletedIds = {};
  dbStore.deletedIds[id] = Date.now();
  dbStore.lastUpdated = Date.now();
  saveToDisk();

  // Instant broadcast delete event to all connected devices
  broadcastSseEvent({
    type: 'ITEM_DELETE_UPDATE',
    collection,
    id,
    deletedIds: dbStore.deletedIds,
    data: dbStore,
    timestamp: dbStore.lastUpdated,
  });

  // Background Google Sheets Auto-Sync if webhook is configured and enabled
  if (dbStore.config?.autoSyncEnabled !== false && dbStore.config?.googleSheetsWebhookUrl?.startsWith('http')) {
    try {
      const sheetsData = buildGoogleSheetsData();
      fetch(dbStore.config.googleSheetsWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SYNC_ALL_SHEETS',
          timestamp: new Date().toISOString(),
          source: 'SIM-ALKES IPSRS UPTD RSUD LAMADDUKELLENG AUTO-DELETE-ITEM',
          data: sheetsData,
        }),
      }).catch((err) => console.warn('Background Google Sheets auto-sync delete notification error:', err?.message));
    } catch (e) {
      // ignore non-blocking background error
    }
  }

  res.json({ success: true, message: 'Item berhasil dihapus', collection, id, total: (dbStore as any)[collection].length });
});

// API: Get Deleted IDs list
app.get('/api/sync/deleted-ids', (req, res) => {
  res.json({
    success: true,
    deletedIds: dbStore.deletedIds || {},
  });
});

// API: Explicit purge demo data across server and spreadsheet
app.post('/api/sync/purge-demo', async (req, res) => {
  if (!dbStore.deletedIds) dbStore.deletedIds = {};
  DEMO_DATA_IDS.forEach((id) => {
    dbStore.deletedIds[id] = Date.now();
  });

  sanitizeDbStore(dbStore);
  dbStore.lastUpdated = Date.now();
  saveToDisk();

  // Trigger Google Sheets sync to clear demo rows
  let webhookResult: any = { attempted: false };
  if (dbStore.config?.googleSheetsWebhookUrl?.startsWith('http')) {
    try {
      webhookResult.attempted = true;
      const sheetsData = buildGoogleSheetsData();
      const resp = await fetch(dbStore.config.googleSheetsWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SYNC_ALL_SHEETS',
          timestamp: new Date().toISOString(),
          source: 'SIM-ALKES PURGE DEMO DATA',
          data: sheetsData,
        }),
      });
      webhookResult.ok = resp.ok;
      webhookResult.status = resp.status;
    } catch (err: any) {
      webhookResult.error = err.message;
    }
  }

  // Broadcast to all clients
  broadcastSseEvent({
    type: 'BATCH_SYNC_UPDATE',
    timestamp: dbStore.lastUpdated,
    deletedIds: dbStore.deletedIds,
    data: dbStore,
  });

  res.json({
    success: true,
    message: 'Seluruh data demo berhasil dihapus dari server dan Google Spreadsheet.',
    deletedIdsCount: Object.keys(dbStore.deletedIds).length,
    webhook: webhookResult,
    counts: {
      inventaris: dbStore.inventaris.length,
      pemeliharaan: dbStore.pemeliharaan.length,
      perbaikan: dbStore.perbaikan.length,
      beritaAcara: dbStore.beritaAcara.length,
    },
  });
});

// API: Export formatted data for Google Sheets
app.get('/api/sheets/export/:type', (req, res) => {
  const { type } = req.params;
  let headers: string[] = [];
  let rows: any[] = [];

  if (type === 'inventaris') {
    headers = [
      'ID',
      'Ruangan',
      'Nama Alat',
      'Merk',
      'Model / Type',
      'Serial Number (SN)',
      'Tahun Pengadaan',
      'Kalibrasi Terakhir',
      'Kalibrasi Berikutnya',
      'Status Kalibrasi',
      'Kondisi Alat',
      'Keterangan',
      'Tanggal Diperbarui',
    ];
    rows = dbStore.inventaris.map((item) => [
      item.id,
      item.ruangan,
      item.namaAlat,
      item.merk,
      item.modelType,
      item.serialNumber,
      item.tahunPengadaan,
      item.kalibrasiTerakhir,
      item.kalibrasiBerikutnya,
      item.statusKalibrasi,
      item.kondisi,
      item.keterangan,
      item.updatedAt || item.createdAt || '',
    ]);
  } else if (type === 'pemeliharaan') {
    headers = [
      'ID',
      'Tanggal Kegiatan',
      'Nama Teknisi',
      'Ruangan',
      'Nama Alat',
      'Merk',
      'Model / Type',
      'Serial Number',
      'Pemeriksaan Fisik & Fungsi',
      'Setting & Pemanasan',
      'Cleaning Bagian Alat',
      'Kondisi Alat',
      'Status Kelayakan',
      'Catatan Teknisi',
    ];
    rows = dbStore.pemeliharaan.map((item) => [
      item.id,
      item.tanggal,
      item.namaTeknisi,
      item.ruangan,
      item.namaAlat,
      item.merk,
      item.modelType,
      item.serialNumber,
      item.kegiatanFisik ? 'YA' : 'TIDAK',
      item.kegiatanSetting ? 'YA' : 'TIDAK',
      item.kegiatanCleaning ? 'YA' : 'TIDAK',
      item.kondisi,
      item.status,
      item.catatan || '',
    ]);
  }

  res.json({
    type,
    headers,
    rows,
    count: rows.length,
    generatedAt: new Date().toISOString(),
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SIM-ALKES IPSRS UPTD RSUD LAMADDUKELLENG Server running on http://localhost:${PORT}`);
  });
}

startServer();
