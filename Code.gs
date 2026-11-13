/**
 * ====================================================================================
 * SISTEM INFORMASI MANAJEMEN ALAT KESEHATAN (SIM-ALKES)
 * IPSRS UPTD RSUD LAMADDUKELLENG - KABUPATEN WAJO
 * ====================================================================================
 * FILE: Code.gs (Google Apps Script)
 * VERSI: 3.0 (Multi-Device Real-Time Sync & Anti-Collision Concurrency Lock)
 * 
 * FITUR UTAMA:
 * 1. SIMPAN & UPDATE DATA (doPost): Mendukung simpan 1 item (upsert) maupun batch sync.
 * 2. TARIK DATA REAL-TIME (doGet / doPost action 'GET_ALL'): Mengambil seluruh data
 *    alkes, pemeliharaan PPM, perbaikan SPK, dan BAP untuk disinkronkan ke semua HP/Laptop.
 * 3. ANTI-BENTROK KONKURENSI (LockService): Mencegah data tertimpa atau hilang ketika
 *    banyak teknisi/ruangan menginput data di detik yang sama secara bersamaan.
 * 4. OTOMATISASI SHEET & HEADER: Otomatis membuat 4 tab sheet dengan styling resmi IPSRS UPTD RSUD LAMADDUKELLENG.
 * 
 * ====================================================================================
 * PETUNJUK PEMASANGAN (HANYA 3 MENIT):
 * 1. Buka Google Spreadsheet baru di Google Drive Anda (atau kunjungi https://sheets.new).
 * 2. Klik menu: Ekstensi (Extensions) > Apps Script.
 * 3. Hapus semua kode bawaan, lalu Salin & Tempel (Paste) seluruh isi file ini.
 * 4. Klik tombol "Simpan" (ikon disket / Ctrl+S).
 * 5. Klik tombol "Terapkan" (Deploy) di kanan atas > "Deployment baru" (New deployment).
 * 6. Pilih jenis: "Aplikasi Web" (Web app).
 * 7. Konfigurasi Deployment:
 *    - Deskripsi       : SIM-ALKES IPSRS UPTD RSUD LAMADDUKELLENG Real-Time Sync
 *    - Jalankan sebagai: "Saya" (Me / email Anda)
 *    - Yang memiliki akses: "Siapa saja" (Anyone) -> PENTING agar semua device bisa akses
 * 8. Klik "Terapkan" (Deploy) dan berikan izin otorisasi Google jika diminta.
 * 9. Salin "URL Aplikasi Web" (akhiran /exec) dan tempelkan ke aplikasi SIM-ALKES IPSRS UPTD RSUD LAMADDUKELLENG.
 * ====================================================================================
 */

// Konfigurasi Nama Tab Sheet Resmi
var SHEET_NAMES = {
  INVENTARIS: "INVENTARIS_ALKES",
  PEMELIHARAAN: "PEMELIHARAAN_PPM",
  PERBAIKAN: "PERBAIKAN_SPK",
  BERITA_ACARA: "BERITA_ACARA_PENARIKAN",
  LOGS: "SYNC_LOGS"
};

// Konfigurasi Header Kolom
var HEADERS_CONFIG = {
  INVENTARIS_ALKES: [
    "ID ALKES", "RUANGAN", "NAMA ALAT KESEHATAN", "MERK", "MODEL / TYPE", 
    "SERIAL NUMBER (SN)", "TAHUN PENGADAAN", "KALIBRASI TERAKHIR", "KALIBRASI BERIKUTNYA", 
    "STATUS KALIBRASI", "KONDISI ALAT", "KETERANGAN", "NOMOR INVENTARIS", 
    "LOKASI SPESIFIK", "TERAKHIR DIUBAH", "PETUGAS ELEKTROMEDIS"
  ],
  PEMELIHARAAN_PPM: [
    "ID PPM", "TANGGAL KEGIATAN", "NAMA TEKNISI", "NIP TEKNISI", "RUANGAN", 
    "NAMA ALAT", "MERK", "MODEL / TYPE", "SERIAL NUMBER", 
    "1. PEMERIKSAAN FISIK-FUNGSI", "2. SETTING & PEMANASAN", "3. CLEANING", 
    "KONDISI ALAT", "STATUS KELAYAKAN", "CATATAN TEKNISI", "TIMESTAMP"
  ],
  PERBAIKAN_SPK: [
    "ID SPK", "NOMOR SPK", "TANGGAL LAPORAN", "PELAPOR", "RUANGAN", 
    "NAMA ALAT", "MERK", "MODEL / TYPE", "SERIAL NUMBER", "KELUHAN KERUSAKAN", 
    "ANALISIS TEKNISI", "TINDAKAN PERBAIKAN", "SPAREPART DIGANTI", "ESTIMASI BIAYA (RP)", 
    "TEKNISI PELAKSANA", "STATUS AKHIR", "TIMESTAMP"
  ],
  BERITA_ACARA_PENARIKAN: [
    "ID BAP", "TANGGAL PENARIKAN", "ID ALKES", "NAMA ALAT", "MERK / TYPE", 
    "SERIAL NUMBER", "RUANGAN ASAL", "KONDISI TERAKHIR", "ALASAN PENARIKAN", 
    "ANALISA TEKNIS K3RS", "REKOMENDASI TINDAKAN", "TEKNISI ELEKTROMEDIS (YANG MENERIMA)", 
    "NIP TEKNISI", "KEPALA RUANGAN (YANG MENYERAHKAN)", "KEPALA IPSRS (MENGETAHUI)", 
    "NIP KEPALA IPSRS", "TIMESTAMP"
  ]
};

// Warna Khas Merah Marun IPSRS UPTD RSUD LAMADDUKELLENG
var THEME_COLOR = {
  HEADER_BG: "#881337",   // Rose 900 / Maroon IPSRS UPTD RSUD LAMADDUKELLENG
  HEADER_FONT: "#FFFFFF",
  ZEBRA_BG: "#FFF1F2"     // Soft light rose
};

/**
 * ====================================================================================
 * 1. HANDLER doGet: TARIK DATA (PULL DATA) UNTUK SEMUA DEVICE SECARA REAL-TIME
 * ====================================================================================
 */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "GET_ALL";
  
  if (action === "PING" || action === "HEALTH") {
    return createJsonResponse({
      status: "success",
      message: "SIM-ALKES Google Apps Script Service IPSRS UPTD RSUD LAMADDUKELLENG Aktif & Siap Sinkronisasi.",
      timestamp: new Date().toISOString(),
      version: "3.0"
    });
  }

  // Tarik seluruh data dari 4 Sheet secara real-time
  return handleGetAllData();
}

/**
 * ====================================================================================
 * 2. HANDLER doPost: SIMPAN, UPDATE, & SINKRONISASI DATA DENGAN LOCK ANTI-BENTROK
 * ====================================================================================
 */
function doPost(e) {
  // SANGAT PENTING: Kunci Script (LockService) agar input di detik bersamaan tidak saling tabrakan
  var lock = LockService.getScriptLock();
  var hasLock = false;

  try {
    // Tunggu giliran lock hingga 30 detik (mencegah bentrok input bersamaan)
    hasLock = lock.tryLock(30000);
    if (!hasLock) {
      return createJsonResponse({
        status: "error",
        error: "Server sedang memproses transaksi input lain. Silakan coba 1 detik lagi.",
        code: "LOCK_TIMEOUT"
      });
    }

    var contents = e.postData ? e.postData.contents : "{}";
    var payload = JSON.parse(contents);
    var action = payload.action || "SYNC_ALL_SHEETS";

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // ----------------------------------------------------
    // Action A: TARIK DATA LENGKAP VIA POST (Alternatif doGet)
    // ----------------------------------------------------
    if (action === "GET_ALL" || action === "PULL_ALL_DATA") {
      return handleGetAllData();
    }

    // ----------------------------------------------------
    // Action B: UPSERT SATUAN (Simpan/Edit 1 Item Alkes/PPM/SPK/BAP)
    // ----------------------------------------------------
    if (action === "UPSERT_ITEM") {
      var sheetName = payload.sheetName;
      var rowItem = payload.item;
      var idColIndex = payload.idIndex || 0; // Kolom ke-0 adalah ID

      if (!sheetName || !rowItem) {
        throw new Error("Parameter sheetName dan item wajib disertakan.");
      }

      var sheet = getOrCreateSheet(ss, sheetName);
      var result = upsertRowById(sheet, rowItem, idColIndex);

      logSyncActivity(ss, "UPSERT_ITEM", "Sheet " + sheetName + " | ID: " + rowItem[idColIndex]);

      return createJsonResponse({
        status: "success",
        message: "Data item berhasil disimpan & diperbarui tanpa bentrok.",
        action: "UPSERT_ITEM",
        sheetName: sheetName,
        rowUpdated: result.rowIndex,
        isNew: result.isNew,
        timestamp: new Date().toISOString()
      });
    }

    // ----------------------------------------------------
    // Action C: FULL SYNC 4 SHEETS (Sinkronisasi Massal)
    // ----------------------------------------------------
    var sheetsData = payload.data || {};
    var summary = {};

    for (var sName in sheetsData) {
      var item = sheetsData[sName];
      var targetSheet = getOrCreateSheet(ss, sName);

      // Tulis / Perbarui Header
      if (item.headers && item.headers.length > 0) {
        setupSheetHeader(targetSheet, item.headers);
      }

      // Bersihkan dan perbarui isi baris data
      if (item.rows) {
        // Hapus baris data lama (mulai baris 2)
        var lastRow = targetSheet.getLastRow();
        if (lastRow > 1) {
          targetSheet.getRange(2, 1, lastRow - 1, targetSheet.getLastColumn()).clearContent();
        }

        // Tulis baris baru
        if (item.rows.length > 0) {
          var numCols = item.headers ? item.headers.length : item.rows[0].length;
          var dataRange = targetSheet.getRange(2, 1, item.rows.length, numCols);
          dataRange.setValues(item.rows);

          // Zebra styling halus
          applyZebraFormatting(targetSheet, 2, item.rows.length, numCols);
        }

        summary[sName] = item.rows.length;
      }
    }

    logSyncActivity(ss, "SYNC_ALL_SHEETS", JSON.stringify(summary));

    return createJsonResponse({
      status: "success",
      message: "Data SIM-ALKES IPSRS UPTD RSUD LAMADDUKELLENG berhasil disinkronkan ke seluruh Google Sheet secara real-time.",
      counts: summary,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    return createJsonResponse({
      status: "error",
      error: err.toString(),
      timestamp: new Date().toISOString()
    });
  } finally {
    // Lepas kunci agar proses antrean selanjutnya dapat berjalan
    if (hasLock) {
      lock.releaseLock();
    }
  }
}

/**
 * ====================================================================================
 * 3. FUNGSI EKSTRAKSI SELURUH DATA SPREADSHEET (REAL-TIME PULL)
 * ====================================================================================
 */
function findSheetFlexible(ss, primaryName, keywords) {
  var sheet = ss.getSheetByName(primaryName);
  if (sheet) return sheet;

  var sheets = ss.getSheets();
  if (!sheets || sheets.length === 0) return null;

  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName().toLowerCase();
    for (var k = 0; k < keywords.length; k++) {
      if (name.indexOf(keywords[k].toLowerCase()) >= 0) {
        return sheets[i];
      }
    }
  }

  // Jika mencari inventaris dan hanya ada 1 sheet (seperti Sheet1), gunakan sheet pertama
  if (primaryName === SHEET_NAMES.INVENTARIS && sheets.length === 1) {
    return sheets[0];
  }

  return null;
}

function handleGetAllData() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    var inventarisSheet = findSheetFlexible(ss, SHEET_NAMES.INVENTARIS, ["inventaris", "alkes", "alat", "medis", "sheet1", "data"]);
    var pemeliharaanSheet = findSheetFlexible(ss, SHEET_NAMES.PEMELIHARAAN, ["pemeliharaan", "ppm", "maintenance"]);
    var perbaikanSheet = findSheetFlexible(ss, SHEET_NAMES.PERBAIKAN, ["perbaikan", "spk", "repair", "service"]);
    var bapSheet = findSheetFlexible(ss, SHEET_NAMES.BERITA_ACARA, ["berita", "bap", "penarikan", "afkir"]);

    var data = {
      inventaris: inventarisSheet ? sheetToObjects(inventarisSheet, "inventaris") : [],
      pemeliharaan: pemeliharaanSheet ? sheetToObjects(pemeliharaanSheet, "pemeliharaan") : [],
      perbaikan: perbaikanSheet ? sheetToObjects(perbaikanSheet, "perbaikan") : [],
      beritaAcara: bapSheet ? sheetToObjects(bapSheet, "beritaAcara") : [],
      serverTime: new Date().toISOString(),
      system: "SIM-ALKES IPSRS UPTD RSUD LAMADDUKELLENG"
    };

    return createJsonResponse({
      status: "success",
      message: "Data berhasil ditarik dari Google Spreadsheet.",
      data: data,
      counts: {
        inventaris: data.inventaris.length,
        pemeliharaan: data.pemeliharaan.length,
        perbaikan: data.perbaikan.length,
        beritaAcara: data.beritaAcara.length
      }
    });

  } catch (err) {
    return createJsonResponse({
      status: "error",
      error: "Gagal menarik data dari sheet: " + err.toString()
    });
  }
}

/**
 * Konversi Baris Sheet ke Object TypeScript yang cerdas dan fleksibel
 */
function sheetToObjects(sheet, type) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  var headersRange = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var headers = headersRange.map(function(h) { return String(h || "").toLowerCase().trim(); });

  var findColIndex = function(regex) {
    for (var c = 0; c < headers.length; c++) {
      if (regex.test(headers[c])) return c;
    }
    return -1;
  };

  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var results = [];

  if (type === "inventaris") {
    var idCol = findColIndex(/(id.*alkes|id.*alat|^id$|kode.*alat|^kode$|no.*inv)/i);
    var namaCol = findColIndex(/(nama.*(alat|alkes|barang)|alat.*kesehatan|jenis.*alat|equipment|nama.*lengkap|^nama$|deskripsi)/i);
    var ruangCol = findColIndex(/(ruang|unit|lokasi|instalasi|penempatan|departemen|ward|room)/i);
    var merkCol = findColIndex(/(merk|brand|merek|manufaktur|pabrik)/i);
    var modelCol = findColIndex(/(model|type|tipe|tipe.*alat|seri|varian)/i);
    var snCol = findColIndex(/(serial|sn|no.*seri|nomor.*seri|s\/n)/i);
    var tahunCol = findColIndex(/(tahun.*pengadaan|tahun.*perolehan|tahun|thn)/i);
    var calibTerakhirCol = findColIndex(/(kalibrasi.*terakhir|tgl.*kalibrasi|terakhir.*kalibrasi|tgl.*uji)/i);
    var calibBerikutnyaCol = findColIndex(/(kalibrasi.*berikutnya|jadwal.*kalibrasi|jatuh.*tempo|expir)/i);
    var statusCalibCol = findColIndex(/(status.*kalibrasi|hasil.*kalibrasi|status.*laik|kelayakan)/i);
    var kondisiCol = findColIndex(/(kondisi.*alat|kondisi.*fisik|kondisi|status.*fisik|keadaan)/i);
    var ketCol = findColIndex(/(keterangan|ket|catatan|fungsi|operasional|status.*alat)/i);
    var noInvCol = findColIndex(/(nomor.*inventaris|no.*inventaris|no.*inv|nomer.*inv|kode.*aset)/i);
    var lokasiCol = findColIndex(/(lokasi.*spesifik|detail.*lokasi|posisi|lantai)/i);

    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      var namaAlat = namaCol !== -1 ? String(row[namaCol] || "").trim() : "";
      
      // Fallback jika namaAlat tidak terdeteksi kolomnya
      if (!namaAlat) {
        for (var c = 0; c < Math.min(row.length, 4); c++) {
          var val = String(row[c] || "").trim();
          if (val && val.length > 2 && !/^\d+$/.test(val) && val.indexOf("ALK-") !== 0) {
            namaAlat = val;
            break;
          }
        }
      }

      if (!namaAlat) continue;

      var id = idCol !== -1 ? String(row[idCol] || "").trim() : "";
      if (!id || id === "-" || /^\d+$/.test(id)) {
        id = "ALK-IPSRS UPTD RSUD LAMADDUKELLENG-" + (i + 1);
      }

      results.push({
        id: id,
        ruangan: ruangCol !== -1 && row[ruangCol] ? String(row[ruangCol]).trim() : "IPSRS / Umum",
        namaAlat: namaAlat,
        merk: merkCol !== -1 && row[merkCol] ? String(row[merkCol]).trim() : "-",
        modelType: modelCol !== -1 && row[modelCol] ? String(row[modelCol]).trim() : "-",
        serialNumber: snCol !== -1 && row[snCol] ? String(row[snCol]).trim() : "-",
        tahunPengadaan: tahunCol !== -1 && row[tahunCol] ? String(row[tahunCol]).trim() : "-",
        kalibrasiTerakhir: calibTerakhirCol !== -1 ? formatDateValue(row[calibTerakhirCol]) : "",
        kalibrasiBerikutnya: calibBerikutnyaCol !== -1 ? formatDateValue(row[calibBerikutnyaCol]) : "",
        statusKalibrasi: statusCalibCol !== -1 ? String(row[statusCalibCol] || "Terkalibrasi") : "Terkalibrasi",
        kondisi: kondisiCol !== -1 ? String(row[kondisiCol] || "Baik") : "Baik",
        keterangan: ketCol !== -1 ? String(row[ketCol] || "Siap Digunakan") : "Siap Digunakan",
        nomorInventaris: noInvCol !== -1 && row[noInvCol] ? String(row[noInvCol]).trim() : id,
        lokasiSpesifik: lokasiCol !== -1 && row[lokasiCol] ? String(row[lokasiCol]).trim() : "-",
        updatedAt: new Date().toISOString(),
        lastEditedBy: "Google Sheets Sync v3.5"
      });
    }
  } else if (type === "pemeliharaan") {
    for (var p = 0; p < values.length; p++) {
      var rPpm = values[p];
      var idPpm = String(rPpm[0] || "").trim();
      if (!idPpm) idPpm = "PPM-" + (p + 1);

      results.push({
        id: idPpm,
        tanggal: formatDateValue(rPpm[1]),
        namaTeknisi: String(rPpm[2] || "Teknisi Elektromedis"),
        nipTeknisi: String(rPpm[3] || "-"),
        ruangan: String(rPpm[4] || "IPSRS"),
        namaAlat: String(rPpm[5] || ""),
        merk: String(rPpm[6] || "-"),
        modelType: String(rPpm[7] || "-"),
        serialNumber: String(rPpm[8] || "-"),
        kegiatanFisik: String(rPpm[9]).toUpperCase().indexOf("YA") >= 0 || rPpm[9] === true,
        kegiatanSetting: String(rPpm[10]).toUpperCase().indexOf("YA") >= 0 || rPpm[10] === true,
        kegiatanCleaning: String(rPpm[11]).toUpperCase().indexOf("YA") >= 0 || rPpm[11] === true,
        kondisi: String(rPpm[12] || "Baik"),
        status: String(rPpm[13] || "Layak Pakai"),
        catatan: String(rPpm[14] || "-")
      });
    }
  } else if (type === "perbaikan") {
    for (var k = 0; k < values.length; k++) {
      var rSpk = values[k];
      var idSpk = String(rSpk[0] || "").trim();
      if (!idSpk) idSpk = "SPK-" + (k + 1);

      results.push({
        id: idSpk,
        nomorSpk: String(rSpk[1] || idSpk),
        tanggal: formatDateValue(rSpk[2]),
        pelapor: String(rSpk[3] || "Petugas Ruangan"),
        ruangan: String(rSpk[4] || "IPSRS"),
        namaAlat: String(rSpk[5] || ""),
        merk: String(rSpk[6] || "-"),
        modelType: String(rSpk[7] || "-"),
        serialNumber: String(rSpk[8] || "-"),
        keluhanKerusakan: String(rSpk[9] || "-"),
        analisisTeknisi: String(rSpk[10] || "-"),
        tindakanPerbaikan: String(rSpk[11] || "-"),
        sparepartDiganti: String(rSpk[12] || "-"),
        biayaEstimasi: Number(rSpk[13]) || 0,
        teknisiPelaksana: String(rSpk[14] || "Teknisi Elektromedis"),
        statusPerbaikan: String(rSpk[15] || "Selesai")
      });
    }
  } else if (type === "beritaAcara") {
    for (var b = 0; b < values.length; b++) {
      var rBap = values[b];
      var idBap = String(rBap[0] || "").trim();
      if (!idBap) idBap = "BAP-" + (b + 1);

      results.push({
        id: idBap,
        tanggal: formatDateValue(rBap[1]),
        alkesId: String(rBap[2] || "-"),
        namaAlat: String(rBap[3] || ""),
        merk: String(rBap[4] || "-"),
        modelType: "",
        serialNumber: String(rBap[5] || "-"),
        ruangan: String(rBap[6] || "-"),
        kondisiTerakhir: String(rBap[7] || "Rusak Berat / Afkir"),
        alasanPenarikan: String(rBap[8] || "-"),
        analisaTeknis: String(rBap[9] || "-"),
        rekomendasiTindakan: String(rBap[10] || "-"),
        namaTeknisi: String(rBap[11] || "Teknisi Elektromedis"),
        nipTeknisi: String(rBap[12] || "-"),
        namaKepalaRuangan: String(rBap[13] || "-"),
        namaKepalaIpsrs: String(rBap[14] || "Ramlan, A.Md.TEM"),
        statusBap: "Final Disetujui"
      });
    }
  }

  return results;
}
        alkesId: String(row[2] || ""),
        namaAlat: String(row[3] || ""),
        merk: String(row[4] || ""),
        modelType: "",
        serialNumber: String(row[5] || ""),
        ruangan: String(row[6] || ""),
        kondisiTerakhir: String(row[7] || "Rusak Berat / Afkir"),
        alasanPenarikan: String(row[8] || ""),
        analisaTeknis: String(row[9] || ""),
        rekomendasiTindakan: String(row[10] || ""),
        namaTeknisi: String(row[11] || ""),
        nipTeknisi: String(row[12] || ""),
        namaKepalaRuangan: String(row[13] || ""),
        nipKepalaRuangan: "",
        namaKepalaIpsrs: String(row[14] || "Ramlan, A.Md.TEM"),
        nipKepalaIpsrs: String(row[15] || "198605102010011005")
      });
    }
  }

  return results;
}

/**
 * ====================================================================================
 * 4. HELPER UPSERT: MENCEGAH DUPLIKASI DATA & BENTROK ROW
 * ====================================================================================
 */
function upsertRowById(sheet, rowValues, idColIndex) {
  var targetId = String(rowValues[idColIndex]).trim();
  var lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    var idRange = sheet.getRange(2, idColIndex + 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < idRange.length; i++) {
      if (String(idRange[i][0]).trim() === targetId) {
        var existingRow = i + 2;
        sheet.getRange(existingRow, 1, 1, rowValues.length).setValues([rowValues]);
        return { rowIndex: existingRow, isNew: false };
      }
    }
  }

  // Jika ID belum ada, tambahkan sebagai baris baru
  var newRow = lastRow + 1;
  sheet.getRange(newRow, 1, 1, rowValues.length).setValues([rowValues]);
  return { rowIndex: newRow, isNew: true };
}

/**
 * ====================================================================================
 * 5. HELPER FORMATTING & STYLING SPREADSHEET
 * ====================================================================================
 */
function getOrCreateSheet(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}

function setupSheetHeader(sheet, headers) {
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setBackground(THEME_COLOR.HEADER_BG);
  headerRange.setFontColor(THEME_COLOR.HEADER_FONT);
  headerRange.setFontWeight("bold");
  headerRange.setHorizontalAlignment("center");
  headerRange.setVerticalAlignment("middle");
  sheet.setRowHeight(1, 35);
  sheet.setFrozenRows(1);
}

function applyZebraFormatting(sheet, startRow, numRows, numCols) {
  if (numRows <= 0 || numCols <= 0) return;
  for (var r = 0; r < numRows; r++) {
    var rowNum = startRow + r;
    var range = sheet.getRange(rowNum, 1, 1, numCols);
    if (r % 2 === 1) {
      range.setBackground(THEME_COLOR.ZEBRA_BG);
    } else {
      range.setBackground("#FFFFFF");
    }
    sheet.setRowHeight(rowNum, 26);
  }
  sheet.autoResizeColumns(1, numCols);
}

function logSyncActivity(ss, action, detail) {
  try {
    var logSheet = ss.getSheetByName(SHEET_NAMES.LOGS);
    if (!logSheet) {
      logSheet = ss.insertSheet(SHEET_NAMES.LOGS);
      logSheet.getRange(1, 1, 1, 4).setValues([["TIMESTAMP", "ACTION", "DETAIL", "CLIENT_TIME"]]);
      logSheet.getRange(1, 1, 1, 4).setBackground("#374151").setFontColor("#FFFFFF").setFontWeight("bold");
      logSheet.setFrozenRows(1);
    }
    logSheet.appendRow([new Date().toISOString(), action, detail, new Date().toLocaleString("id-ID", { timeZone: "Asia/Makassar" }) + " WITA"]);
  } catch (e) {
    // Abaikan error logging agar tidak mengganggu transaksi utama
  }
}

function formatDateValue(val) {
  if (!val) return "";
  if (val instanceof Date) {
    var y = val.getFullYear();
    var m = String(val.getMonth() + 1).padStart(2, "0");
    var d = String(val.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }
  return String(val);
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
