import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AlkesItem, BeritaAcaraPenarikan, PemeliharaanItem, PerbaikanItem } from '../types';
import { LOGO_RSUD_LAMADDUKELLENG_BASE64 } from './logoBase64';

export const KOP_SURAT = {
  provinsi: 'PEMERINTAH KABUPATEN WAJO',
  dinas: 'DINAS KESEHATAN',
  rsud: 'UPTD RUMAH SAKIT UMUM DAERAH LAMADDUKELLENG',
  alamat: 'Jalan Kartika Candra Kirana No.9, Tempe, Wajo, Provinsi  SUL-SEL',
  kontak: 'Instalasi Pemeliharaan Sarana Rumah Sakit (IPSRS) - Elektromedis',
};

// Helper: draw official hospital letterhead with official emblem logo
export const drawKopSurat = (doc: jsPDF, title: string, subtitle?: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();

  // 1. Draw Official Logo on Top Left
  try {
    const logoSize = 24; // 24mm x 24mm
    const logoX = 14;
    const logoY = 9;
    doc.addImage(LOGO_RSUD_LAMADDUKELLENG_BASE64, 'PNG', logoX, logoY, logoSize, logoSize);
  } catch (err) {
    console.warn('Gagal memuat logo pada kop surat:', err);
  }

  // 2. Official Letterhead Typography
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(KOP_SURAT.provinsi, pageWidth / 2, 14, { align: 'center' });
  doc.text(KOP_SURAT.dinas, pageWidth / 2, 19, { align: 'center' });

  doc.setFontSize(13.5);
  doc.setTextColor(0, 0, 0);
  doc.text(KOP_SURAT.rsud, pageWidth / 2, 25, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(20, 20, 20);
  doc.text(KOP_SURAT.alamat, pageWidth / 2, 29.5, { align: 'center' });

  doc.setFontSize(7.5);
  doc.text(KOP_SURAT.kontak, pageWidth / 2, 33.5, { align: 'center' });

  // 3. Double Official Border Line (Thick upper, Thin lower in Black)
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.9);
  doc.line(14, 36.5, pageWidth - 14, 36.5);
  doc.setLineWidth(0.3);
  doc.line(14, 37.7, pageWidth - 14, 37.7);

  // 4. Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(153, 0, 0); // Crimson Red accent for document title
  doc.text(title, pageWidth / 2, 46, { align: 'center' });

  if (subtitle) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    doc.text(subtitle, pageWidth / 2, 51, { align: 'center' });
  }
};

/**
 * Generate PDF for Berita Acara Penarikan Alkes (BAP-ALKES)
 */
export const generateBapPdf = (bap: BeritaAcaraPenarikan) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  drawKopSurat(
    doc,
    'BERITA ACARA PENARIKAN ALAT KESEHATAN (BAP-ALKES)'
  );

  let y = 57;

  // Introduction paragraph
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 30, 30);

  const tglFormatted = new Date(bap.tanggal).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const intro = `Pada hari ini, ${tglFormatted}, bertempat di UPTD RSUD LAMADDUKELLENG, kami yang bertanda tangan di bawah ini Tim Teknisi Elektromedis (IPSRS) beserta Kepala Ruangan terkait telah melakukan pemeriksaan teknis, evaluasi kelaikan, dan menyepakati penarikan peralatan kesehatan dengan status/rekomendasi "${bap.rekomendasiTindakan}", rincian sebagai berikut:`;
  const splitIntro = doc.splitTextToSize(intro, pageWidth - 28);
  doc.text(splitIntro, 14, y);
  y += splitIntro.length * 5 + 3;

  // Equipment table
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    headStyles: {
      fillColor: [153, 0, 0],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [30, 30, 30],
    },
    columns: [
      { header: 'Parameter Identifikasi', dataKey: 'key' },
      { header: 'Keterangan / Spesifikasi Alat', dataKey: 'val' },
    ],
    body: [
      { key: 'Nama Alat Kesehatan', val: bap.namaAlat },
      { key: 'Merk / Pabrikan', val: bap.merk },
      { key: 'Model / Tipe', val: bap.modelType },
      { key: 'Serial Number (SN)', val: bap.serialNumber },
      { key: 'Tahun Pengadaan', val: bap.tahunPengadaan || '-' },
      { key: 'Ruangan / Unit Kerja Asal', val: bap.ruangan },
      { key: 'Kondisi Terakhir Alat', val: bap.kondisiTerakhir },
      { key: 'Status / Rekomendasi Penarikan', val: bap.rekomendasiTindakan },
    ],
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // Justification & technical analysis
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(153, 0, 0);
  doc.text('I. ALASAN PENARIKAN ALAT:', 14, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  const splitAlasan = doc.splitTextToSize(bap.alasanPenarikan || 'Kerusakan berat dan tidak dapat diperbaiki secara ekonomis.', pageWidth - 28);
  doc.text(splitAlasan, 14, y);
  y += splitAlasan.length * 4.5 + 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(153, 0, 0);
  doc.text('II. ANALISA TEKNIS & KESELAMATAN (ELEKTROMEDIS):', 14, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  const splitAnalisa = doc.splitTextToSize(
    bap.analisaTeknis ||
      'Alat tidak memenuhi standar keselamatan pasien (K3RS) dan berpotensi memberikan output terapi/diagnostik yang tidak akurat.',
    pageWidth - 28
  );
  doc.text(splitAnalisa, 14, y);
  y += splitAnalisa.length * 4.5 + 6;

  // Closing text
  const closing = 'Demikian Berita Acara Penarikan Alat Kesehatan ini dibuat dengan sebenarnya dalam rangkap secukupnya untuk dipergunakan sebagaimana mestinya dan menjadi dasar pencatatan inventaris barang milik daerah.';
  const splitClosing = doc.splitTextToSize(closing, pageWidth - 28);
  doc.text(splitClosing, 14, y);
  y += splitClosing.length * 4.5 + 8;

  // Signatures Section (3 columns: Teknisi (Yang Menerima/Memeriksa), Kepala Ruangan (Yang Menyerahkan), Mengetahui Kepala IPSRS)
  if (y > 230) {
    doc.addPage();
    y = 25;
  }

  const colWidth = (pageWidth - 28) / 3;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(20, 20, 20);

  // Col 1: Teknisi Elektromedis (Yang Menerima/Memeriksa)
  doc.text('Petugas Teknisi Elektromedis,', 14 + colWidth / 2, y, { align: 'center' });
  doc.text('( Yang Menerima / Memeriksa )', 14 + colWidth / 2, y + 4, { align: 'center' });

  // Col 2: Kepala Ruangan / Petugas (Yang Menyerahkan)
  doc.text(`Kepala ${bap.ruangan} / Petugas,`, 14 + colWidth + colWidth / 2, y, { align: 'center' });
  doc.text('( Yang Menyerahkan )', 14 + colWidth + colWidth / 2, y + 4, { align: 'center' });

  // Col 3: Kepala IPSRS (Mengetahui)
  doc.text('Mengetahui,', 14 + colWidth * 2 + colWidth / 2, y, { align: 'center' });
  doc.text('Kepala IPSRS UPTD RSUD LAMADDUKELLENG', 14 + colWidth * 2 + colWidth / 2, y + 4, { align: 'center' });

  // Space for signatures
  const sigY = y + 26;

  // Render Digital Signatures if present
  if (bap.ttdTeknisi) {
    try {
      doc.addImage(bap.ttdTeknisi, 'PNG', 14 + colWidth / 2 - 16, y + 6, 32, 16);
    } catch {
      // ignore image render errors
    }
  }

  if (bap.ttdKepalaRuangan) {
    try {
      doc.addImage(bap.ttdKepalaRuangan, 'PNG', 14 + colWidth + colWidth / 2 - 16, y + 6, 32, 16);
    } catch {
      // ignore image render errors
    }
  }

  if (bap.ttdKepalaIpsrs) {
    try {
      doc.addImage(bap.ttdKepalaIpsrs, 'PNG', 14 + colWidth * 2 + colWidth / 2 - 16, y + 6, 32, 16);
    } catch {
      // ignore image render errors
    }
  }

  // Signer 1
  doc.setFont('helvetica', 'bold');
  doc.text(bap.namaTeknisi || 'Teknisi Elektromedis', 14 + colWidth / 2, sigY, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text(`NIP. ${bap.nipTeknisi || '-'}`, 14 + colWidth / 2, sigY + 4, { align: 'center' });

  // Signer 2
  doc.setFont('helvetica', 'bold');
  doc.text(bap.namaKepalaRuangan || 'Kepala Ruangan', 14 + colWidth + colWidth / 2, sigY, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text(`NIP. ${bap.nipKepalaRuangan || '-'}`, 14 + colWidth + colWidth / 2, sigY + 4, { align: 'center' });

  // Signer 3
  doc.setFont('helvetica', 'bold');
  doc.text(bap.namaKepalaIpsrs || 'Ramlan, A.Md.TEM', 14 + colWidth * 2 + colWidth / 2, sigY, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text(`NIP. ${bap.nipKepalaIpsrs || '198605102010011005'}`, 14 + colWidth * 2 + colWidth / 2, sigY + 4, { align: 'center' });

  // Footer stamp note
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `SIM-ALKES UPTD RSUD LAMADDUKELLENG • Dicetak otomatis pada: ${new Date().toLocaleString('id-ID')} • BAP-ID: ${bap.id}`,
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 8,
    { align: 'center' }
  );

  doc.save(`BAP-PENARIKAN-${bap.namaAlat.replace(/[^a-zA-Z0-9]/g, '_')}-${bap.id}.pdf`);
};

/**
 * Generate PDF for Lembar Kerja Pemeliharaan & Pemantauan Alkes (PPM)
 */
export const generatePpmReportPdf = (ppmList: PemeliharaanItem[], filterRuangan?: string) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  drawKopSurat(
    doc,
    'LAPORAN PEMELIHARAAN & PEMANTAUAN ALAT KESEHATAN (PPM)',
    filterRuangan ? `Unit Kerja / Ruangan: ${filterRuangan}` : 'Seluruh Unit Kerja UPTD RSUD LAMADDUKELLENG'
  );

  const tableBody = ppmList.map((item, idx) => [
    idx + 1,
    item.tanggal,
    item.namaTeknisi,
    item.ruangan,
    item.namaAlat,
    `${item.merk} / ${item.modelType}`,
    item.serialNumber,
    item.kegiatanFisik ? '✓' : '✗',
    item.kegiatanSetting ? '✓' : '✗',
    item.kegiatanCleaning ? '✓' : '✗',
    item.kondisi,
    item.status === 'layak pakai' ? 'LAYAK PAKAI' : 'PERLU PERBAIKAN',
  ]);

  autoTable(doc, {
    startY: 56,
    theme: 'grid',
    headStyles: {
      fillColor: [153, 0, 0],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 30, 30],
      valign: 'middle',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 7 },
      1: { halign: 'center', cellWidth: 18 },
      2: { cellWidth: 25 },
      3: { cellWidth: 20 },
      4: { cellWidth: 30 },
      5: { cellWidth: 22 },
      6: { cellWidth: 20 },
      7: { halign: 'center', cellWidth: 32 },
      8: { halign: 'center', cellWidth: 40 },
      9: { halign: 'center', cellWidth: 25 },
      10: { halign: 'center', cellWidth: 16 },
      11: { halign: 'center', cellWidth: 22 },
    },
    head: [
      [
        'No',
        'Tanggal',
        'Teknisi',
        'Ruangan',
        'Nama Alat',
        'Merk / Type',
        'Serial Number',
        '1. Pemeriksaan fisik-fungsi dan kelengkapan aksesoris',
        '2. Setting parameter-perawatan mekanik dan kelistrikan serta pemanasan Alat',
        '3. Cleaning seluruh bagian alat',
        'Kondisi',
        'Status Kelayakan',
      ],
    ],
    body: tableBody,
    margin: { left: 10, right: 10 },
  });

  // Footer stamp note
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `SIM-ALKES UPTD RSUD LAMADDUKELLENG • Laporan Pemeliharaan Preventif Medis (PPM) • Dicetak pada: ${new Date().toLocaleString('id-ID')}`,
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 6,
    { align: 'center' }
  );

  doc.save(`Laporan-PPM-RSUD-LAMADDUKELLENG-${new Date().toISOString().slice(0, 10)}.pdf`);
};

/**
 * Generate PDF for Daftar Inventaris Alkes UPTD RSUD LAMADDUKELLENG
 */
export const generateInventarisPdf = (items: AlkesItem[], filterRuangan?: string) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  drawKopSurat(
    doc,
    'BUKU INDUK INVENTARIS ALAT KESEHATAN',
    filterRuangan ? `Lokasi Ruangan: ${filterRuangan}` : 'Daftar Seluruh Alkes UPTD RSUD LAMADDUKELLENG'
  );

  const tableBody = items.map((item, idx) => [
    idx + 1,
    item.ruangan,
    item.namaAlat,
    item.merk,
    item.modelType,
    item.serialNumber,
    item.tahunPengadaan || '-',
    item.kalibrasiTerakhir || '-',
    item.kalibrasiBerikutnya || '-',
    item.kondisi,
    item.keterangan,
  ]);

  autoTable(doc, {
    startY: 56,
    theme: 'grid',
    headStyles: {
      fillColor: [153, 0, 0],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 30, 30],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { cellWidth: 26 },
      2: { cellWidth: 40 },
      3: { cellWidth: 22 },
      4: { cellWidth: 25 },
      5: { cellWidth: 26 },
      6: { halign: 'center', cellWidth: 16 },
      7: { halign: 'center', cellWidth: 24 },
      8: { halign: 'center', cellWidth: 24 },
      9: { cellWidth: 22 },
      10: { cellWidth: 32 },
    },
    head: [
      [
        'No',
        'Ruangan',
        'Nama Alat Kesehatan',
        'Merk',
        'Tipe/Model',
        'Serial Number',
        'Thn Beli',
        'Kalibrasi Akhir',
        'Kalibrasi Berikut',
        'Kondisi',
        'Keterangan',
      ],
    ],
    body: tableBody,
    margin: { left: 10, right: 10 },
  });

  doc.save(`Inventaris-Alkes-UPTD-RSUD-LAMADDUKELLENG-${new Date().toISOString().slice(0, 10)}.pdf`);
};

/**
 * Generate PDF for Form Perbaikan Alkes (Work Order)
 */
export const generatePerbaikanPdf = (item: PerbaikanItem) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  drawKopSurat(doc, 'LEMBAR KERJA PERBAIKAN ALAT KESEHATAN (WORK ORDER)');

  let y = 57;

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    headStyles: { fillColor: [153, 0, 0], textColor: [255, 255, 255], fontSize: 9 },
    bodyStyles: { fontSize: 8.5 },
    columns: [
      { header: 'Parameter', dataKey: 'key' },
      { header: 'Keterangan', dataKey: 'val' },
    ],
    body: [
      { key: 'Tanggal Laporan / Pengerjaan', val: item.tanggal },
      { key: 'Pelapor / Unit Kerja', val: `${item.pelapor} (${item.ruangan})` },
      { key: 'Nama Alat & Merk', val: `${item.namaAlat} - ${item.merk}` },
      { key: 'Model / Serial Number', val: `${item.modelType} / SN: ${item.serialNumber}` },
      { key: 'Keluhan Kerusakan', val: item.keluhanKerusakan },
      { key: 'Analisa Kerusakan Teknisi', val: item.analisisTeknisi },
      { key: 'Tindakan Perbaikan yang Dilakukan', val: item.tindakanPerbaikan },
      { key: 'Penggantian Suku Cadang', val: item.sparepartDiganti || 'Tidak ada pergantian sparepart' },
      { key: 'Estimasi Biaya Suku Cadang', val: item.biayaEstimasi ? `Rp ${item.biayaEstimasi.toLocaleString('id-ID')}` : 'Rp 0' },
      { key: 'Status Akhir Perbaikan', val: item.statusPerbaikan },
      { key: 'Teknisi Elektromedis', val: item.teknisiPelaksana },
    ],
    margin: { left: 14, right: 14 },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Petugas Pelapor / Perawat,', 30, finalY);
  doc.text('( ................................................ )', 30, finalY + 22);

  doc.text('Teknisi Elektromedis,', 140, finalY);
  doc.setFont('helvetica', 'bold');
  doc.text(`( ${item.teknisiPelaksana} )`, 140, finalY + 22);

  // Footer note
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `SIM-ALKES UPTD RSUD LAMADDUKELLENG • Lembar Kerja Perbaikan • Dicetak pada: ${new Date().toLocaleString('id-ID')}`,
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 6,
    { align: 'center' }
  );

  doc.save(`Lembar-Kerja-Perbaikan-${(item.namaAlat || 'Alkes').replace(/[^a-zA-Z0-9]/g, '_')}-${item.tanggal}.pdf`);
};

/**
 * Generate PDF for Rekapitulasi Laporan Perbaikan Alkes (Tabel Lengkap)
 */
export const generatePerbaikanListPdf = (items: PerbaikanItem[], filterRuangan?: string) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  drawKopSurat(
    doc,
    'LAPORAN REKAPITULASI PERBAIKAN ALAT KESEHATAN (IPSRS)',
    filterRuangan && filterRuangan !== 'SEMUA'
      ? `Unit Kerja / Ruangan: ${filterRuangan} • Total: ${items.length} Laporan`
      : `Seluruh Unit Pelayanan UPTD RSUD LAMADDUKELLENG • Total: ${items.length} Laporan`
  );

  const tableBody = items.map((item, idx) => [
    idx + 1,
    item.tanggal,
    item.nomorSpk,
    item.ruangan,
    `${item.namaAlat}\n(SN: ${item.serialNumber || '-'})`,
    item.pelapor,
    item.keluhanKerusakan,
    item.tindakanPerbaikan || item.analisisTeknisi || '-',
    item.sparepartDiganti
      ? `${item.sparepartDiganti}\n(Rp ${(item.biayaEstimasi || 0).toLocaleString('id-ID')})`
      : item.biayaEstimasi
      ? `Rp ${item.biayaEstimasi.toLocaleString('id-ID')}`
      : 'Rp 0',
    item.statusPerbaikan,
    item.teknisiPelaksana,
  ]);

  autoTable(doc, {
    startY: 55,
    theme: 'grid',
    headStyles: {
      fillColor: [153, 0, 0],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 30, 30],
      valign: 'middle',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 7 },
      1: { halign: 'center', cellWidth: 16 },
      2: { cellWidth: 26 },
      3: { cellWidth: 20 },
      4: { cellWidth: 32 },
      5: { cellWidth: 20 },
      6: { cellWidth: 36 },
      7: { cellWidth: 38 },
      8: { cellWidth: 26 },
      9: { halign: 'center', cellWidth: 24 },
      10: { cellWidth: 24 },
    },
    head: [
      [
        'No',
        'Tanggal',
        'Nomor SPK',
        'Ruangan',
        'Nama Alat & SN',
        'Pelapor',
        'Keluhan Kerusakan',
        'Tindakan Perbaikan',
        'Sparepart / Biaya',
        'Status Akhir',
        'Teknisi',
      ],
    ],
    body: tableBody,
    margin: { left: 10, right: 10 },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 8;
  const signY = finalY > 165 ? 25 : finalY;
  if (finalY > 165) doc.addPage();

  const col1 = 40;
  const col2 = pageWidth - 55;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 30, 30);
  doc.text('Mengetahui,', col1, signY, { align: 'center' });
  doc.text('Kepala Instalasi IPSRS', col1, signY + 4, { align: 'center' });

  doc.text(`Lamaddukelleng, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, col2, signY, { align: 'center' });
  doc.text('Koordinator / Teknisi Elektromedis,', col2, signY + 4, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.text('RAMLAN, A.Md.TEM', col1, signY + 22, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('NIP. 19860510 201001 1 005', col1, signY + 26, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Musmuliadi, SKM.M.M', col2, signY + 22, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('NIP. 19941017 202012 1 001', col2, signY + 26, { align: 'center' });

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `SIM-ALKES UPTD RSUD LAMADDUKELLENG • Rekapitulasi Laporan Perbaikan Alkes • Dicetak otomatis pada: ${new Date().toLocaleString('id-ID')}`,
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 6,
    { align: 'center' }
  );

  doc.save(`Laporan-Perbaikan-RSUD-Lamaddukelleng-${new Date().toISOString().slice(0, 10)}.pdf`);
};

/**
 * Generate PDF for Laporan Bulanan Kinerja Elektromedis (IPSRS)
 * Merangkum total perbaikan dan riwayat pemeliharaan berdasarkan periode bulan
 */
export const generateLaporanBulananPdf = (
  bulanKey: string,
  namaBulanTahun: string,
  perbaikanList: PerbaikanItem[],
  ppmList: PemeliharaanItem[],
  currentTeknisi?: { namaLengkap: string; gelar: string; nip: string; jabatan?: string }
) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  drawKopSurat(
    doc,
    'LAPORAN KINERJA BULANAN ELEKTROMEDIS (IPSRS)',
    `REKAPITULASI PERBAIKAN & PEMELIHARAAN ALKES • PERIODE: ${namaBulanTahun.toUpperCase()}`
  );

  // Metrics summary
  const totalPerbaikan = perbaikanList.length;
  const perbaikanSelesai = perbaikanList.filter((p) => p.statusPerbaikan === 'Selesai (Alat Normal)').length;
  const perbaikanProses = totalPerbaikan - perbaikanSelesai;
  const totalBiaya = perbaikanList.reduce((acc, curr) => acc + (curr.biayaEstimasi || 0), 0);

  const totalPpm = ppmList.length;
  const ppmLayak = ppmList.filter((p) => p.status === 'layak pakai').length;
  const ppmPerluPerbaikan = totalPpm - ppmLayak;

  // Render KPI Summary Table
  autoTable(doc, {
    startY: 54,
    theme: 'grid',
    headStyles: {
      fillColor: [153, 0, 0],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [20, 20, 20],
      halign: 'center',
      fontStyle: 'bold',
    },
    head: [
      [
        'Total Perbaikan (SPK)',
        'Perbaikan Selesai',
        'Dalam Proses / Sparepart',
        'Total Riwayat PPM',
        'Alkes Layak Pakai (PPM)',
        'Perlu Perbaikan (PPM)',
        'Total Estimasi Biaya (Rp)',
      ],
    ],
    body: [
      [
        `${totalPerbaikan} Unit`,
        `${perbaikanSelesai} Unit (${totalPerbaikan ? Math.round((perbaikanSelesai / totalPerbaikan) * 100) : 0}%)`,
        `${perbaikanProses} Unit`,
        `${totalPpm} Unit`,
        `${ppmLayak} Unit`,
        `${ppmPerluPerbaikan} Unit`,
        `Rp ${totalBiaya.toLocaleString('id-ID')}`,
      ],
    ],
    margin: { left: 12, right: 12 },
  });

  let currentY = (doc as any).lastAutoTable.finalY + 6;

  // Section 1: Perbaikan Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(153, 0, 0);
  doc.text(`1. Rekapitulasi Penanganan Laporan & Perbaikan Alkes (${perbaikanList.length} Kegiatan)`, 12, currentY);
  currentY += 2;

  const perbaikanRows = perbaikanList.map((item, idx) => [
    idx + 1,
    item.tanggal,
    item.nomorSpk,
    item.ruangan,
    item.namaAlat,
    `${item.merk} / ${item.modelType}`,
    item.serialNumber || '-',
    item.keluhanKerusakan,
    item.tindakanPerbaikan || item.analisisTeknisi || '-',
    item.biayaEstimasi ? `Rp ${item.biayaEstimasi.toLocaleString('id-ID')}` : 'Rp 0',
    item.statusPerbaikan,
  ]);

  if (perbaikanRows.length === 0) {
    perbaikanRows.push([
      '-',
      '-',
      '-',
      '-',
      'Tidak ada perbaikan tercatat pada periode bulan ini',
      '-',
      '-',
      '-',
      '-',
      '-',
      '-',
    ]);
  }

  autoTable(doc, {
    startY: currentY,
    theme: 'grid',
    headStyles: {
      fillColor: [50, 50, 50],
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 30, 30],
      valign: 'middle',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 7 },
      1: { halign: 'center', cellWidth: 16 },
      2: { cellWidth: 26 },
      3: { cellWidth: 20 },
      4: { cellWidth: 32 },
      5: { cellWidth: 24 },
      6: { cellWidth: 18 },
      7: { cellWidth: 35 },
      8: { cellWidth: 38 },
      9: { halign: 'right', cellWidth: 24 },
      10: { halign: 'center', cellWidth: 23 },
    },
    head: [
      [
        'No',
        'Tanggal',
        'Nomor SPK',
        'Ruangan',
        'Nama Alat',
        'Merk / Tipe',
        'SN',
        'Keluhan Kerusakan',
        'Tindakan Perbaikan',
        'Estimasi Biaya',
        'Status Akhir',
      ],
    ],
    body: perbaikanRows,
    margin: { left: 12, right: 12 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // If page space is low, add a new page
  if (currentY > 165) {
    doc.addPage();
    currentY = 20;
  }

  // Section 2: Pemeliharaan (PPM) Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(153, 0, 0);
  doc.text(`2. Rekapitulasi Riwayat Pemeliharaan & Pemantauan Alkes / PPM (${ppmList.length} Kegiatan)`, 12, currentY);
  currentY += 2;

  const ppmRows = ppmList.map((item, idx) => [
    idx + 1,
    item.tanggal,
    item.ruangan,
    item.namaAlat,
    `${item.merk} / ${item.modelType}`,
    item.serialNumber || '-',
    item.namaTeknisi,
    item.kegiatanFisik ? '✓' : '✗',
    item.kegiatanSetting ? '✓' : '✗',
    item.kegiatanCleaning ? '✓' : '✗',
    item.kondisi,
    item.status === 'layak pakai' ? 'LAYAK PAKAI' : 'PERLU PERBAIKAN',
    item.catatan || '-',
  ]);

  if (ppmRows.length === 0) {
    ppmRows.push([
      '-',
      '-',
      '-',
      'Tidak ada pemeliharaan tercatat pada periode bulan ini',
      '-',
      '-',
      '-',
      '-',
      '-',
      '-',
      '-',
      '-',
      '-',
    ]);
  }

  autoTable(doc, {
    startY: currentY,
    theme: 'grid',
    headStyles: {
      fillColor: [50, 50, 50],
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 30, 30],
      valign: 'middle',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 7 },
      1: { halign: 'center', cellWidth: 16 },
      2: { cellWidth: 20 },
      3: { cellWidth: 32 },
      4: { cellWidth: 25 },
      5: { cellWidth: 20 },
      6: { cellWidth: 28 },
      7: { halign: 'center', cellWidth: 10 },
      8: { halign: 'center', cellWidth: 10 },
      9: { halign: 'center', cellWidth: 10 },
      10: { halign: 'center', cellWidth: 18 },
      11: { halign: 'center', cellWidth: 23 },
      12: { cellWidth: 44 },
    },
    head: [
      [
        'No',
        'Tanggal',
        'Ruangan',
        'Nama Alat',
        'Merk / Tipe',
        'SN',
        'Teknisi',
        'Fisik',
        'Set',
        'Clean',
        'Kondisi',
        'Status PPM',
        'Catatan / Rekomendasi',
      ],
    ],
    body: ppmRows,
    margin: { left: 12, right: 12 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // Check if signatures fit or need a new page
  if (currentY > 155) {
    doc.addPage();
    currentY = 24;
  }

  // Official Signature Block
  const col1 = 30;
  const col2 = pageWidth / 2;
  const col3 = pageWidth - 45;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 30, 30);

  doc.text('Mengetahui,', col1, currentY, { align: 'center' });
  doc.text('Direktur UPTD RSUD LAMADDUKELLENG', col1, currentY + 4, { align: 'center' });
  doc.text('Kepala Instalasi IPSRS,', col2, currentY + 4, { align: 'center' });
  doc.text(`Lamaddukelleng, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, col3, currentY, { align: 'center' });
  doc.text('Koordinator & Teknisi Elektromedis,', col3, currentY + 4, { align: 'center' });

  const signLineY = currentY + 22;
  doc.setFont('helvetica', 'bold');
  doc.text('dr. Hj. HAMSIAH, M.Kes', col1, signLineY, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('NIP. 19780512 200804 2 001', col1, signLineY + 4, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('RAMLAN, A.Md.TEM', col2, signLineY, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('NIP. 19860510 201001 1 005', col2, signLineY + 4, { align: 'center' });

  const techName = currentTeknisi?.namaLengkap
    ? `${currentTeknisi.namaLengkap}, ${currentTeknisi.gelar}`
    : 'Musmuliadi, SKM.M.M';
  const techNip = currentTeknisi?.nip || '19941017 202012 1 001';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(techName, col3, signLineY, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`NIP. ${techNip}`, col3, signLineY + 4, { align: 'center' });

  // Bottom footer stamp
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  doc.text(
    `SIM-ALKES UPTD RSUD LAMADDUKELLENG • Laporan Bulanan Elektromedis • Dicetak otomatis pada: ${new Date().toLocaleString('id-ID')}`,
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 6,
    { align: 'center' }
  );

  doc.save(`Laporan-Bulanan-IPSRS-${bulanKey}.pdf`);
};
