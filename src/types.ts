export type RuanganType =
  | 'IGD'
  | 'IGD MATERNAL'
  | 'RADIOLOGI'
  | 'RADIOLOGI IGD'
  | 'PERAWATAN TULIP'
  | 'OK'
  | 'ICU'
  | 'HCU'
  | 'NICU'
  | 'PICU'
  | 'PERAWATAN CEMPAKA'
  | 'CSSD'
  | 'PERAWATAN MELATI'
  | 'BDRS'
  | 'LABORATORIUM'
  | 'PERAWATAN SERUNI'
  | 'PERAWATAN ANGGREK'
  | 'PERAWATAN EDELWEIS'
  | 'APOTIK'
  | 'POLI JIWA'
  | 'POLI GIZI'
  | 'POLI SYARAF'
  | 'POLI INTERNA'
  | 'POLI ANAK'
  | 'POLI OBGYN'
  | 'POLI MATA'
  | 'POLI BEDAH'
  | 'POLI UMUM'
  | 'POLI GIGI'
  | string;

export const DAFTAR_RUANGAN: RuanganType[] = [
  'IGD',
  'IGD MATERNAL',
  'RADIOLOGI',
  'RADIOLOGI IGD',
  'PERAWATAN TULIP',
  'OK',
  'ICU',
  'HCU',
  'NICU',
  'PICU',
  'PERAWATAN CEMPAKA',
  'CSSD',
  'PERAWATAN MELATI',
  'BDRS',
  'LABORATORIUM',
  'PERAWATAN SERUNI',
  'PERAWATAN ANGGREK',
  'PERAWATAN EDELWEIS',
  'APOTIK',
  'POLI JIWA',
  'POLI GIZI',
  'POLI SYARAF',
  'POLI INTERNA',
  'POLI ANAK',
  'POLI OBGYN',
  'POLI MATA',
  'POLI BEDAH',
  'POLI UMUM',
  'POLI GIGI',
];

export type KondisiAlatType = 'Baik' | 'Rusak Ringan' | 'Rusak Sedang' | 'Rusak Berat';

export type KeteranganAlatType = 'Berfungsi' | 'Perlu penggantian sparepart' | 'Penarikan Alat';

export type StatusKalibrasiType = 'Terkalibrasi' | 'Perlu Kalibrasi' | 'Kadaluarsa';

export type StatusPpmType = 'layak pakai' | 'perlu perbaikan / penggantian sparepart';

export type UserRole = 'admin' | 'user';

export interface Teknisi {
  username: string;
  namaLengkap: string;
  gelar: string;
  nip: string;
  jabatan: string;
  telepon?: string;
  avatarColor: string;
  role: UserRole;
  email?: string;
}

export const DAFTAR_TEKNISI: Record<string, Teknisi> = {
  adi: {
    username: 'adi',
    namaLengkap: 'Musmuliadi',
    gelar: 'SKM.M.M',
    nip: '199410172020121001',
    jabatan: 'Koordinator & Teknisi Elektromedis',
    telepon: '0812-4455-6677',
    avatarColor: 'bg-red-700',
    role: 'admin',
    email: 'bulukumba17101994@gmail.com',
  },
  ramlan: {
    username: 'ramlan',
    namaLengkap: 'Ramlan',
    gelar: 'A.Md.TEM',
    nip: '198605102010011005',
    jabatan: 'Teknisi Elektromedis',
    telepon: '0852-9988-7766',
    avatarColor: 'bg-red-800',
    role: 'admin',
    email: 'bulukumba17101994@gmail.com',
  },
  uki: {
    username: 'uki',
    namaLengkap: 'Ummi Rukiah Wardi',
    gelar: 'A.Md.TEM',
    nip: '199706222020122002',
    jabatan: 'Teknisi Elektromedis',
    telepon: '0821-3344-5566',
    avatarColor: 'bg-rose-700',
    role: 'admin',
    email: 'bulukumba17101994@gmail.com',
  },
  faisal: {
    username: 'faisal',
    namaLengkap: 'Muh Faisal',
    gelar: 'A.Md.T',
    nip: '199208142020121003',
    jabatan: 'Teknisi Elektromedis',
    telepon: '0813-7788-9900',
    avatarColor: 'bg-red-900',
    role: 'admin',
    email: 'bulukumba17101994@gmail.com',
  },
  user: {
    username: 'user',
    namaLengkap: 'Petugas Ruangan / Unit Pelayanan',
    gelar: 'Petugas Ruangan',
    nip: 'PETUGAS-RUANGAN-SW',
    jabatan: 'Pelapor Kerusakan Alat Kesehatan Ruangan',
    telepon: '0812-3344-5566',
    avatarColor: 'bg-blue-700',
    role: 'user',
    email: 'bulukumba17101994@gmail.com',
  },
};

export interface AlkesItem {
  id: string;
  ruangan: RuanganType;
  namaAlat: string;
  merk: string;
  modelType: string;
  serialNumber: string;
  tahunPengadaan: string;
  kalibrasiTerakhir: string; // YYYY-MM-DD
  kalibrasiBerikutnya: string; // Auto calculated (+1 year)
  statusKalibrasi: StatusKalibrasiType;
  kondisi: KondisiAlatType;
  keterangan: KeteranganAlatType;
  kategori?: string;
  nomorInventaris?: string;
  dayaListrik?: string;
  lokasiSpesifik?: string;
  fotoUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  lastEditedBy?: string;
}

export interface PemeliharaanItem {
  id: string;
  tanggal: string; // YYYY-MM-DD
  namaTeknisi: string;
  nipTeknisi?: string;
  ruangan: RuanganType;
  alkesId?: string;
  namaAlat: string;
  merk: string;
  modelType: string;
  serialNumber: string;
  kegiatanFisik: boolean; // Pemeriksaan fisik-fungsi dan kelengkapan aksesoris
  kegiatanSetting: boolean; // Setting parameter-perawatan mekanik dan kelistrikan serta pemanasan Alat
  kegiatanCleaning: boolean; // Cleaning seluruh bagian alat
  kondisi: KondisiAlatType; // Baik, Rusak Ringan, Rusak Sedang, Rusak Berat
  status: StatusPpmType; // layak pakai, perlu perbaikan / penggantian sparepart
  catatan?: string;
  rekomendasi?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const DAFTAR_STATUS_PERBAIKAN = [
  'Selesai (Alat Normal)',
  'Menunggu Sparepart',
  'Dalam Proses',
  'Rekomendasi Penarikan',
  'Rekomendasi Perbaikan Vendor',
] as const;

export type StatusPerbaikanType =
  | 'Selesai (Alat Normal)'
  | 'Menunggu Sparepart'
  | 'Dalam Proses'
  | 'Rekomendasi Penarikan'
  | 'Rekomendasi Perbaikan Vendor'
  | string;

export const DAFTAR_REKOMENDASI_BAP = [
  'Penarikan ke Gudang Elektromedis (IPSRS)',
  'Perbaikan Lanjutan / Pihak Ketiga (Vendor)',
  'Menunggu Penggantian Suku Cadang (Sparepart)',
  'Penarikan Sementara untuk Kalibrasi / Uji Fungsi',
  'Dikembalikan ke Pemasok / Hibah',
  'Tukar Tambah (Trade-In)',
  'Afkir Permanen (Usul Pemusnahan / Penghapusan Aset)',
] as const;

export type RekomendasiTindakanBapType =
  | 'Penarikan ke Gudang Elektromedis (IPSRS)'
  | 'Perbaikan Lanjutan / Pihak Ketiga (Vendor)'
  | 'Menunggu Penggantian Suku Cadang (Sparepart)'
  | 'Penarikan Sementara untuk Kalibrasi / Uji Fungsi'
  | 'Dikembalikan ke Pemasok / Hibah'
  | 'Tukar Tambah (Trade-In)'
  | 'Afkir Permanen (Usul Pemusnahan / Penghapusan Aset)'
  | 'Afkir Permanen'
  | 'Disimpan di Gudang Elektromedis'
  | string;

export interface PerbaikanComment {
  id: string;
  perbaikanId: string;
  senderName: string;
  senderRole: 'admin' | 'user' | 'teknisi' | 'pelapor' | string;
  senderUsername?: string;
  senderNip?: string;
  senderRuangan?: string;
  avatarColor?: string;
  message: string;
  statusTag?: string;
  timestamp: string; // ISO string
  attachments?: string[];
}

export interface PerbaikanItem {
  id: string;
  nomorSpk: string;
  tanggal: string;
  pelapor: string;
  ruangan: RuanganType;
  alkesId?: string;
  namaAlat: string;
  merk: string;
  modelType: string;
  serialNumber: string;
  keluhanKerusakan: string;
  analisisTeknisi: string;
  tindakanPerbaikan: string;
  sparepartDiganti?: string;
  biayaEstimasi?: number;
  teknisiPelaksana: string;
  statusPerbaikan: StatusPerbaikanType;
  comments?: PerbaikanComment[];
  createdAt?: string;
  updatedAt?: string;
}

export interface BeritaAcaraPenarikan {
  id: string;
  nomorBap?: string;
  tanggal: string;
  alkesId: string;
  namaAlat: string;
  merk: string;
  modelType: string;
  serialNumber: string;
  tahunPengadaan: string;
  ruangan: RuanganType;
  kondisiTerakhir: KondisiAlatType;
  alasanPenarikan: string;
  analisaTeknis: string;
  rekomendasiTindakan: RekomendasiTindakanBapType;
  namaTeknisi: string;
  nipTeknisi: string;
  namaKepalaRuangan: string;
  nipKepalaRuangan?: string;
  namaKepalaIpsrs?: string;
  nipKepalaIpsrs?: string;
  namaDirektur?: string;
  nipDirektur?: string;
  ttdTeknisi?: string;
  ttdKepalaRuangan?: string;
  ttdKepalaIpsrs?: string;
  createdAt?: string;
}

export type TabMenuType = 'dashboard' | 'inventaris' | 'pemeliharaan' | 'perbaikan' | 'beritaAcara' | 'aiChat';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: string;
  modelUsed?: string;
}

export type AiExpertRole =
  | 'teknisi_utama'
  | 'troubleshooter'
  | 'kalibrasi_sop'
  | 'analis_bap'
  | 'manajemen_aset';

export interface ApkNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'penarikan_bap' | 'sync' | 'ppm' | 'perbaikan';
  timestamp: string;
  read?: boolean;
  alkesPayload?: AlkesItem;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'danger' | 'warning' | 'info' | 'success' | 'perbaikan' | 'penarikan_bap' | 'sync' | 'ppm';
  timestamp: string;
  actionType?: 'penarikan' | 'kalibrasi' | 'sync' | 'view' | 'perbaikan';
  actionData?: any;
  isRead?: boolean;
}

export const TEKNISI_ACCOUNTS = DAFTAR_TEKNISI;
