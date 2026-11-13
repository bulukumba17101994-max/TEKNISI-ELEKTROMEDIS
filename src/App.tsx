import React, { useState, useEffect, useCallback } from 'react';
import {
  AlkesItem,
  ApkNotification,
  BeritaAcaraPenarikan,
  DAFTAR_RUANGAN,
  PemeliharaanItem,
  PerbaikanItem,
  PerbaikanComment,
  StatusPerbaikanType,
  TabMenuType,
  Teknisi,
  TEKNISI_ACCOUNTS,
} from './types';
import {
  INITIAL_ALKES,
  INITIAL_BERITA_ACARA,
  INITIAL_PEMELIHARAAN,
  INITIAL_PERBAIKAN,
  isDemoId,
} from './data/initialData';
import { LoginScreen } from './components/LoginScreen';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { InventarisView } from './components/InventarisView';
import { PemeliharaanView } from './components/PemeliharaanView';
import { PerbaikanView } from './components/PerbaikanView';
import { BeritaAcaraListView, BeritaAcaraModal } from './components/BeritaAcaraModal';
import { AiChatView } from './components/AiChatView';
import { QrScannerModal } from './components/QrScannerModal';
import { RuanganManagementModal } from './components/RuanganManagementModal';
import { ApkNotificationToast } from './components/ApkNotificationToast';
import { GoogleSheetSyncModal } from './components/GoogleSheetSyncModal';
import { Sparkles, Bot } from 'lucide-react';
import {
  loadLocalData,
  saveLocalData,
  subscribeSyncChannel,
  subscribeServerEvents,
  broadcastChange,
  broadcastDelete,
  pullBackendData,
  pushItemToBackend,
  deleteItemFromBackend,
  mergeDatasets,
  recordDeletedId,
  getDeletedIdsMap,
  pushBatchSyncToBackend,
  restoreFromPersistentIndexedDb,
  requestStoragePersistence,
  clearInventarisFromBackend,
  clearLocalInventarisCache,
} from './utils/syncEngine';
import {
  playEmergencyReportSound,
  playWarningSound,
  playSyncSound,
  playMessageSound,
  unlockAudio,
} from './utils/soundAlerts';
import {
  initServiceWorker,
  requestNotificationPermission,
  getNotificationPermissionStatus,
  showSystemNotification,
} from './utils/notificationService';
import { Bell, Volume2, VolumeX, CheckCircle, ShieldAlert, Radio } from 'lucide-react';
import { onAuthStateChanged, signOut, type User as FirebaseUser } from 'firebase/auth';
import { auth, BOOTSTRAP_ADMIN_EMAIL, testConnection } from './firebase';
import {
  addPerbaikanCommentToFirestore,
  checkIsAdminUser,
  clearAllAlkesFromFirestore,
  deleteAlkesFromFirestore,
  deleteBapFromFirestore,
  deletePemeliharaanFromFirestore,
  deletePerbaikanFromFirestore,
  deleteRuanganFromFirestore,
  migrateSeedDataToFirestore,
  saveAlkesToFirestore,
  saveBapToFirestore,
  savePemeliharaanToFirestore,
  savePerbaikanToFirestore,
  saveRuanganToFirestore,
  subscribeFirestoreCollections,
  syncUserProfileToFirestore,
} from './utils/firestoreService';

export const App: React.FC = () => {
  // Theme Mode State (Light / Dark)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('sim_alkes_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('dark', 'light');
      document.documentElement.classList.add(theme);
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('sim_alkes_theme', theme);
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  // Authentication State
  const [currentTeknisi, setCurrentTeknisi] = useState<Teknisi | null>(() => {
    const saved = localStorage.getItem('sim_alkes_teknisi_session');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<TabMenuType>('dashboard');

  // Core Data States with local storage & backend sync fallback
  const [inventaris, setInventaris] = useState<AlkesItem[]>(() =>
    loadLocalData('sim_alkes_inventaris', INITIAL_ALKES)
  );
  const [pemeliharaan, setPemeliharaan] = useState<PemeliharaanItem[]>(() =>
    loadLocalData('sim_alkes_pemeliharaan', INITIAL_PEMELIHARAAN)
  );
  const [perbaikan, setPerbaikan] = useState<PerbaikanItem[]>(() =>
    loadLocalData('sim_alkes_perbaikan', INITIAL_PERBAIKAN)
  );
  const [beritaAcara, setBeritaAcara] = useState<BeritaAcaraPenarikan[]>(() =>
    loadLocalData('sim_alkes_bap', INITIAL_BERITA_ACARA)
  );

  // Sync state indicator
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  // Master Ruangan List with persistent storage fallback
  const [ruanganList, setRuanganList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sim_alkes_daftar_ruangan');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DAFTAR_RUANGAN;
  });

  // Modals
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [isBapModalOpen, setIsBapModalOpen] = useState(false);
  const [isGoogleSheetModalOpen, setIsGoogleSheetModalOpen] = useState(false);
  const [isRuanganModalOpen, setIsRuanganModalOpen] = useState(false);
  const [bapPrefillAlkes, setBapPrefillAlkes] = useState<AlkesItem | null>(null);

  // Sync unique rooms from alkes inventory into ruanganList
  useEffect(() => {
    if (inventaris && inventaris.length > 0) {
      const uniqueRooms = Array.from(new Set(inventaris.map((i) => i.ruangan).filter(Boolean)));
      setRuanganList((prev) => {
        let changed = false;
        const next = [...prev];
        uniqueRooms.forEach((r) => {
          if (!next.some((existing) => existing.toLowerCase() === r.toLowerCase())) {
            next.push(r);
            changed = true;
          }
        });
        if (changed) {
          try {
            localStorage.setItem('sim_alkes_daftar_ruangan', JSON.stringify(next));
          } catch (e) {}
          return next;
        }
        return prev;
      });
    }
  }, [inventaris]);

  const [isPpmModalOpen, setIsPpmModalOpen] = useState(false);
  const [isPerbaikanModalOpen, setIsPerbaikanModalOpen] = useState(false);
  const [isAlkesModalOpen, setIsAlkesModalOpen] = useState(false);
  const [selectedThreadPerbaikan, setSelectedThreadPerbaikan] = useState<PerbaikanItem | null>(null);

  const handleOpenPerbaikanThread = (item: PerbaikanItem) => {
    setSelectedThreadPerbaikan(item);
    setActiveTab('perbaikan');
  };

  // Notifications & Permissions State
  const [notifications, setNotifications] = useState<ApkNotification[]>([]);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [showPermissionBanner, setShowPermissionBanner] = useState(true);

  // Check notification permission on mount and init Service Worker
  useEffect(() => {
    initServiceWorker();
    const status = getNotificationPermissionStatus();
    setNotifPermission(status);
    if (status === 'granted') {
      setShowPermissionBanner(false);
    }
  }, []);

  // Listen to Service Worker navigation messages
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const handleMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'NAVIGATE_TAB' && event.data.tab) {
          setActiveTab(event.data.tab as TabMenuType);
        }
      };
      navigator.serviceWorker.addEventListener('message', handleMessage);
      return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
    }
  }, []);

  // User unlocks sound & grants native system notification permission
  const handleEnableNotifications = async () => {
    unlockAudio();
    const result = await requestNotificationPermission();
    setNotifPermission(result);
    if (result === 'granted') {
      setShowPermissionBanner(false);
      playSyncSound();
      showSystemNotification({
        title: '🔔 NOTIFIKASI REAL-TIME AKTIF!',
        body: 'SIM-ALKES UPTD RSUD LAMADDUKELLENG siap mengirimkan alarm suara & popup kerusakan alkes saat aplikasi aktif atau di latar belakang.',
        tab: 'dashboard',
      });
      addNotification({
        type: 'sync',
        title: 'Notifikasi & Suara Aktif',
        message: 'Izin notifikasi sistem & audio buzzer berhasil diaktifkan untuk HP dan PC ini.',
      });
    }
  };

  const addNotificationRef = React.useRef<
    (notif: Omit<ApkNotification, 'id' | 'timestamp' | 'read'>) => void
  >(() => {});

  // Add Notification Helper with Auto-Sound and Native OS Background Notification
  const addNotification = useCallback(
    (notif: Omit<ApkNotification, 'id' | 'timestamp' | 'read'>) => {
      const newNotif: ApkNotification = {
        ...notif,
        id: `NOTIF-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        read: false,
      };
      setNotifications((prev) => [newNotif, ...prev.slice(0, 4)]);

      // Audio buzzer
      if (isAudioEnabled) {
        if (notif.type === 'perbaikan') {
          playEmergencyReportSound();
        } else if (notif.type === 'penarikan_bap') {
          playWarningSound();
        } else {
          playSyncSound();
        }
      }
    },
    [isAudioEnabled]
  );

  useEffect(() => {
    addNotificationRef.current = addNotification;
  }, [addNotification]);

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Firebase Auth State
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isFirebaseAuthReady, setIsFirebaseAuthReady] = useState(false);
  const [isFirebaseAdmin, setIsFirebaseAdmin] = useState(false);
  const hasMigratedToFirestoreRef = React.useRef(false);
  const hasFirestoreAlkesSnapshotRef = React.useRef(false);
  const hasAutoClearedStaleFirestoreRef = React.useRef(false);

  // Test Firestore connection & track Firebase Auth state
  useEffect(() => {
    testConnection().catch(() => {});
    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          const isAdmin = await checkIsAdminUser(fbUser);
          setIsFirebaseAdmin(isAdmin);
          const { role } = await syncUserProfileToFirestore(fbUser);
          // Ensure currentTeknisi session stays aligned when signed in via Google
          setCurrentTeknisi((prev) => {
            if (prev) return prev;
            if (fbUser.email === BOOTSTRAP_ADMIN_EMAIL || role === 'admin') {
              const adminProfile: Teknisi = {
                ...TEKNISI_ACCOUNTS.adi,
                namaLengkap:
                  fbUser.email === BOOTSTRAP_ADMIN_EMAIL
                    ? TEKNISI_ACCOUNTS.adi.namaLengkap
                    : fbUser.displayName || TEKNISI_ACCOUNTS.adi.namaLengkap,
                email: fbUser.email || TEKNISI_ACCOUNTS.adi.email,
                role: 'admin',
              };
              localStorage.setItem('sim_alkes_teknisi_session', JSON.stringify(adminProfile));
              return adminProfile;
            }
            const userProfile: Teknisi = {
              username: fbUser.uid,
              namaLengkap: fbUser.displayName || fbUser.email || 'Petugas Ruangan',
              gelar: 'Petugas Ruangan',
              nip: 'FIREBASE-USER',
              jabatan: 'Pelapor Kerusakan Alat Kesehatan Ruangan',
              avatarColor: 'bg-blue-700',
              role: 'user',
              email: fbUser.email || '',
            };
            localStorage.setItem('sim_alkes_teknisi_session', JSON.stringify(userProfile));
            return userProfile;
          });
        } catch (err) {
          console.error('Failed to sync Firebase auth profile:', err);
        }
      } else {
        setIsFirebaseAdmin(false);
      }
      setIsFirebaseAuthReady(true);
    });
    return () => unsubscribeAuth();
  }, []);

  // Attach Firestore real-time listeners once auth is ready and user is authenticated
  useEffect(() => {
    if (!isFirebaseAuthReady || !firebaseUser) return;

    const unsubscribeFirestore = subscribeFirestoreCollections(
      firebaseUser.uid,
      isFirebaseAdmin,
      {
        onAlkes: (fsItems) => {
          const clearedAt = Number(localStorage.getItem('sim_alkes_inventaris_cleared_at') || 1794562200000);
          if (fsItems.length > 0) {
            const allPreClear =
              clearedAt > 0 &&
              fsItems.every((item) => {
                const t = new Date(item.updatedAt || item.createdAt || 0).getTime();
                return t > 0 && t <= clearedAt;
              });

            if (allPreClear && isFirebaseAdmin && !hasAutoClearedStaleFirestoreRef.current) {
              hasAutoClearedStaleFirestoreRef.current = true;
              setInventaris([]);
              clearLocalInventarisCache(clearedAt);
              clearAllAlkesFromFirestore(
                firebaseUser.uid,
                firebaseUser.email === BOOTSTRAP_ADMIN_EMAIL,
                clearedAt
              ).catch((err) => console.error('Failed to clear stale Firestore alkes:', err));
              return;
            }

            hasFirestoreAlkesSnapshotRef.current = true;
            setInventaris((prev) => {
              const { merged } = mergeDatasets(isFirebaseAdmin ? [] : prev, fsItems, getDeletedIdsMap());
              saveLocalData('sim_alkes_inventaris', merged);
              return merged;
            });
          } else {
            if (hasFirestoreAlkesSnapshotRef.current || Number(localStorage.getItem('sim_alkes_inventaris_cleared_at') || 0) > 0) {
              setInventaris([]);
              clearLocalInventarisCache();
            }
            if (isFirebaseAdmin && !hasMigratedToFirestoreRef.current) {
              hasMigratedToFirestoreRef.current = true;
              // Seed existing server/local hospital records into Firestore on first admin connect
              pullBackendData()
                .then((serverData) => {
                  const serverClearedAt = Number(serverData?.inventarisClearedAt || 0);
                  const seedInv = serverClearedAt > 0 && (!serverData?.inventaris || serverData.inventaris.length === 0)
                    ? []
                    : (serverData?.inventaris?.length ? serverData.inventaris : inventaris);
                  const seedPpm = serverData?.pemeliharaan?.length ? serverData.pemeliharaan : pemeliharaan;
                  const seedPerb = serverData?.perbaikan?.length ? serverData.perbaikan : perbaikan;
                  const seedBap = serverData?.beritaAcara?.length ? serverData.beritaAcara : beritaAcara;
                  if (
                    seedInv.length > 0 ||
                    seedPpm.length > 0 ||
                    seedPerb.length > 0 ||
                    seedBap.length > 0
                  ) {
                    migrateSeedDataToFirestore(
                      {
                        inventaris: seedInv,
                        pemeliharaan: seedPpm,
                        perbaikan: seedPerb,
                        beritaAcara: seedBap,
                      },
                      firebaseUser.uid
                    ).catch((err) => console.error('Initial Firestore migration failed:', err));
                  }
                })
                .catch(() => {});
            }
          }
        },
        onPemeliharaan: (fsItems) => {
          if (fsItems.length > 0) {
            setPemeliharaan((prev) => {
              const { merged } = mergeDatasets(isFirebaseAdmin ? [] : prev, fsItems, getDeletedIdsMap());
              saveLocalData('sim_alkes_pemeliharaan', merged);
              return merged;
            });
          }
        },
        onPerbaikan: (fsItems) => {
          if (fsItems.length > 0) {
            markPerbaikanIdsSeen(fsItems.map((p) => p.id));
            setPerbaikan((prev) => {
              const { merged } = mergeDatasets(isFirebaseAdmin ? [] : prev, fsItems, getDeletedIdsMap());
              saveLocalData('sim_alkes_perbaikan', merged);
              return merged;
            });
          }
        },
        onBeritaAcara: (fsItems) => {
          if (fsItems.length > 0) {
            setBeritaAcara((prev) => {
              const { merged } = mergeDatasets(isFirebaseAdmin ? [] : prev, fsItems, getDeletedIdsMap());
              saveLocalData('sim_alkes_bap', merged);
              return merged;
            });
          }
        },
        onRuangan: (fsRooms) => {
          if (fsRooms.length > 0) {
            setRuanganList((prev) => {
              const merged = Array.from(new Set([...prev, ...fsRooms]));
              try {
                localStorage.setItem('sim_alkes_daftar_ruangan', JSON.stringify(merged));
              } catch {}
              return merged;
            });
          }
        },
      }
    );

    return () => unsubscribeFirestore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFirebaseAuthReady, firebaseUser, isFirebaseAdmin]);

  // Login handler
  const handleLogin = (teknisi: Teknisi) => {
    setCurrentTeknisi(teknisi);
    unlockAudio();
    localStorage.setItem('sim_alkes_teknisi_session', JSON.stringify(teknisi));
    addNotification({
      type: 'info',
      title: `Selamat Datang, ${teknisi.namaLengkap}`,
      message: `Anda masuk sebagai Teknisi Elektromedis UPTD RSUD LAMADDUKELLENG (${teknisi.nip || 'Elektromedis'}).`,
    });
  };

  // Logout handler
  const handleLogout = () => {
    setCurrentTeknisi(null);
    localStorage.removeItem('sim_alkes_teknisi_session');
    if (auth.currentUser) {
      signOut(auth).catch(() => {});
    }
  };

  // Track known IDs to prevent duplicated notification triggers (persisted across reloads)
  const knownPerbaikanIdsRef = React.useRef<Set<string>>(
    (() => {
      const initialSet = new Set<string>(perbaikan.map((p) => p.id).filter(Boolean));
      try {
        const saved = localStorage.getItem('sim_alkes_seen_perbaikan_ids');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            parsed.forEach((id) => {
              if (typeof id === 'string' && id) initialSet.add(id);
            });
          }
        }
      } catch {}
      return initialSet;
    })()
  );
  const isInitialSyncDoneRef = React.useRef(false);

  const markPerbaikanIdsSeen = useCallback((ids: string[]) => {
    let changed = false;
    ids.forEach((id) => {
      if (id && !knownPerbaikanIdsRef.current.has(id)) {
        knownPerbaikanIdsRef.current.add(id);
        changed = true;
      }
    });
    if (changed) {
      try {
        const trimmed = Array.from(knownPerbaikanIdsRef.current).slice(-500);
        localStorage.setItem('sim_alkes_seen_perbaikan_ids', JSON.stringify(trimmed));
      } catch {}
    }
  }, []);

  // 0. Double-Layer Storage Recovery (ensures data stays intact even if browser purges localStorage after days of inactivity)
  useEffect(() => {
    let isMounted = true;
    requestStoragePersistence().catch(() => {});
    restoreFromPersistentIndexedDb().then((restored) => {
      if (!isMounted || !restored) return;
      if (restored.inventaris && restored.inventaris.length > 0) {
        setInventaris((prev) => (prev.length === 0 ? restored.inventaris! : prev));
      }
      if (restored.pemeliharaan && restored.pemeliharaan.length > 0) {
        setPemeliharaan((prev) => (prev.length === 0 ? restored.pemeliharaan! : prev));
      }
      if (restored.perbaikan && restored.perbaikan.length > 0) {
        markPerbaikanIdsSeen(restored.perbaikan.map((p) => p.id));
        setPerbaikan((prev) => (prev.length === 0 ? restored.perbaikan! : prev));
      }
      if (restored.beritaAcara && restored.beritaAcara.length > 0) {
        setBeritaAcara((prev) => (prev.length === 0 ? restored.beritaAcara! : prev));
      }
    });
    return () => {
      isMounted = false;
    };
  }, [markPerbaikanIdsSeen]);

  // 1. Instant Real-Time Multi-Device SSE Stream Listener (Instant Push < 50ms)
  useEffect(() => {
    const unsubscribeSSE = subscribeServerEvents((event) => {
      if (!event || !event.type) return;

      if (event.type === 'ITEM_SYNC_UPDATE') {
        const { collection, action, item, timestamp } = event;
        if (!item || !item.id) return;

        if (collection === 'perbaikan') {
          const delMap = getDeletedIdsMap();
          const shouldNotify =
            action === 'create' &&
            !knownPerbaikanIdsRef.current.has(item.id) &&
            !delMap[item.id] &&
            !isDemoId(item.id) &&
            item.statusPerbaikan !== 'Selesai (Alat Normal)';

          markPerbaikanIdsSeen([item.id]);

          setPerbaikan((prev) => {
            const exists = prev.some((i) => i.id === item.id);
            const next = exists ? prev.map((i) => (i.id === item.id ? item : i)) : [item, ...prev];
            saveLocalData('sim_alkes_perbaikan', next);
            return next;
          });

          // If truly new active report created on another device
          if (shouldNotify) {
            showSystemNotification({
              title: '🚨 LAPORAN KERUSAKAN ALKES MASUK!',
              body: `[Ruang ${item.ruangan}] ${item.namaAlat} dilaporkan oleh ${item.pelapor}. Keluhan: "${item.keluhanKerusakan}".`,
              tab: 'perbaikan',
            });
            addNotificationRef.current({
              type: 'perbaikan',
              title: '🚨 LAPORAN KERUSAKAN MASUK!',
              message: `[Ruang ${item.ruangan}] ${item.namaAlat} (SN: ${item.serialNumber || '-'}) dilaporkan oleh ${item.pelapor}. Keluhan: "${item.keluhanKerusakan}".`,
            });
          }
        } else if (collection === 'inventaris') {
          setInventaris((prev) => {
            const exists = prev.some((i) => i.id === item.id);
            const next = exists ? prev.map((i) => (i.id === item.id ? item : i)) : [item, ...prev];
            saveLocalData('sim_alkes_inventaris', next);
            return next;
          });

          // If equipment condition changed to Rusak Berat / Penarikan
          if (item.kondisi === 'Rusak Berat' || item.keterangan === 'Penarikan Alat') {
            playWarningSound();
            showSystemNotification({
              title: '⚠️ REKOMENDASI PENARIKAN ALAT',
              body: `Alat ${item.namaAlat} (${item.ruangan}) berstatus Rusak Berat. Perlu penerbitan Berita Acara Penarikan (BAP).`,
              tab: 'beritaAcara',
            });
          }
        } else if (collection === 'pemeliharaan') {
          setPemeliharaan((prev) => {
            const exists = prev.some((i) => i.id === item.id);
            const next = exists ? prev.map((i) => (i.id === item.id ? item : i)) : [item, ...prev];
            saveLocalData('sim_alkes_pemeliharaan', next);
            return next;
          });
        } else if (collection === 'beritaAcara' || collection === 'bap') {
          setBeritaAcara((prev) => {
            const exists = prev.some((i) => i.id === item.id);
            const next = exists ? prev.map((i) => (i.id === item.id ? item : i)) : [item, ...prev];
            saveLocalData('sim_alkes_bap', next);
            return next;
          });
        }

        setLastSyncTime(new Date(timestamp || Date.now()));
      } else if (event.type === 'ITEM_DELETE_UPDATE') {
        const { collection, id } = event;
        recordDeletedId(id);
        if (collection === 'inventaris') {
          setInventaris((prev) => {
            const next = prev.filter((i) => i.id !== id);
            saveLocalData('sim_alkes_inventaris', next);
            return next;
          });
        } else if (collection === 'pemeliharaan') {
          setPemeliharaan((prev) => {
            const next = prev.filter((i) => i.id !== id);
            saveLocalData('sim_alkes_pemeliharaan', next);
            return next;
          });
        } else if (collection === 'perbaikan') {
          setPerbaikan((prev) => {
            const next = prev.filter((i) => i.id !== id);
            saveLocalData('sim_alkes_perbaikan', next);
            return next;
          });
        } else if (collection === 'beritaAcara' || collection === 'bap') {
          setBeritaAcara((prev) => {
            const next = prev.filter((i) => i.id !== id);
            saveLocalData('sim_alkes_bap', next);
            return next;
          });
        }
      } else if (event.type === 'INVENTARIS_CLEARED') {
        setInventaris([]);
        clearLocalInventarisCache(event.clearedAt || Date.now());
        setLastSyncTime(new Date(event.timestamp || Date.now()));
      } else if (event.type === 'BATCH_SYNC_UPDATE' && event.data) {
        if (event.deletedIds && typeof event.deletedIds === 'object') {
          try {
            const currentMap = getDeletedIdsMap();
            Object.assign(currentMap, event.deletedIds);
            localStorage.setItem('sim_alkes_deleted_ids', JSON.stringify(currentMap));
          } catch {}
        }
        const deletedIds = getDeletedIdsMap();
        if (Array.isArray(event.data.inventaris)) {
          const serverClearedAt = Number(event.data.inventarisClearedAt || 0);
          const localClearedAt = Number(localStorage.getItem('sim_alkes_inventaris_cleared_at') || 0);
          if (serverClearedAt > localClearedAt && event.data.inventaris.length === 0) {
            setInventaris([]);
            clearLocalInventarisCache(serverClearedAt);
          } else {
            setInventaris((prev) => {
              const { merged } = mergeDatasets(prev, event.data.inventaris, deletedIds);
              saveLocalData('sim_alkes_inventaris', merged);
              return merged;
            });
          }
        }
        if (Array.isArray(event.data.pemeliharaan)) {
          setPemeliharaan((prev) => {
            const { merged } = mergeDatasets(prev, event.data.pemeliharaan, deletedIds);
            saveLocalData('sim_alkes_pemeliharaan', merged);
            return merged;
          });
        }
        if (Array.isArray(event.data.perbaikan)) {
          markPerbaikanIdsSeen(event.data.perbaikan.map((p: PerbaikanItem) => p.id));
          setPerbaikan((prev) => {
            const { merged } = mergeDatasets(prev, event.data.perbaikan, deletedIds);
            saveLocalData('sim_alkes_perbaikan', merged);
            return merged;
          });
        }
        if (Array.isArray(event.data.beritaAcara)) {
          setBeritaAcara((prev) => {
            const { merged } = mergeDatasets(prev, event.data.beritaAcara, deletedIds);
            saveLocalData('sim_alkes_bap', merged);
            return merged;
          });
        }
        setLastSyncTime(new Date(event.timestamp || Date.now()));
      }
    });

    return () => unsubscribeSSE();
  }, [markPerbaikanIdsSeen]);

  // 2. Active Resilient Sync & Polling Engine: Bidirectional Merge (Never Deletes Local Data)
  useEffect(() => {
    let isMounted = true;

    const performSync = async () => {
      try {
        const serverData = await pullBackendData();
        if (!serverData || !isMounted) return;

        const deletedIds = getDeletedIdsMap();

        // 1. Merge Inventaris with Anti-Wipe Guard & Explicit Clear Guard
        let pushInventaris: AlkesItem[] = [];
        const serverClearedAt = Number(serverData.inventarisClearedAt || 0);
        const localClearedAt = Number(localStorage.getItem('sim_alkes_inventaris_cleared_at') || 0);
        if (serverClearedAt > localClearedAt && (!serverData.inventaris || serverData.inventaris.length === 0)) {
          clearLocalInventarisCache(serverClearedAt);
          setInventaris([]);
        } else {
          setInventaris((prev) => {
            // Guard: If server returned empty list but local state has items (not cleared), do NOT wipe local items!
            if ((!serverData.inventaris || serverData.inventaris.length === 0) && prev.length > 0) {
              if (serverClearedAt > 0) {
                const newerLocal = prev.filter(
                  (it) => new Date(it.updatedAt || it.createdAt || 0).getTime() > serverClearedAt
                );
                if (newerLocal.length === 0) {
                  clearLocalInventarisCache(serverClearedAt);
                  return [];
                }
                pushInventaris = newerLocal;
                return newerLocal;
              }
              pushInventaris = prev;
              return prev;
            }
            const { merged, pendingToPush } = mergeDatasets(prev, serverData.inventaris || [], deletedIds);
            pushInventaris = pendingToPush;
            saveLocalData('sim_alkes_inventaris', merged);
            return merged;
          });
        }

        // 2. Merge Pemeliharaan with Anti-Wipe Guard
        let pushPpm: PemeliharaanItem[] = [];
        setPemeliharaan((prev) => {
          if ((!serverData.pemeliharaan || serverData.pemeliharaan.length === 0) && prev.length > 0) {
            pushPpm = prev;
            return prev;
          }
          const { merged, pendingToPush } = mergeDatasets(prev, serverData.pemeliharaan || [], deletedIds);
          pushPpm = pendingToPush;
          saveLocalData('sim_alkes_pemeliharaan', merged);
          return merged;
        });

        // 3. Merge Perbaikan with Anti-Wipe Guard & Pure Notification Check (outside React updater)
        const serverPerbaikanList: PerbaikanItem[] = Array.isArray(serverData.perbaikan)
          ? serverData.perbaikan
          : [];
        const newReportsToNotify = isInitialSyncDoneRef.current
          ? serverPerbaikanList.filter(
              (p) =>
                p &&
                p.id &&
                !knownPerbaikanIdsRef.current.has(p.id) &&
                !deletedIds[p.id] &&
                !isDemoId(p.id) &&
                p.statusPerbaikan !== 'Selesai (Alat Normal)'
            )
          : [];

        // Mark ALL incoming server perbaikan IDs as seen synchronously so deleted/old items never loop
        markPerbaikanIdsSeen(serverPerbaikanList.map((p) => p.id));

        let pushPerbaikan: PerbaikanItem[] = [];
        setPerbaikan((prev) => {
          if (serverPerbaikanList.length === 0 && prev.length > 0) {
            pushPerbaikan = prev;
            return prev;
          }
          const { merged, pendingToPush } = mergeDatasets(prev, serverPerbaikanList, deletedIds);
          pushPerbaikan = pendingToPush;
          saveLocalData('sim_alkes_perbaikan', merged);
          return merged;
        });

        if (newReportsToNotify.length > 0) {
          newReportsToNotify.forEach((item) => {
            showSystemNotification({
              title: '🚨 LAPORAN KERUSAKAN MASUK!',
              body: `[Ruang ${item.ruangan}] ${item.namaAlat} dilaporkan oleh ${item.pelapor}. Keluhan: "${item.keluhanKerusakan}".`,
              tab: 'perbaikan',
            });
            addNotificationRef.current({
              type: 'perbaikan',
              title: '🚨 LAPORAN KERUSAKAN MASUK!',
              message: `[Ruang ${item.ruangan}] ${item.namaAlat} (SN: ${item.serialNumber || '-'}) dilaporkan oleh ${item.pelapor}. Keluhan: "${item.keluhanKerusakan}".`,
            });
          });
        }

        // 4. Merge Berita Acara with Anti-Wipe Guard
        let pushBap: BeritaAcaraPenarikan[] = [];
        setBeritaAcara((prev) => {
          if ((!serverData.beritaAcara || serverData.beritaAcara.length === 0) && prev.length > 0) {
            pushBap = prev;
            return prev;
          }
          const { merged, pendingToPush } = mergeDatasets(prev, serverData.beritaAcara || [], deletedIds);
          pushBap = pendingToPush;
          saveLocalData('sim_alkes_bap', merged);
          return merged;
        });

        // 5. If local client has unpushed items, push them to server to persist permanently
        if (
          pushInventaris.length > 0 ||
          pushPpm.length > 0 ||
          pushPerbaikan.length > 0 ||
          pushBap.length > 0
        ) {
          pushBatchSyncToBackend({
            inventaris: pushInventaris,
            pemeliharaan: pushPpm,
            perbaikan: pushPerbaikan,
            beritaAcara: pushBap,
          });
        }

        isInitialSyncDoneRef.current = true;
        setLastSyncTime(new Date());
      } catch (err) {
        // network or idle
      }
    };

    // Initial pull immediately
    performSync();

    // Re-sync on window focus (user switches back to tab or reopens device after days)
    const handleFocus = () => performSync();
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleFocus);

    // Polling timer
    const interval = setInterval(performSync, 4000);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleFocus);
      clearInterval(interval);
    };
  }, [markPerbaikanIdsSeen]);

  // 3. Listen to cross-tab BroadcastChannel
  useEffect(() => {
    const unsubscribe = subscribeSyncChannel((event) => {
      const { type, payload } = event;
      if (type === 'delete_inventaris') {
        setInventaris((prev) => {
          const next = prev.filter((i) => i.id !== payload.id);
          saveLocalData('sim_alkes_inventaris', next);
          return next;
        });
      } else if (type === 'delete_pemeliharaan') {
        setPemeliharaan((prev) => {
          const next = prev.filter((p) => p.id !== payload.id);
          saveLocalData('sim_alkes_pemeliharaan', next);
          return next;
        });
      } else if (type === 'delete_perbaikan') {
        setPerbaikan((prev) => {
          const next = prev.filter((p) => p.id !== payload.id);
          saveLocalData('sim_alkes_perbaikan', next);
          return next;
        });
        markPerbaikanIdsSeen([payload.id]);
      } else if (type === 'delete_bap') {
        setBeritaAcara((prev) => {
          const next = prev.filter((b) => b.id !== payload.id);
          saveLocalData('sim_alkes_bap', next);
          return next;
        });
      } else if (type === 'inventaris') {
        setInventaris((prev) => {
          const exists = prev.some((i) => i.id === payload.id);
          const next = exists ? prev.map((i) => (i.id === payload.id ? payload : i)) : [payload, ...prev];
          saveLocalData('sim_alkes_inventaris', next);
          return next;
        });
      } else if (type === 'pemeliharaan') {
        setPemeliharaan((prev) => {
          const exists = prev.some((i) => i.id === payload.id);
          const next = exists ? prev.map((i) => (i.id === payload.id ? payload : i)) : [payload, ...prev];
          saveLocalData('sim_alkes_pemeliharaan', next);
          return next;
        });
      } else if (type === 'perbaikan') {
        setPerbaikan((prev) => {
          const exists = prev.some((i) => i.id === payload.id);
          const next = exists ? prev.map((i) => (i.id === payload.id ? payload : i)) : [payload, ...prev];
          saveLocalData('sim_alkes_perbaikan', next);
          return next;
        });
        markPerbaikanIdsSeen([payload.id]);
      } else if (type === 'bap') {
        setBeritaAcara((prev) => {
          const exists = prev.some((i) => i.id === payload.id);
          const next = exists ? prev.map((i) => (i.id === payload.id ? payload : i)) : [payload, ...prev];
          saveLocalData('sim_alkes_bap', next);
          return next;
        });
      }

      setLastSyncTime(new Date());
    });

    return () => unsubscribe();
  }, [markPerbaikanIdsSeen]);

  // Ruangan Management Handlers (Tambah, Edit, Hapus, & Reset)
  const handleAddRuangan = (newRoom: string) => {
    const trimmed = newRoom.trim().toUpperCase();
    if (!trimmed) return;
    if (ruanganList.some((r) => r.toLowerCase() === trimmed.toLowerCase())) return;

    const nextRooms = [...ruanganList, trimmed];
    setRuanganList(nextRooms);
    try {
      localStorage.setItem('sim_alkes_daftar_ruangan', JSON.stringify(nextRooms));
    } catch (e) {}
    if (firebaseUser && isFirebaseAdmin) {
      saveRuanganToFirestore(trimmed, firebaseUser.uid).catch((err) =>
        console.error('Failed to save ruangan to Firestore:', err)
      );
    }
    addNotification({
      type: 'info',
      title: 'Ruangan Ditambahkan',
      message: `Ruangan "${trimmed}" berhasil didaftarkan ke seluruh menu aplikasi.`,
    });
  };

  const handleRenameRuangan = (oldName: string, newName: string) => {
    const trimmed = newName.trim().toUpperCase();
    if (!trimmed || oldName === trimmed) return;

    // 1. Update ruanganList
    const nextRooms = ruanganList.map((r) => (r === oldName ? trimmed : r));
    setRuanganList(nextRooms);
    try {
      localStorage.setItem('sim_alkes_daftar_ruangan', JSON.stringify(nextRooms));
    } catch (e) {}

    // 2. Cascade rename in inventaris
    let changedAlkes = false;
    const nextInventaris = inventaris.map((item) => {
      if (item.ruangan === oldName) {
        changedAlkes = true;
        return { ...item, ruangan: trimmed, updatedAt: new Date().toISOString() };
      }
      return item;
    });
    if (changedAlkes) {
      setInventaris(nextInventaris);
      saveLocalData('sim_alkes_inventaris', nextInventaris);
    }

    // 3. Cascade rename in pemeliharaan
    let changedPpm = false;
    const nextPemeliharaan = pemeliharaan.map((item) => {
      if (item.ruangan === oldName) {
        changedPpm = true;
        return { ...item, ruangan: trimmed, updatedAt: new Date().toISOString() };
      }
      return item;
    });
    if (changedPpm) {
      setPemeliharaan(nextPemeliharaan);
      saveLocalData('sim_alkes_pemeliharaan', nextPemeliharaan);
    }

    // 4. Cascade rename in perbaikan
    let changedPerbaikan = false;
    const nextPerbaikan = perbaikan.map((item) => {
      if (item.ruangan === oldName) {
        changedPerbaikan = true;
        return { ...item, ruangan: trimmed, updatedAt: new Date().toISOString() };
      }
      return item;
    });
    if (changedPerbaikan) {
      setPerbaikan(nextPerbaikan);
      saveLocalData('sim_alkes_perbaikan', nextPerbaikan);
    }

    // 5. Cascade rename in beritaAcara
    let changedBap = false;
    const nextBap = beritaAcara.map((item) => {
      if (item.ruangan === oldName) {
        changedBap = true;
        return { ...item, ruangan: trimmed, updatedAt: new Date().toISOString() };
      }
      return item;
    });
    if (changedBap) {
      setBeritaAcara(nextBap);
      saveLocalData('sim_alkes_bap', nextBap);
    }

    // Push batch updates if any records changed
    if (changedAlkes || changedPpm || changedPerbaikan || changedBap) {
      pushBatchSyncToBackend({
        inventaris: changedAlkes ? nextInventaris : undefined,
        pemeliharaan: changedPpm ? nextPemeliharaan : undefined,
        perbaikan: changedPerbaikan ? nextPerbaikan : undefined,
        beritaAcara: changedBap ? nextBap : undefined,
      });
    }

    if (firebaseUser && isFirebaseAdmin) {
      deleteRuanganFromFirestore(oldName).catch(() => {});
      saveRuanganToFirestore(trimmed, firebaseUser.uid).catch(() => {});
      if (changedAlkes) {
        nextInventaris
          .filter((i) => i.ruangan === trimmed)
          .forEach((i) => saveAlkesToFirestore(i, firebaseUser.uid).catch(() => {}));
      }
      if (changedPpm) {
        nextPemeliharaan
          .filter((i) => i.ruangan === trimmed)
          .forEach((i) => savePemeliharaanToFirestore(i, firebaseUser.uid).catch(() => {}));
      }
      if (changedPerbaikan) {
        nextPerbaikan
          .filter((i) => i.ruangan === trimmed)
          .forEach((i) => savePerbaikanToFirestore(i, firebaseUser.uid, true).catch(() => {}));
      }
      if (changedBap) {
        nextBap
          .filter((i) => i.ruangan === trimmed)
          .forEach((i) => saveBapToFirestore(i, firebaseUser.uid).catch(() => {}));
      }
    }

    addNotification({
      type: 'info',
      title: 'Ruangan Diubah',
      message: `Ruangan "${oldName}" diubah menjadi "${trimmed}" dan seluruh data terkait telah disinkronkan.`,
    });
  };

  const handleDeleteRuangan = (roomToDelete: string, targetReassignRoom?: string) => {
    // 1. Remove from ruanganList
    const nextRooms = ruanganList.filter((r) => r !== roomToDelete);
    setRuanganList(nextRooms);
    try {
      localStorage.setItem('sim_alkes_daftar_ruangan', JSON.stringify(nextRooms));
    } catch (e) {}

    // 2. Reassign if targetReassignRoom provided
    if (targetReassignRoom) {
      let changedAlkes = false;
      const nextInventaris = inventaris.map((item) => {
        if (item.ruangan === roomToDelete) {
          changedAlkes = true;
          return { ...item, ruangan: targetReassignRoom, updatedAt: new Date().toISOString() };
        }
        return item;
      });
      if (changedAlkes) {
        setInventaris(nextInventaris);
        saveLocalData('sim_alkes_inventaris', nextInventaris);
      }

      let changedPpm = false;
      const nextPemeliharaan = pemeliharaan.map((item) => {
        if (item.ruangan === roomToDelete) {
          changedPpm = true;
          return { ...item, ruangan: targetReassignRoom, updatedAt: new Date().toISOString() };
        }
        return item;
      });
      if (changedPpm) {
        setPemeliharaan(nextPemeliharaan);
        saveLocalData('sim_alkes_pemeliharaan', nextPemeliharaan);
      }

      let changedPerbaikan = false;
      const nextPerbaikan = perbaikan.map((item) => {
        if (item.ruangan === roomToDelete) {
          changedPerbaikan = true;
          return { ...item, ruangan: targetReassignRoom, updatedAt: new Date().toISOString() };
        }
        return item;
      });
      if (changedPerbaikan) {
        setPerbaikan(nextPerbaikan);
        saveLocalData('sim_alkes_perbaikan', nextPerbaikan);
      }

      let changedBap = false;
      const nextBap = beritaAcara.map((item) => {
        if (item.ruangan === roomToDelete) {
          changedBap = true;
          return { ...item, ruangan: targetReassignRoom, updatedAt: new Date().toISOString() };
        }
        return item;
      });
      if (changedBap) {
        setBeritaAcara(nextBap);
        saveLocalData('sim_alkes_bap', nextBap);
      }

      pushBatchSyncToBackend({
        inventaris: changedAlkes ? nextInventaris : undefined,
        pemeliharaan: changedPpm ? nextPemeliharaan : undefined,
        perbaikan: changedPerbaikan ? nextPerbaikan : undefined,
        beritaAcara: changedBap ? nextBap : undefined,
      });

      if (firebaseUser && isFirebaseAdmin) {
        if (changedAlkes) {
          nextInventaris
            .filter((i) => i.ruangan === targetReassignRoom)
            .forEach((i) => saveAlkesToFirestore(i, firebaseUser.uid).catch(() => {}));
        }
        if (changedPpm) {
          nextPemeliharaan
            .filter((i) => i.ruangan === targetReassignRoom)
            .forEach((i) => savePemeliharaanToFirestore(i, firebaseUser.uid).catch(() => {}));
        }
        if (changedPerbaikan) {
          nextPerbaikan
            .filter((i) => i.ruangan === targetReassignRoom)
            .forEach((i) => savePerbaikanToFirestore(i, firebaseUser.uid, true).catch(() => {}));
        }
        if (changedBap) {
          nextBap
            .filter((i) => i.ruangan === targetReassignRoom)
            .forEach((i) => saveBapToFirestore(i, firebaseUser.uid).catch(() => {}));
        }
      }
    }

    if (firebaseUser && isFirebaseAdmin) {
      deleteRuanganFromFirestore(roomToDelete).catch(() => {});
    }

    addNotification({
      type: 'info',
      title: 'Ruangan Dihapus',
      message: `Ruangan "${roomToDelete}" telah dihapus${targetReassignRoom ? ` dan datanya dialihkan ke "${targetReassignRoom}"` : ''}.`,
    });
  };

  const handleResetDefaultRuangan = () => {
    setRuanganList((prev) => {
      const merged = Array.from(new Set([...prev, ...DAFTAR_RUANGAN]));
      try {
        localStorage.setItem('sim_alkes_daftar_ruangan', JSON.stringify(merged));
      } catch (e) {}
      return merged;
    });
    addNotification({
      type: 'info',
      title: 'Standar Ruangan Dipulihkan',
      message: 'Daftar 28 ruangan standar UPTD RSUD LAMADDUKELLENG berhasil dipulihkan.',
    });
  };

  // Handler: Save Alkes (Inventaris)
  const handleSaveAlkes = (item: AlkesItem, isEdit: boolean) => {
    let nextList: AlkesItem[];
    if (isEdit) {
      nextList = inventaris.map((i) => (i.id === item.id ? item : i));
    } else {
      nextList = [item, ...inventaris];
    }
    setInventaris(nextList);
    saveLocalData('sim_alkes_inventaris', nextList);
    broadcastChange('inventaris', item);
    pushItemToBackend('inventaris', item);
    if (firebaseUser && isFirebaseAdmin) {
      saveAlkesToFirestore(item, firebaseUser.uid).catch((err) =>
        console.error('Failed to save Alkes to Firestore:', err)
      );
    }

    // CRITICAL USER REQUIREMENT:
    // "apabila dipilih Penarikan alat Maka muncul notifikasi di akun teknisi berbunyi
    // (tolong buatkan berita acara Penarikan alat) lengkap dengan berita acara penarikan"
    if (item.keterangan === 'Penarikan Alat') {
      setBapPrefillAlkes(item);
      addNotification({
        type: 'penarikan_bap',
        title: 'PERINGATAN PENARIKAN ALKES',
        message: `(Tolong buatkan berita acara Penarikan alat) untuk "${item.namaAlat}" - ${item.ruangan}.`,
        alkesPayload: item,
      });
      setIsBapModalOpen(true);
    } else {
      addNotification({
        type: 'info',
        title: isEdit ? 'Alkes Berhasil Diperbarui' : 'Alkes Berhasil Ditambahkan',
        message: `${item.namaAlat} (${item.serialNumber}) tersimpan di ${item.ruangan}.`,
      });
    }
  };

  // Handler: Delete Alkes
  const handleDeleteAlkes = (id: string) => {
    recordDeletedId(id);
    const nextList = inventaris.filter((i) => i.id !== id);
    setInventaris(nextList);
    saveLocalData('sim_alkes_inventaris', nextList, true);
    broadcastDelete('inventaris', id);
    deleteItemFromBackend('inventaris', id);
    if (firebaseUser && isFirebaseAdmin) {
      deleteAlkesFromFirestore(id).catch((err) =>
        console.error('Failed to delete Alkes from Firestore:', err)
      );
    }
    addNotification({
      type: 'info',
      title: 'Alkes Dihapus',
      message: 'Data inventaris alat kesehatan telah dihapus dari seluruh device dan spreadsheet.',
    });
  };

  // Handler: Clear All Inventaris
  const handleClearAllAlkes = async () => {
    const now = Date.now();
    setInventaris([]);
    clearLocalInventarisCache(now);
    await clearInventarisFromBackend();
    if (firebaseUser && isFirebaseAdmin) {
      try {
        await clearAllAlkesFromFirestore(
          firebaseUser.uid,
          firebaseUser.email === BOOTSTRAP_ADMIN_EMAIL
        );
      } catch (err) {
        console.error('Failed to clear all Alkes from Firestore:', err);
      }
    }
    addNotification({
      type: 'info',
      title: 'Data Inventaris Dikosongkan',
      message: 'Seluruh data inventaris alat kesehatan telah dikosongkan dari sistem dan database.',
    });
  };

  // Handler: Save PPM
  const handleSavePpm = (item: PemeliharaanItem, isEdit: boolean) => {
    let nextList: PemeliharaanItem[];
    if (isEdit) {
      nextList = pemeliharaan.map((p) => (p.id === item.id ? item : p));
    } else {
      nextList = [item, ...pemeliharaan];
    }
    setPemeliharaan(nextList);
    saveLocalData('sim_alkes_pemeliharaan', nextList);
    broadcastChange('pemeliharaan', item);
    pushItemToBackend('pemeliharaan', item);
    if (firebaseUser && isFirebaseAdmin) {
      savePemeliharaanToFirestore(item, firebaseUser.uid).catch((err) =>
        console.error('Failed to save PPM to Firestore:', err)
      );
    }

    addNotification({
      type: 'ppm',
      title: isEdit ? 'Lembar PPM Diperbarui' : 'Lembar PPM Disimpan',
      message: `Kegiatan pemeliharaan ${item.namaAlat} (${item.ruangan}) berhasil dicatat.`,
    });
  };

  // Handler: Delete PPM
  const handleDeletePpm = (id: string) => {
    recordDeletedId(id);
    const nextList = pemeliharaan.filter((p) => p.id !== id);
    setPemeliharaan(nextList);
    saveLocalData('sim_alkes_pemeliharaan', nextList);
    broadcastDelete('pemeliharaan', id);
    deleteItemFromBackend('pemeliharaan', id);
    if (firebaseUser && isFirebaseAdmin) {
      deletePemeliharaanFromFirestore(id).catch((err) =>
        console.error('Failed to delete PPM from Firestore:', err)
      );
    }
    addNotification({
      type: 'info',
      title: 'Lembar PPM Dihapus',
      message: 'Riwayat pemeliharaan PPM telah dihapus dari seluruh device dan spreadsheet.',
    });
  };

  // Handler: Save Perbaikan
  const handleSavePerbaikan = (item: PerbaikanItem, isEdit: boolean) => {
    let nextList: PerbaikanItem[];
    if (isEdit) {
      nextList = perbaikan.map((p) => (p.id === item.id ? item : p));
    } else {
      nextList = [item, ...perbaikan];
    }
    setPerbaikan(nextList);
    saveLocalData('sim_alkes_perbaikan', nextList);
    markPerbaikanIdsSeen([item.id]);
    broadcastChange('perbaikan', item);
    pushItemToBackend('perbaikan', item);
    if (firebaseUser) {
      savePerbaikanToFirestore(item, firebaseUser.uid, isFirebaseAdmin).catch((err) =>
        console.error('Failed to save Perbaikan to Firestore:', err)
      );
    }

    // Sync state of inventaris if linked
    if (item.alkesId) {
      const matchingAlkes = inventaris.find((i) => i.id === item.alkesId);
      if (matchingAlkes) {
        let updatedKondisi = matchingAlkes.kondisi;
        let updatedKeterangan = matchingAlkes.keterangan;

        if (item.statusPerbaikan === 'Selesai (Alat Normal)') {
          updatedKondisi = 'Baik';
          updatedKeterangan = 'Berfungsi';
        } else if (item.statusPerbaikan === 'Rekomendasi Penarikan') {
          updatedKondisi = 'Rusak Berat';
          updatedKeterangan = 'Penarikan Alat';
        } else {
          if (matchingAlkes.kondisi === 'Baik') updatedKondisi = 'Rusak Ringan';
          updatedKeterangan = 'Perlu penggantian sparepart';
        }

        if (updatedKondisi !== matchingAlkes.kondisi || updatedKeterangan !== matchingAlkes.keterangan) {
          const updatedAlkes: AlkesItem = {
            ...matchingAlkes,
            kondisi: updatedKondisi,
            keterangan: updatedKeterangan,
            updatedAt: new Date().toISOString(),
          };
          const nextInventaris = inventaris.map((i) => (i.id === matchingAlkes.id ? updatedAlkes : i));
          setInventaris(nextInventaris);
          saveLocalData('sim_alkes_inventaris', nextInventaris);
          broadcastChange('inventaris', updatedAlkes);
          pushItemToBackend('inventaris', updatedAlkes);
          if (firebaseUser && isFirebaseAdmin) {
            saveAlkesToFirestore(updatedAlkes, firebaseUser.uid).catch((err) =>
              console.error('Failed to update linked Alkes in Firestore:', err)
            );
          }
        }
      }
    }

    if (currentTeknisi?.role === 'user') {
      addNotification({
        type: 'perbaikan',
        title: '✅ Laporan Kerusakan Terkirim!',
        message: `Laporan kerusakan ${item.namaAlat} (${item.ruangan}) berhasil dikirim ke Teknisi Elektromedis IPSRS IPSRS UPTD RSUD LAMADDUKELLENG dan tersinkronisasi otomatis.`,
      });
    } else {
      addNotification({
        type: 'perbaikan',
        title: isEdit ? 'SPK Perbaikan Diperbarui' : 'SPK Perbaikan Dibuat',
        message: `${item.nomorSpk} - ${item.namaAlat} (${item.statusPerbaikan}) tersimpan dan tersinkronisasi.`,
      });
    }
  };

  // Handler: Delete Perbaikan
  const handleDeletePerbaikan = (id: string) => {
    recordDeletedId(id);
    const nextList = perbaikan.filter((p) => p.id !== id);
    setPerbaikan(nextList);
    saveLocalData('sim_alkes_perbaikan', nextList);
    knownPerbaikanIdsRef.current.delete(id);
    broadcastDelete('perbaikan', id);
    deleteItemFromBackend('perbaikan', id);
    if (firebaseUser && isFirebaseAdmin) {
      deletePerbaikanFromFirestore(id).catch((err) =>
        console.error('Failed to delete Perbaikan from Firestore:', err)
      );
    }
    addNotification({
      type: 'info',
      title: 'Laporan Perbaikan Dihapus',
      message: 'Data laporan perbaikan telah dihapus dari seluruh device dan spreadsheet.',
    });
  };

  // Handler: Add comment to perbaikan report thread
  const handleAddPerbaikanComment = (
    perbaikanId: string,
    comment: PerbaikanComment,
    updatedStatus?: StatusPerbaikanType
  ) => {
    const targetItem = perbaikan.find((p) => p.id === perbaikanId);
    if (!targetItem) return;

    const existingComments = targetItem.comments || [];
    const updatedComments = [...existingComments, comment];

    const updatedItem: PerbaikanItem = {
      ...targetItem,
      comments: updatedComments,
      statusPerbaikan: updatedStatus || targetItem.statusPerbaikan,
      updatedAt: new Date().toISOString(),
    };

    handleSavePerbaikan(updatedItem, true);

    if (firebaseUser) {
      addPerbaikanCommentToFirestore(perbaikanId, comment, firebaseUser.uid).catch((err) =>
        console.error('Failed to save comment to Firestore:', err)
      );
    }

    unlockAudio();
    playMessageSound();

    const isSenderTeknisi = comment.senderRole === 'teknisi' || comment.senderRole === 'admin';
    addNotification({
      type: 'perbaikan',
      title: isSenderTeknisi
        ? `💬 Tanggapan Teknisi: ${targetItem.namaAlat}`
        : `💬 Komentar Ruangan (${targetItem.ruangan}): ${targetItem.namaAlat}`,
      message: `${comment.senderName}: "${comment.message.slice(0, 80)}${
        comment.message.length > 80 ? '...' : ''
      }"`,
    });
  };

  // Handler: Quick status update for perbaikan report
  const handleUpdatePerbaikanStatus = (perbaikanId: string, status: StatusPerbaikanType) => {
    const targetItem = perbaikan.find((p) => p.id === perbaikanId);
    if (!targetItem) return;

    const updatedItem: PerbaikanItem = {
      ...targetItem,
      statusPerbaikan: status,
      updatedAt: new Date().toISOString(),
    };

    handleSavePerbaikan(updatedItem, true);

    addNotification({
      type: 'perbaikan',
      title: `Status Diperbarui: ${targetItem.nomorSpk}`,
      message: `Status perbaikan ${targetItem.namaAlat} (${targetItem.ruangan}) kini: "${status}".`,
    });
  };

  // Handler: Save BAP
  const handleSaveBap = (bap: BeritaAcaraPenarikan) => {
    const exists = beritaAcara.some((b) => b.id === bap.id);
    const nextList = exists ? beritaAcara.map((b) => (b.id === bap.id ? bap : b)) : [bap, ...beritaAcara];
    setBeritaAcara(nextList);
    saveLocalData('sim_alkes_bap', nextList);
    broadcastChange('bap', bap);
    pushItemToBackend('bap', bap);
    if (firebaseUser && isFirebaseAdmin) {
      saveBapToFirestore(bap, firebaseUser.uid).catch((err) =>
        console.error('Failed to save BAP to Firestore:', err)
      );
    }

    addNotification({
      type: 'info',
      title: 'Berita Acara (BAP) Berhasil Dibuat',
      message: `Berita Acara Penarikan untuk alat ${bap.namaAlat} berhasil dicetak dan diarsipkan.`,
    });
  };

  const handleDeleteBap = (id: string) => {
    recordDeletedId(id);
    const nextList = beritaAcara.filter((b) => b.id !== id);
    setBeritaAcara(nextList);
    saveLocalData('sim_alkes_bap', nextList);
    broadcastDelete('bap', id);
    deleteItemFromBackend('bap', id);
    if (firebaseUser && isFirebaseAdmin) {
      deleteBapFromFirestore(id).catch((err) =>
        console.error('Failed to delete BAP from Firestore:', err)
      );
    }
    addNotification({
      type: 'info',
      title: 'Berita Acara Dihapus',
      message: 'Dokumen Berita Acara Penarikan telah dihapus dari seluruh device dan spreadsheet.',
    });
  };

  // QR Code scanned item action
  const handleQrSelectAlkes = (alkes: AlkesItem, action?: 'view' | 'ppm' | 'perbaikan') => {
    if (action === 'ppm') {
      setActiveTab('pemeliharaan');
      setIsPpmModalOpen(true);
    } else if (action === 'perbaikan') {
      setActiveTab('perbaikan');
      setIsPerbaikanModalOpen(true);
    } else {
      setActiveTab('inventaris');
    }
  };

  // If not authenticated, show Login Screen
  if (!currentTeknisi) {
    return (
      <div className={`min-h-screen ${theme === 'light' ? 'bg-slate-50 text-black' : 'bg-black text-white'} selection:bg-red-600 selection:text-white`}>
        <LoginScreen onLoginSuccess={handleLogin} theme={theme} toggleTheme={toggleTheme} />
      </div>
    );
  }

  return (
    <div
      id="sim-alkes-app"
      className={`min-h-screen flex flex-col font-sans selection:bg-red-600 selection:text-white transition-colors ${
        theme === 'light' ? 'bg-slate-50 text-black' : 'bg-black text-zinc-100'
      }`}
    >
      {/* Top Navbar */}
      <Navbar
        currentTeknisi={currentTeknisi}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        onOpenQrScanner={() => setIsQrScannerOpen(true)}
        onOpenSyncModal={() => setIsGoogleSheetModalOpen(true)}
        notifications={notifications as any}
        onOpenNotifications={() => {
          setNotifications((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })));
        }}
        isSyncing={isSyncing}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      {/* Real-time Push & Sound Activation Bar */}
      {showPermissionBanner && notifPermission !== 'granted' && (
        <div className="bg-gradient-to-r from-red-950 via-zinc-900 to-red-950 border-b border-red-800/80 px-4 py-2.5 text-xs text-zinc-200">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-center sm:text-left">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-red-600/30 border border-red-500 text-red-400 animate-pulse">
                <Bell className="h-4 w-4" />
              </span>
              <div>
                <span className="font-black text-white">Aktifkan Notifikasi & Alarm Real-Time (HP & PC):</span>{' '}
                <span className="text-zinc-300">
                  Dapatkan bunyi alarm & popup saat ada laporan kerusakan alkes baru, meskipun aplikasi ditutup / berjalan di latar belakang.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                id="btn-enable-system-notifications"
                onClick={handleEnableNotifications}
                className="flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-1.5 text-xs font-black text-white shadow-lg shadow-red-950 hover:bg-red-500 transition-all cursor-pointer"
              >
                <Bell className="h-3.5 w-3.5" />
                <span>Aktifkan Sekarang</span>
              </button>
              <button
                onClick={() => setShowPermissionBanner(false)}
                className="rounded-xl border border-zinc-700 bg-zinc-800/60 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-white hover:border-zinc-500"
              >
                Nanti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Sync Status & Sound Testing Bar */}
      <div
        className={`border-b px-4 py-1.5 text-[11px] transition-colors ${
          theme === 'light'
            ? 'bg-slate-100 border-slate-200 text-black font-medium'
            : 'bg-zinc-950/80 border-zinc-800/60 text-zinc-400'
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
              <Radio className="h-3 w-3 inline" /> LIVE SYNC: Multi-Device Real-Time
            </span>
            <span className={theme === 'light' ? 'text-black' : 'text-zinc-600'}>•</span>
            <span className={`hidden sm:inline ${theme === 'light' ? 'text-black font-semibold' : 'text-zinc-400'}`}>
              Update Terakhir: {lastSyncTime.toLocaleTimeString('id-ID')}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Audio Toggle */}
            <button
              onClick={() => {
                unlockAudio();
                setIsAudioEnabled(!isAudioEnabled);
              }}
              title="Aktif/Nonaktifkan Suara Alarm"
              className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border transition-colors cursor-pointer ${
                isAudioEnabled
                  ? theme === 'light'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-emerald-800 bg-emerald-950/40 text-emerald-300'
                  : theme === 'light'
                  ? 'border-slate-300 bg-white text-slate-500'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-500'
              }`}
            >
              {isAudioEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
              <span>{isAudioEnabled ? 'Suara ON' : 'Mute'}</span>
            </button>

            {/* Test Alarm Sound */}
            <button
              onClick={() => {
                unlockAudio();
                playEmergencyReportSound();
                showSystemNotification({
                  title: '🚨 TES ALARM KERUSAKAN ALKES',
                  body: 'Alarm suara & popup background berfungsi normal di perangkat ini (IPSRS UPTD RSUD LAMADDUKELLENG).',
                  tab: 'perbaikan',
                });
                addNotification({
                  type: 'perbaikan',
                  title: '🚨 TES ALARM SISTEM',
                  message: 'Suara buzzer medis dan popup notifikasi telah diuji coba berhasil.',
                });
              }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border transition-colors cursor-pointer ${
                theme === 'light'
                  ? 'border-orange-300 bg-orange-50 text-orange-800 hover:bg-orange-100'
                  : 'border-orange-800 bg-orange-950/40 text-orange-300 hover:bg-orange-900/50 hover:text-white'
              }`}
            >
              <span>Tes Alarm 🔊</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {activeTab === 'dashboard' && (
          <Dashboard
            inventaris={inventaris}
            pemeliharaan={pemeliharaan}
            perbaikan={perbaikan}
            beritaAcara={beritaAcara}
            currentTeknisi={currentTeknisi}
            ruanganList={ruanganList}
            onOpenRuanganModal={() => setIsRuanganModalOpen(true)}
            onNavigate={setActiveTab}
            onNavigateTab={setActiveTab}
            onOpenQrScanner={() => setIsQrScannerOpen(true)}
            onOpenSyncModal={() => setIsGoogleSheetModalOpen(true)}
            onOpenNewAlkesModal={() => setIsAlkesModalOpen(true)}
            onOpenNewPpmModal={() => setIsPpmModalOpen(true)}
            onOpenNewBapModal={(alkes) => {
              setBapPrefillAlkes(alkes || null);
              setIsBapModalOpen(true);
            }}
            onRequestBap={(alkes) => {
              setBapPrefillAlkes(alkes || null);
              setIsBapModalOpen(true);
            }}
            onOpenPerbaikanThread={handleOpenPerbaikanThread}
            theme={theme}
          />
        )}

        {activeTab === 'inventaris' && (
          <InventarisView
            inventaris={inventaris}
            currentTeknisi={currentTeknisi}
            ruanganList={ruanganList}
            onOpenRuanganModal={() => setIsRuanganModalOpen(true)}
            onAddRuangan={handleAddRuangan}
            onSaveAlkes={handleSaveAlkes}
            onDeleteAlkes={handleDeleteAlkes}
            onClearAllAlkes={handleClearAllAlkes}
            onRequestBap={(alkes) => {
              setBapPrefillAlkes(alkes);
              setIsBapModalOpen(true);
            }}
            isModalOpen={isAlkesModalOpen}
            setIsModalOpen={setIsAlkesModalOpen}
            onOpenSyncModal={() => setIsGoogleSheetModalOpen(true)}
          />
        )}

        {activeTab === 'pemeliharaan' && (
          <PemeliharaanView
            pemeliharaan={pemeliharaan}
            inventaris={inventaris}
            currentTeknisi={currentTeknisi}
            ruanganList={ruanganList}
            onOpenRuanganModal={() => setIsRuanganModalOpen(true)}
            onSavePpm={handleSavePpm}
            onDeletePpm={handleDeletePpm}
            isModalOpen={isPpmModalOpen}
            setIsModalOpen={setIsPpmModalOpen}
          />
        )}

        {activeTab === 'perbaikan' && (
          <PerbaikanView
            perbaikan={perbaikan}
            inventaris={inventaris}
            currentTeknisi={currentTeknisi}
            ruanganList={ruanganList}
            onOpenRuanganModal={() => setIsRuanganModalOpen(true)}
            onSavePerbaikan={handleSavePerbaikan}
            onDeletePerbaikan={handleDeletePerbaikan}
            onRequestBap={(alkes) => {
              setBapPrefillAlkes(alkes);
              setIsBapModalOpen(true);
            }}
            isModalOpen={isPerbaikanModalOpen}
            setIsModalOpen={setIsPerbaikanModalOpen}
            onAddComment={handleAddPerbaikanComment}
            onUpdateStatus={handleUpdatePerbaikanStatus}
            theme={theme}
            initialThreadItem={selectedThreadPerbaikan}
            onClearInitialThreadItem={() => setSelectedThreadPerbaikan(null)}
          />
        )}

        {activeTab === 'beritaAcara' && (
          <BeritaAcaraListView
            beritaAcara={beritaAcara}
            inventaris={inventaris}
            currentTeknisi={currentTeknisi}
            onOpenNewBapModal={() => {
              setBapPrefillAlkes(null);
              setIsBapModalOpen(true);
            }}
            onDeleteBap={handleDeleteBap}
          />
        )}

        {activeTab === 'aiChat' && (
          <AiChatView
            currentTeknisi={currentTeknisi}
            inventaris={inventaris}
            pemeliharaan={pemeliharaan}
            perbaikan={perbaikan}
            beritaAcara={beritaAcara}
          />
        )}
      </main>

      {/* Floating AI Elektromedis Button (when on other tabs) */}
      {activeTab !== 'aiChat' && (
        <button
          id="btn-floating-ai-chat"
          onClick={() => setActiveTab('aiChat')}
          className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-gradient-to-r from-red-600 via-red-700 to-rose-700 px-4 py-3 text-xs font-bold text-white shadow-2xl shadow-red-900/60 ring-2 ring-red-400/40 hover:scale-105 hover:from-red-500 hover:to-rose-600 transition-all group"
          title="Tanya AI Elektromedis & SIM-ALKES"
        >
          <div className="relative flex h-6 w-6 items-center justify-center rounded-full bg-black/30">
            <Sparkles className="h-3.5 w-3.5 text-yellow-300 animate-spin" />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 border border-black" />
          </div>
          <span className="hidden sm:inline">AI Elektromedis</span>
        </button>
      )}

      {/* Footer Branding */}
      <footer
        className={`mt-auto border-t py-4 text-center text-xs transition-colors ${
          theme === 'light'
            ? 'border-slate-200 bg-white text-black'
            : 'border-zinc-900 bg-zinc-950 text-zinc-500'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className={`font-semibold ${theme === 'light' ? 'text-black' : 'text-zinc-400'}`}>
            SIM-ALKES IPSRS UPTD RSUD LAMADDUKELLENG • Versi Standar Elektromedis & Kemenkes RI
          </p>
          <p className={`text-[11px] font-mono ${theme === 'light' ? 'text-black font-medium' : 'text-zinc-600'}`}>
            Unit Pemeliharaan Sarana, Prasarana & Alat Kesehatan (IPSRS/Elektromedis)
          </p>
        </div>
      </footer>

      {/* APK Notification Toast System */}
      <ApkNotificationToast
        notifications={notifications}
        onDismiss={dismissNotification}
        onActionClick={(notif) => {
          if (notif.alkesPayload) {
            setBapPrefillAlkes(notif.alkesPayload);
            setIsBapModalOpen(true);
          }
        }}
      />

      {/* QR & Barcode Scanner Modal */}
      <QrScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        inventaris={inventaris}
        onSelectAlkes={handleQrSelectAlkes}
      />

      {/* Berita Acara Penarikan Modal */}
      <BeritaAcaraModal
        isOpen={isBapModalOpen}
        onClose={() => {
          setIsBapModalOpen(false);
          setBapPrefillAlkes(null);
        }}
        beritaAcara={beritaAcara}
        inventaris={inventaris}
        currentTeknisi={currentTeknisi}
        ruanganList={ruanganList}
        onOpenRuanganModal={() => setIsRuanganModalOpen(true)}
        onSaveBap={handleSaveBap}
        onDeleteBap={handleDeleteBap}
        prefillAlkes={bapPrefillAlkes}
      />

      {/* Master Data Ruangan Management Modal (Tambah, Edit, Hapus Ruangan) */}
      <RuanganManagementModal
        isOpen={isRuanganModalOpen}
        onClose={() => setIsRuanganModalOpen(false)}
        ruanganList={ruanganList}
        inventaris={inventaris}
        pemeliharaan={pemeliharaan}
        perbaikan={perbaikan}
        beritaAcara={beritaAcara}
        currentTeknisi={
          currentTeknisi || {
            username: 'user',
            namaLengkap: 'Petugas Ruangan',
            gelar: '',
            nip: '',
            jabatan: 'Petugas',
            avatarColor: 'bg-zinc-700',
            role: 'user',
          }
        }
        onAddRuangan={handleAddRuangan}
        onRenameRuangan={handleRenameRuangan}
        onDeleteRuangan={handleDeleteRuangan}
        onResetDefaultRuangan={handleResetDefaultRuangan}
      />

      {/* Google Sheets Sync & Configuration Modal */}
      <GoogleSheetSyncModal
        isOpen={isGoogleSheetModalOpen}
        onClose={() => setIsGoogleSheetModalOpen(false)}
        inventaris={inventaris}
        pemeliharaan={pemeliharaan}
        perbaikan={perbaikan}
        beritaAcara={beritaAcara}
        currentTeknisi={currentTeknisi}
        onShowNotification={(type, title, message) => {
          addNotification({
            type,
            title,
            message,
          });
        }}
        onDataSynced={(data) => {
          const deletedIds = getDeletedIdsMap();
          if (data.inventaris) {
            setInventaris((prev) => {
              const { merged } = mergeDatasets(prev, data.inventaris, deletedIds);
              saveLocalData('sim_alkes_inventaris', merged);
              return merged;
            });
          }
          if (data.pemeliharaan) {
            setPemeliharaan((prev) => {
              const { merged } = mergeDatasets(prev, data.pemeliharaan, deletedIds);
              saveLocalData('sim_alkes_pemeliharaan', merged);
              return merged;
            });
          }
          if (data.perbaikan) {
            setPerbaikan((prev) => {
              const { merged } = mergeDatasets(prev, data.perbaikan, deletedIds);
              saveLocalData('sim_alkes_perbaikan', merged);
              return merged;
            });
          }
          if (data.beritaAcara) {
            setBeritaAcara((prev) => {
              const { merged } = mergeDatasets(prev, data.beritaAcara, deletedIds);
              saveLocalData('sim_alkes_bap', merged);
              return merged;
            });
          }
        }}
      />
    </div>
  );
};

export default App;
