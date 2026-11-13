import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import {
  BOOTSTRAP_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  AlkesItem,
  BeritaAcaraPenarikan,
  PemeliharaanItem,
  PerbaikanComment,
  PerbaikanItem,
} from '../types';

export function sanitizeFirestoreId(rawId: string): string {
  const cleaned = String(rawId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 128);
  return cleaned || `DOC-${Date.now()}`;
}

function clampString(val: unknown, maxLen: number, fallback = ''): string {
  const str = val === undefined || val === null ? fallback : String(val);
  return str.slice(0, maxLen);
}

function toIsoTimestamp(val: unknown): string | undefined {
  if (!val) return undefined;
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  return undefined;
}

function normalizeKondisi(val: unknown): 'Baik' | 'Rusak Ringan' | 'Rusak Sedang' | 'Rusak Berat' {
  const s = String(val || '');
  if (s === 'Rusak Ringan' || s === 'Rusak Sedang' || s === 'Rusak Berat') return s;
  return 'Baik';
}

function normalizeStatusKalibrasi(val: unknown): 'Terkalibrasi' | 'Perlu Kalibrasi' | 'Kadaluarsa' {
  const s = String(val || '');
  if (s === 'Terkalibrasi' || s === 'Kadaluarsa') return s;
  return 'Perlu Kalibrasi';
}

function normalizeStatusPpm(val: unknown): 'layak pakai' | 'perlu perbaikan / penggantian sparepart' {
  const s = String(val || '');
  if (s === 'perlu perbaikan / penggantian sparepart') return s;
  return 'layak pakai';
}

const VALID_PERBAIKAN_STATUSES = [
  'Selesai (Alat Normal)',
  'Menunggu Sparepart',
  'Dalam Proses',
  'Rekomendasi Penarikan',
  'Rekomendasi Perbaikan Vendor',
] as const;

function normalizeStatusPerbaikan(val: unknown): (typeof VALID_PERBAIKAN_STATUSES)[number] {
  const s = String(val || '');
  if ((VALID_PERBAIKAN_STATUSES as readonly string[]).includes(s)) {
    return s as (typeof VALID_PERBAIKAN_STATUSES)[number];
  }
  return 'Dalam Proses';
}

export async function checkIsAdminUser(firebaseUser: User | null): Promise<boolean> {
  if (!firebaseUser || !firebaseUser.emailVerified) return false;
  if (firebaseUser.email === BOOTSTRAP_ADMIN_EMAIL) return true;
  try {
    const adminSnap = await getDoc(doc(db, 'admins', firebaseUser.uid));
    return adminSnap.exists();
  } catch {
    return false;
  }
}

export async function syncUserProfileToFirestore(
  firebaseUser: User,
  extra?: { teknisiUsername?: string; ruangan?: string }
): Promise<{ role: 'admin' | 'user' }> {
  const uid = sanitizeFirestoreId(firebaseUser.uid);
  const userPath = `users/${uid}`;
  const isBootstrap = firebaseUser.emailVerified && firebaseUser.email === BOOTSTRAP_ADMIN_EMAIL;
  const userRef = doc(db, 'users', uid);

  try {
    const existingSnap = await getDoc(userRef);
    const displayName = clampString(firebaseUser.displayName || firebaseUser.email || 'Pengguna RSUD', 150, 'Pengguna RSUD');
    const email = clampString(firebaseUser.email || 'user@rsud-lamaddukelleng.local', 200);

    if (!existingSnap.exists()) {
      const assignedRole: 'admin' | 'user' = isBootstrap ? 'admin' : 'user';
      const payload: Record<string, unknown> = {
        uid,
        email,
        displayName,
        role: assignedRole,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (extra?.teknisiUsername) payload.teknisiUsername = clampString(extra.teknisiUsername, 64);
      if (extra?.ruangan) payload.ruangan = clampString(extra.ruangan, 100);
      await setDoc(userRef, payload);
      return { role: assignedRole };
    } else {
      const existingData = existingSnap.data();
      const currentRole = existingData.role === 'admin' || isBootstrap ? 'admin' : 'user';
      const updatePayload: Record<string, unknown> = {
        displayName,
        updatedAt: serverTimestamp(),
      };
      if (extra?.teknisiUsername) updatePayload.teknisiUsername = clampString(extra.teknisiUsername, 64);
      if (extra?.ruangan) updatePayload.ruangan = clampString(extra.ruangan, 100);
      await updateDoc(userRef, updatePayload);
      return { role: currentRole };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

function buildAlkesFields(item: AlkesItem) {
  const fields: Record<string, unknown> = {
    ruangan: clampString(item.ruangan || 'IGD', 100, 'IGD'),
    namaAlat: clampString(item.namaAlat || 'Alat Kesehatan', 200, 'Alat Kesehatan'),
    merk: clampString(item.merk, 150),
    modelType: clampString(item.modelType, 150),
    serialNumber: clampString(item.serialNumber, 150),
    tahunPengadaan: clampString(item.tahunPengadaan || '-', 32, '-'),
    kalibrasiTerakhir: clampString(item.kalibrasiTerakhir, 32),
    kalibrasiBerikutnya: clampString(item.kalibrasiBerikutnya, 32),
    statusKalibrasi: normalizeStatusKalibrasi(item.statusKalibrasi),
    kondisi: normalizeKondisi(item.kondisi),
    keterangan: clampString(item.keterangan || 'Berfungsi', 200, 'Berfungsi'),
    nomorInventaris: clampString(item.nomorInventaris || '-', 120, '-'),
    lokasiSpesifik: clampString(item.lokasiSpesifik || '-', 150, '-'),
    lastEditedBy: clampString(item.lastEditedBy || 'Teknisi Elektromedis', 150, 'Teknisi Elektromedis'),
  };
  return fields;
}

export async function saveAlkesToFirestore(item: AlkesItem, ownerId: string): Promise<void> {
  const id = sanitizeFirestoreId(item.id);
  const path = `alkes/${id}`;
  const ref = doc(db, 'alkes', id);
  try {
    const snap = await getDoc(ref);
    const fields = buildAlkesFields(item);
    if (!snap.exists()) {
      await setDoc(ref, {
        id,
        ...fields,
        ownerId: sanitizeFirestoreId(ownerId),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        ...fields,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteAlkesFromFirestore(rawId: string): Promise<void> {
  const id = sanitizeFirestoreId(rawId);
  const path = `alkes/${id}`;
  try {
    await deleteDoc(doc(db, 'alkes', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function clearAllAlkesFromFirestore(
  userUid: string,
  isBootstrapAdminEmail: boolean,
  olderThanMs?: number
): Promise<number> {
  const uid = sanitizeFirestoreId(userUid);
  const q = isBootstrapAdminEmail
    ? collection(db, 'alkes')
    : query(collection(db, 'alkes'), where('ownerId', '==', uid));

  try {
    const snap = await getDocs(q);
    if (snap.empty) return 0;

    const docsToDelete = snap.docs.filter((d) => {
      if (!olderThanMs) return true;
      const data = d.data();
      const iso = toIsoTimestamp(data.updatedAt) || toIsoTimestamp(data.createdAt);
      const ts = iso ? new Date(iso).getTime() : 0;
      return ts <= olderThanMs;
    });

    if (docsToDelete.length === 0) return 0;

    let deletedCount = 0;
    for (let i = 0; i < docsToDelete.length; i += 400) {
      const chunk = docsToDelete.slice(i, i + 400);
      const batch = writeBatch(db);
      chunk.forEach((d) => {
        batch.delete(d.ref);
      });
      await batch.commit();
      deletedCount += chunk.length;
    }
    return deletedCount;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'alkes');
  }
}

function buildPemeliharaanFields(item: PemeliharaanItem) {
  const fields: Record<string, unknown> = {
    tanggal: clampString(item.tanggal || new Date().toISOString().slice(0, 10), 32),
    namaTeknisi: clampString(item.namaTeknisi || 'Teknisi Elektromedis', 150),
    nipTeknisi: clampString(item.nipTeknisi, 64),
    ruangan: clampString(item.ruangan || 'IGD', 100),
    alkesId: clampString(item.alkesId, 128),
    namaAlat: clampString(item.namaAlat || 'Alat Kesehatan', 200),
    merk: clampString(item.merk, 150),
    modelType: clampString(item.modelType, 150),
    serialNumber: clampString(item.serialNumber, 150),
    kegiatanFisik: Boolean(item.kegiatanFisik),
    kegiatanSetting: Boolean(item.kegiatanSetting),
    kegiatanCleaning: Boolean(item.kegiatanCleaning),
    kondisi: normalizeKondisi(item.kondisi),
    status: normalizeStatusPpm(item.status),
    catatan: clampString(item.catatan, 1000),
    rekomendasi: clampString(item.rekomendasi, 1000),
  };
  return fields;
}

export async function savePemeliharaanToFirestore(item: PemeliharaanItem, ownerId: string): Promise<void> {
  const id = sanitizeFirestoreId(item.id);
  const path = `pemeliharaan/${id}`;
  const ref = doc(db, 'pemeliharaan', id);
  try {
    const snap = await getDoc(ref);
    const fields = buildPemeliharaanFields(item);
    if (!snap.exists()) {
      await setDoc(ref, {
        id,
        ...fields,
        ownerId: sanitizeFirestoreId(ownerId),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        ...fields,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deletePemeliharaanFromFirestore(rawId: string): Promise<void> {
  const id = sanitizeFirestoreId(rawId);
  const path = `pemeliharaan/${id}`;
  try {
    await deleteDoc(doc(db, 'pemeliharaan', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

function buildPerbaikanFields(item: PerbaikanItem) {
  return {
    nomorSpk: clampString(item.nomorSpk || `SPK-${item.id}`, 100),
    tanggal: clampString(item.tanggal || new Date().toISOString().slice(0, 10), 32),
    pelapor: clampString(item.pelapor || 'Petugas Ruangan', 150),
    ruangan: clampString(item.ruangan || 'IGD', 100),
    alkesId: clampString(item.alkesId, 128),
    namaAlat: clampString(item.namaAlat || 'Alat Kesehatan', 200),
    merk: clampString(item.merk, 150),
    modelType: clampString(item.modelType, 150),
    serialNumber: clampString(item.serialNumber, 150),
    keluhanKerusakan: clampString(item.keluhanKerusakan || '-', 2000, '-'),
    analisisTeknisi: clampString(item.analisisTeknisi, 2000),
    tindakanPerbaikan: clampString(item.tindakanPerbaikan, 2000),
    sparepartDiganti: clampString(item.sparepartDiganti, 500),
    biayaEstimasi: typeof item.biayaEstimasi === 'number' && item.biayaEstimasi >= 0 ? item.biayaEstimasi : 0,
    teknisiPelaksana: clampString(item.teknisiPelaksana, 150),
    statusPerbaikan: normalizeStatusPerbaikan(item.statusPerbaikan),
  };
}

export async function savePerbaikanToFirestore(
  item: PerbaikanItem,
  ownerId: string,
  isAdmin: boolean
): Promise<void> {
  const id = sanitizeFirestoreId(item.id);
  const path = `perbaikan/${id}`;
  const ref = doc(db, 'perbaikan', id);
  try {
    const snap = await getDoc(ref);
    const fields = buildPerbaikanFields(item);
    if (!snap.exists()) {
      await setDoc(ref, {
        id,
        ...fields,
        statusPerbaikan: isAdmin ? fields.statusPerbaikan : 'Dalam Proses',
        ownerId: sanitizeFirestoreId(ownerId),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (isAdmin) {
      await updateDoc(ref, {
        ...fields,
        updatedAt: serverTimestamp(),
      });
    } else {
      // Non-admin restricted update fields per firestore.rules
      await updateDoc(ref, {
        pelapor: fields.pelapor,
        ruangan: fields.ruangan,
        alkesId: fields.alkesId,
        namaAlat: fields.namaAlat,
        merk: fields.merk,
        modelType: fields.modelType,
        serialNumber: fields.serialNumber,
        keluhanKerusakan: fields.keluhanKerusakan,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function addPerbaikanCommentToFirestore(
  perbaikanId: string,
  comment: PerbaikanComment,
  ownerId: string
): Promise<void> {
  const pid = sanitizeFirestoreId(perbaikanId);
  const cid = sanitizeFirestoreId(comment.id);
  const path = `perbaikan/${pid}/comments/${cid}`;
  const ref = doc(db, 'perbaikan', pid, 'comments', cid);
  try {
    const payload: Record<string, unknown> = {
      id: cid,
      perbaikanId: pid,
      senderName: clampString(comment.senderName || 'Petugas', 150, 'Petugas'),
      senderRole: clampString(comment.senderRole || 'user', 40, 'user'),
      message: clampString(comment.message || '-', 2000, '-'),
      ownerId: sanitizeFirestoreId(ownerId),
      createdAt: serverTimestamp(),
    };
    if (comment.senderUsername) payload.senderUsername = clampString(comment.senderUsername, 64);
    if (comment.senderNip) payload.senderNip = clampString(comment.senderNip, 64);
    if (comment.senderRuangan) payload.senderRuangan = clampString(comment.senderRuangan, 100);
    if (comment.statusTag) payload.statusTag = clampString(comment.statusTag, 100);
    await setDoc(ref, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deletePerbaikanFromFirestore(rawId: string): Promise<void> {
  const id = sanitizeFirestoreId(rawId);
  const path = `perbaikan/${id}`;
  try {
    await deleteDoc(doc(db, 'perbaikan', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

function buildBapFields(bap: BeritaAcaraPenarikan) {
  return {
    nomorBap: clampString(bap.nomorBap, 100),
    tanggal: clampString(bap.tanggal || new Date().toISOString().slice(0, 10), 32),
    alkesId: clampString(bap.alkesId || '-', 128, '-'),
    namaAlat: clampString(bap.namaAlat || 'Alat Kesehatan', 200),
    merk: clampString(bap.merk, 150),
    modelType: clampString(bap.modelType, 150),
    serialNumber: clampString(bap.serialNumber, 150),
    tahunPengadaan: clampString(bap.tahunPengadaan || '-', 32),
    ruangan: clampString(bap.ruangan || 'IGD', 100),
    kondisiTerakhir: normalizeKondisi(bap.kondisiTerakhir),
    alasanPenarikan: clampString(bap.alasanPenarikan || '-', 2000, '-'),
    analisaTeknis: clampString(bap.analisaTeknis || '-', 2000, '-'),
    rekomendasiTindakan: clampString(bap.rekomendasiTindakan || 'Penarikan ke Gudang Elektromedis (IPSRS)', 300),
    namaTeknisi: clampString(bap.namaTeknisi || 'Teknisi Elektromedis', 150),
    nipTeknisi: clampString(bap.nipTeknisi, 64),
    namaKepalaRuangan: clampString(bap.namaKepalaRuangan || 'Kepala Ruangan', 150),
    nipKepalaRuangan: clampString(bap.nipKepalaRuangan, 64),
    namaKepalaIpsrs: clampString(bap.namaKepalaIpsrs, 150),
    nipKepalaIpsrs: clampString(bap.nipKepalaIpsrs, 64),
    namaDirektur: clampString(bap.namaDirektur, 150),
    nipDirektur: clampString(bap.nipDirektur, 64),
    ttdTeknisi: clampString(bap.ttdTeknisi, 250000),
    ttdKepalaRuangan: clampString(bap.ttdKepalaRuangan, 250000),
    ttdKepalaIpsrs: clampString(bap.ttdKepalaIpsrs, 250000),
  };
}

export async function saveBapToFirestore(bap: BeritaAcaraPenarikan, ownerId: string): Promise<void> {
  const id = sanitizeFirestoreId(bap.id);
  const path = `beritaAcara/${id}`;
  const ref = doc(db, 'beritaAcara', id);
  try {
    const snap = await getDoc(ref);
    const fields = buildBapFields(bap);
    if (!snap.exists()) {
      await setDoc(ref, {
        id,
        ...fields,
        ownerId: sanitizeFirestoreId(ownerId),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        ...fields,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteBapFromFirestore(rawId: string): Promise<void> {
  const id = sanitizeFirestoreId(rawId);
  const path = `beritaAcara/${id}`;
  try {
    await deleteDoc(doc(db, 'beritaAcara', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveRuanganToFirestore(nama: string, ownerId: string): Promise<void> {
  const cleanName = clampString(nama.trim().toUpperCase(), 100);
  if (!cleanName) return;
  const id = sanitizeFirestoreId(`RUANG_${cleanName}`);
  const path = `ruangan/${id}`;
  const ref = doc(db, 'ruangan', id);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id,
        nama: cleanName,
        ownerId: sanitizeFirestoreId(ownerId),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        nama: cleanName,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteRuanganFromFirestore(nama: string): Promise<void> {
  const id = sanitizeFirestoreId(`RUANG_${nama.trim().toUpperCase()}`);
  const path = `ruangan/${id}`;
  try {
    await deleteDoc(doc(db, 'ruangan', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function migrateSeedDataToFirestore(
  data: {
    inventaris: AlkesItem[];
    pemeliharaan: PemeliharaanItem[];
    perbaikan: PerbaikanItem[];
    beritaAcara: BeritaAcaraPenarikan[];
  },
  ownerId: string
): Promise<number> {
  const cleanOwnerId = sanitizeFirestoreId(ownerId);
  let migrated = 0;

  try {
    // Check if alkes collection already has documents
    const existingAlkesSnap = await getDocs(collection(db, 'alkes'));
    if (!existingAlkesSnap.empty) {
      return 0;
    }

    const ops: Array<{ col: string; id: string; docData: Record<string, unknown> }> = [];

    data.inventaris.forEach((item) => {
      const id = sanitizeFirestoreId(item.id);
      ops.push({
        col: 'alkes',
        id,
        docData: {
          id,
          ...buildAlkesFields(item),
          ownerId: cleanOwnerId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
    });

    data.pemeliharaan.forEach((item) => {
      const id = sanitizeFirestoreId(item.id);
      ops.push({
        col: 'pemeliharaan',
        id,
        docData: {
          id,
          ...buildPemeliharaanFields(item),
          ownerId: cleanOwnerId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
    });

    data.perbaikan.forEach((item) => {
      const id = sanitizeFirestoreId(item.id);
      ops.push({
        col: 'perbaikan',
        id,
        docData: {
          id,
          ...buildPerbaikanFields(item),
          ownerId: cleanOwnerId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
    });

    data.beritaAcara.forEach((bap) => {
      const id = sanitizeFirestoreId(bap.id);
      ops.push({
        col: 'beritaAcara',
        id,
        docData: {
          id,
          ...buildBapFields(bap),
          ownerId: cleanOwnerId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
    });

    // Firestore batch limit is 500 writes per batch
    for (let i = 0; i < ops.length; i += 400) {
      const chunk = ops.slice(i, i + 400);
      const batch = writeBatch(db);
      chunk.forEach((op) => {
        batch.set(doc(db, op.col, op.id), op.docData);
      });
      await batch.commit();
      migrated += chunk.length;
    }

    return migrated;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'alkes');
  }
}

export function subscribeFirestoreCollections(
  userUid: string,
  isBootstrapOrAdmin: boolean,
  callbacks: {
    onAlkes: (items: AlkesItem[]) => void;
    onPemeliharaan: (items: PemeliharaanItem[]) => void;
    onPerbaikan: (items: PerbaikanItem[]) => void;
    onBeritaAcara: (items: BeritaAcaraPenarikan[]) => void;
    onRuangan: (rooms: string[]) => void;
  }
): () => void {
  const unsubscribers: Unsubscribe[] = [];
  const uid = sanitizeFirestoreId(userUid);

  const alkesQuery = isBootstrapOrAdmin
    ? collection(db, 'alkes')
    : query(collection(db, 'alkes'), where('ownerId', '==', uid));

  const ppmQuery = isBootstrapOrAdmin
    ? collection(db, 'pemeliharaan')
    : query(collection(db, 'pemeliharaan'), where('ownerId', '==', uid));

  const perbaikanQuery = isBootstrapOrAdmin
    ? collection(db, 'perbaikan')
    : query(collection(db, 'perbaikan'), where('ownerId', '==', uid));

  const bapQuery = isBootstrapOrAdmin
    ? collection(db, 'beritaAcara')
    : query(collection(db, 'beritaAcara'), where('ownerId', '==', uid));

  const ruanganQuery = isBootstrapOrAdmin
    ? collection(db, 'ruangan')
    : query(collection(db, 'ruangan'), where('ownerId', '==', uid));

  unsubscribers.push(
    onSnapshot(
      alkesQuery,
      (snap) => {
        const items: AlkesItem[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id || d.id),
            ruangan: String(data.ruangan || ''),
            namaAlat: String(data.namaAlat || ''),
            merk: String(data.merk || ''),
            modelType: String(data.modelType || ''),
            serialNumber: String(data.serialNumber || ''),
            tahunPengadaan: String(data.tahunPengadaan || '-'),
            kalibrasiTerakhir: String(data.kalibrasiTerakhir || ''),
            kalibrasiBerikutnya: String(data.kalibrasiBerikutnya || ''),
            statusKalibrasi: normalizeStatusKalibrasi(data.statusKalibrasi),
            kondisi: normalizeKondisi(data.kondisi),
            keterangan: (data.keterangan || 'Berfungsi') as AlkesItem['keterangan'],
            nomorInventaris: String(data.nomorInventaris || '-'),
            lokasiSpesifik: String(data.lokasiSpesifik || '-'),
            lastEditedBy: String(data.lastEditedBy || ''),
            createdAt: toIsoTimestamp(data.createdAt),
            updatedAt: toIsoTimestamp(data.updatedAt),
          };
        });
        callbacks.onAlkes(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'alkes');
      }
    )
  );

  unsubscribers.push(
    onSnapshot(
      ppmQuery,
      (snap) => {
        const items: PemeliharaanItem[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id || d.id),
            tanggal: String(data.tanggal || ''),
            namaTeknisi: String(data.namaTeknisi || ''),
            nipTeknisi: data.nipTeknisi ? String(data.nipTeknisi) : undefined,
            ruangan: String(data.ruangan || ''),
            alkesId: data.alkesId ? String(data.alkesId) : undefined,
            namaAlat: String(data.namaAlat || ''),
            merk: String(data.merk || ''),
            modelType: String(data.modelType || ''),
            serialNumber: String(data.serialNumber || ''),
            kegiatanFisik: Boolean(data.kegiatanFisik),
            kegiatanSetting: Boolean(data.kegiatanSetting),
            kegiatanCleaning: Boolean(data.kegiatanCleaning),
            kondisi: normalizeKondisi(data.kondisi),
            status: normalizeStatusPpm(data.status),
            catatan: data.catatan ? String(data.catatan) : undefined,
            rekomendasi: data.rekomendasi ? String(data.rekomendasi) : undefined,
            createdAt: toIsoTimestamp(data.createdAt),
            updatedAt: toIsoTimestamp(data.updatedAt),
          };
        });
        callbacks.onPemeliharaan(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'pemeliharaan');
      }
    )
  );

  unsubscribers.push(
    onSnapshot(
      perbaikanQuery,
      async (snap) => {
        const items: PerbaikanItem[] = await Promise.all(
          snap.docs.map(async (d) => {
            const data = d.data();
            let comments: PerbaikanComment[] = [];
            try {
              const commentsQuery = isBootstrapOrAdmin
                ? collection(db, 'perbaikan', d.id, 'comments')
                : query(collection(db, 'perbaikan', d.id, 'comments'), where('ownerId', '==', uid));
              const cSnap = await getDocs(commentsQuery);
              comments = cSnap.docs
                .map((cd) => {
                  const cData = cd.data();
                  return {
                    id: String(cData.id || cd.id),
                    perbaikanId: String(cData.perbaikanId || d.id),
                    senderName: String(cData.senderName || ''),
                    senderRole: String(cData.senderRole || 'user'),
                    senderUsername: cData.senderUsername ? String(cData.senderUsername) : undefined,
                    senderNip: cData.senderNip ? String(cData.senderNip) : undefined,
                    senderRuangan: cData.senderRuangan ? String(cData.senderRuangan) : undefined,
                    message: String(cData.message || ''),
                    statusTag: cData.statusTag ? String(cData.statusTag) : undefined,
                    timestamp: toIsoTimestamp(cData.createdAt) || new Date().toISOString(),
                  };
                })
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            } catch {
              // Ignore subcollection read failure on restricted items
            }

            return {
              id: String(data.id || d.id),
              nomorSpk: String(data.nomorSpk || ''),
              tanggal: String(data.tanggal || ''),
              pelapor: String(data.pelapor || ''),
              ruangan: String(data.ruangan || ''),
              alkesId: data.alkesId ? String(data.alkesId) : undefined,
              namaAlat: String(data.namaAlat || ''),
              merk: String(data.merk || ''),
              modelType: String(data.modelType || ''),
              serialNumber: String(data.serialNumber || ''),
              keluhanKerusakan: String(data.keluhanKerusakan || ''),
              analisisTeknisi: String(data.analisisTeknisi || ''),
              tindakanPerbaikan: String(data.tindakanPerbaikan || ''),
              sparepartDiganti: data.sparepartDiganti ? String(data.sparepartDiganti) : undefined,
              biayaEstimasi: typeof data.biayaEstimasi === 'number' ? data.biayaEstimasi : 0,
              teknisiPelaksana: String(data.teknisiPelaksana || ''),
              statusPerbaikan: normalizeStatusPerbaikan(data.statusPerbaikan),
              comments,
              createdAt: toIsoTimestamp(data.createdAt),
              updatedAt: toIsoTimestamp(data.updatedAt),
            };
          })
        );
        callbacks.onPerbaikan(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'perbaikan');
      }
    )
  );

  unsubscribers.push(
    onSnapshot(
      bapQuery,
      (snap) => {
        const items: BeritaAcaraPenarikan[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id || d.id),
            nomorBap: data.nomorBap ? String(data.nomorBap) : undefined,
            tanggal: String(data.tanggal || ''),
            alkesId: String(data.alkesId || '-'),
            namaAlat: String(data.namaAlat || ''),
            merk: String(data.merk || ''),
            modelType: String(data.modelType || ''),
            serialNumber: String(data.serialNumber || ''),
            tahunPengadaan: String(data.tahunPengadaan || '-'),
            ruangan: String(data.ruangan || ''),
            kondisiTerakhir: normalizeKondisi(data.kondisiTerakhir),
            alasanPenarikan: String(data.alasanPenarikan || ''),
            analisaTeknis: String(data.analisaTeknis || ''),
            rekomendasiTindakan: String(data.rekomendasiTindakan || ''),
            namaTeknisi: String(data.namaTeknisi || ''),
            nipTeknisi: String(data.nipTeknisi || ''),
            namaKepalaRuangan: String(data.namaKepalaRuangan || ''),
            nipKepalaRuangan: data.nipKepalaRuangan ? String(data.nipKepalaRuangan) : undefined,
            namaKepalaIpsrs: data.namaKepalaIpsrs ? String(data.namaKepalaIpsrs) : undefined,
            nipKepalaIpsrs: data.nipKepalaIpsrs ? String(data.nipKepalaIpsrs) : undefined,
            namaDirektur: data.namaDirektur ? String(data.namaDirektur) : undefined,
            nipDirektur: data.nipDirektur ? String(data.nipDirektur) : undefined,
            ttdTeknisi: data.ttdTeknisi ? String(data.ttdTeknisi) : undefined,
            ttdKepalaRuangan: data.ttdKepalaRuangan ? String(data.ttdKepalaRuangan) : undefined,
            ttdKepalaIpsrs: data.ttdKepalaIpsrs ? String(data.ttdKepalaIpsrs) : undefined,
            createdAt: toIsoTimestamp(data.createdAt),
          };
        });
        callbacks.onBeritaAcara(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'beritaAcara');
      }
    )
  );

  unsubscribers.push(
    onSnapshot(
      ruanganQuery,
      (snap) => {
        const rooms = snap.docs.map((d) => String(d.data().nama || '')).filter(Boolean);
        if (rooms.length > 0) {
          callbacks.onRuangan(rooms);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'ruangan');
      }
    )
  );

  return () => {
    unsubscribers.forEach((unsub) => {
      try {
        unsub();
      } catch {
        // ignore unsubscribe errors
      }
    });
  };
}
