import { AlkesItem, PemeliharaanItem, PerbaikanItem, BeritaAcaraPenarikan } from '../types';

/**
 * Daftar ID Data Demo bawaan yang harus selalu dihapus dan dibersihkan dari sistem
 */
export const DEMO_DATA_IDS: string[] = [
  'ALKES-2024-001',
  'ALKES-2024-002',
  'ALKES-2024-003',
  'ALKES-2024-004',
  'ALKES-2024-005',
  'ALKES-2024-006',
  'ALKES-2024-007',
  'ALKES-2024-008',
  'ALKES-2024-009',
  'ALKES-2024-010',
  'PPM-2024-001',
  'PPM-2024-002',
  'PPM-2024-003',
  'PPM-2024-004',
  'PPM-2024-005',
  'SPK-2024-001',
  'SPK-2024-002',
  'SPK-2024-003',
  'SPK-2024-004',
  'BAP-2024-001',
  'BAP-2024-002',
];

export const isDemoId = (id: string): boolean => {
  if (!id) return false;
  return DEMO_DATA_IDS.includes(id) || id.startsWith('DEMO-');
};

// Seluruh data awal dikosongkan (Clean State) sehingga aplikasi siap diisi data riil rumah sakit
export const INITIAL_INVENTARIS: AlkesItem[] = [];
export const INITIAL_PEMELIHARAAN: PemeliharaanItem[] = [];
export const INITIAL_PERBAIKAN: PerbaikanItem[] = [];
export const INITIAL_BERITA_ACARA: BeritaAcaraPenarikan[] = [];
export const INITIAL_ALKES = INITIAL_INVENTARIS;
