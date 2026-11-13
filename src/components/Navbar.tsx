import React, { useState } from 'react';
import {
  Activity,
  Layers,
  Wrench,
  FileText,
  FileCheck2,
  QrCode,
  RefreshCw,
  Bell,
  LogOut,
  ChevronDown,
  UserCheck,
  Shield,
  Heart,
  TableProperties,
  Sparkles,
  Bot,
  Sun,
  Moon,
} from 'lucide-react';
import { Teknisi, NotificationItem, TabMenuType } from '../types';

interface NavbarProps {
  activeTab: TabMenuType;
  setActiveTab: (tab: TabMenuType) => void;
  currentTeknisi: Teknisi;
  onLogout: () => void;
  onOpenQrScanner: () => void;
  onOpenSyncModal: () => void;
  notifications: NotificationItem[];
  onOpenNotifications: () => void;
  isSyncing?: boolean;
  theme?: 'light' | 'dark';
  toggleTheme?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentTeknisi,
  onLogout,
  onOpenQrScanner,
  onOpenSyncModal,
  notifications = [],
  onOpenNotifications,
  isSyncing = false,
  theme = 'dark',
  toggleTheme,
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  const unreadCount = (notifications || []).filter((n) => !n?.isRead).length;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'inventaris', label: 'Inventaris Alkes', icon: Layers },
    { id: 'pemeliharaan', label: 'Pemeliharaan (PPM)', icon: FileCheck2 },
    { id: 'perbaikan', label: 'Form Perbaikan', icon: Wrench },
    { id: 'beritaAcara', label: 'Berita Acara (BAP)', icon: FileText },
    { id: 'aiChat', label: 'AI Elektromedis', icon: Sparkles, isAi: true },
  ];

  const isLight = theme === 'light';

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b backdrop-blur-md transition-colors ${
        isLight
          ? 'border-slate-200 bg-white/95 text-slate-800 shadow-sm'
          : 'border-red-950/80 bg-zinc-950/95 text-white shadow-xl shadow-red-950/20'
      }`}
    >
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-2">
          {/* Brand Logo & Hospital Title */}
          <div
            id="brand-logo-button"
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div
              className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border p-0.5 shadow-md group-hover:scale-105 transition-transform overflow-hidden ${
                isLight
                  ? 'bg-slate-100 border-slate-300 ring-2 ring-red-500/20 shadow-slate-300/50'
                  : 'bg-zinc-900 border-zinc-700 ring-2 ring-red-500/30 shadow-red-900/40 text-white'
              }`}
            >
              <img
                src="/logo-app.svg"
                alt="Logo SIM-ALKES UPTD RSUD LAMADDUKELLENG"
                className="h-full w-full object-contain"
                referrerPolicy="no-referrer"
              />
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-950" />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-sm sm:text-base font-black tracking-tight transition-colors ${
                    isLight ? 'text-black group-hover:text-red-600' : 'text-white group-hover:text-red-400'
                  }`}
                >
                  SIM-ALKES
                </span>
                <span
                  className={`rounded px-1.5 py-0.2 text-[10px] font-black tracking-wider ${
                    isLight ? 'bg-red-100 text-red-700' : 'bg-red-800/80 text-red-100'
                  }`}
                >
                  UPTD RSUD LAMADDUKELLENG
                </span>
              </div>
              <p
                className={`hidden xs:block text-[11px] font-semibold leading-none ${
                  isLight ? 'text-black' : 'text-zinc-400'
                }`}
              >
                Elektromedis & Pemeliharaan Terpadu
              </p>
            </div>
          </div>

          {/* Center / Right Header Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme Toggle Button (Terang / Gelap) */}
            {toggleTheme && (
              <button
                id="btn-nav-theme-toggle"
                onClick={toggleTheme}
                title={isLight ? 'Beralih ke Mode Gelap (Dark Mode)' : 'Beralih ke Mode Terang (Light Mode)'}
                className={`flex items-center gap-1.5 rounded-xl border px-2.5 sm:px-3 py-2 text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                  isLight
                    ? 'border-indigo-200 bg-indigo-50/80 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 shadow-sm'
                    : 'border-amber-500/40 bg-amber-950/40 text-amber-300 hover:border-amber-400 hover:bg-amber-900/50 shadow-sm'
                }`}
              >
                {isLight ? (
                  <>
                    <Moon className="h-4 w-4 text-indigo-600 fill-indigo-200" />
                    <span className="hidden md:inline font-semibold">Mode Gelap</span>
                  </>
                ) : (
                  <>
                    <Sun className="h-4 w-4 text-amber-400 fill-amber-400/20" />
                    <span className="hidden md:inline font-semibold">Mode Terang</span>
                  </>
                )}
              </button>
            )}

            {/* QR Scanner Shortcut */}
            <button
              id="btn-nav-qr-scan"
              onClick={onOpenQrScanner}
              title="Pindai QR / Barcode Alkes"
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all shadow-sm ${
                isLight
                  ? 'border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100'
                  : 'border-red-900/60 bg-red-950/40 text-red-300 hover:border-red-600 hover:bg-red-900/50 hover:text-white'
              }`}
            >
              <QrCode className="h-4 w-4 text-red-600 dark:text-red-400" />
              <span className="hidden md:inline">Scan QR</span>
            </button>

            {/* Google Sheets Sync Button */}
            <button
              id="btn-nav-sync-sheets"
              onClick={onOpenSyncModal}
              title="Sinkronisasi Google Spreadsheet & Multi-Device"
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                isSyncing
                  ? isLight
                    ? 'border-emerald-500 bg-emerald-100 text-emerald-800 animate-pulse'
                    : 'border-emerald-600 bg-emerald-950/80 text-emerald-300 animate-pulse'
                  : isLight
                  ? 'border-slate-300 bg-slate-100 text-slate-700 hover:border-slate-400 hover:bg-slate-200'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  isSyncing
                    ? 'animate-spin text-emerald-600 dark:text-emerald-400'
                    : 'text-emerald-600 dark:text-emerald-500'
                }`}
              />
              <span className="hidden sm:inline">Sinkron Sheet</span>
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button
                id="btn-nav-notifications"
                onClick={() => {
                  setShowNotifMenu(!showNotifMenu);
                  if (onOpenNotifications) onOpenNotifications();
                }}
                title="Notifikasi & Peringatan Sistem"
                className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition-all ${
                  isLight
                    ? 'border-slate-300 bg-slate-100 text-slate-700 hover:border-slate-400 hover:bg-slate-200'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700 hover:text-white'
                }`}
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white ring-2 ring-white dark:ring-zinc-950 animate-bounce">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown Menu */}
              {showNotifMenu && (
                <div
                  id="notifications-dropdown-menu"
                  className={`absolute right-0 mt-2 w-80 sm:w-96 origin-top-right rounded-2xl border p-3 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 ${
                    isLight
                      ? 'border-slate-200 bg-white/98 text-slate-900 backdrop-blur-md shadow-slate-400/20'
                      : 'border-zinc-800 bg-zinc-900/95 text-white backdrop-blur-md'
                  }`}
                >
                  <div
                    className={`flex items-center justify-between border-b pb-2 mb-2 ${
                      isLight ? 'border-slate-200' : 'border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Bell className="h-4 w-4 text-red-600 dark:text-red-400" />
                      <span className="text-xs font-black uppercase tracking-wider">
                        Pusat Notifikasi & Alert
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-mono ${
                        isLight ? 'text-slate-500' : 'text-zinc-400'
                      }`}
                    >
                      {notifications.length} riwayat
                    </span>
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                    {notifications.length === 0 ? (
                      <div
                        className={`py-6 text-center text-xs ${
                          isLight ? 'text-slate-500' : 'text-zinc-500'
                        }`}
                      >
                        Belum ada notifikasi baru. Sistem berjalan normal.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`rounded-xl border p-2.5 text-xs transition-colors ${
                            n.type === 'perbaikan'
                              ? isLight
                                ? 'border-orange-200 bg-orange-50 text-orange-950'
                                : 'border-orange-800/80 bg-orange-950/40 text-orange-200'
                              : n.type === 'penarikan_bap'
                              ? isLight
                                ? 'border-red-200 bg-red-50 text-red-950'
                                : 'border-red-800/80 bg-red-950/40 text-red-200'
                              : n.type === 'sync'
                              ? isLight
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                                : 'border-emerald-800/80 bg-emerald-950/40 text-emerald-200'
                              : isLight
                              ? 'border-slate-200 bg-slate-50 text-slate-800'
                              : 'border-zinc-800 bg-zinc-950 text-zinc-300'
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold text-[11px] mb-1">
                            <span className="flex items-center gap-1.5 font-bold">
                              {n.type === 'perbaikan' && '🚨'}
                              {n.type === 'penarikan_bap' && '⚠️'}
                              {n.type === 'sync' && '🔄'}
                              {n.title}
                            </span>
                            <span
                              className={`text-[9px] font-mono ${
                                isLight ? 'text-slate-500' : 'text-zinc-400'
                              }`}
                            >
                              {new Date(n.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p
                            className={`text-[11px] leading-relaxed ${
                              isLight ? 'text-slate-700' : 'text-zinc-300'
                            }`}
                          >
                            {n.message}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Dropdown Button */}
            <div className="relative">
              <button
                id="btn-nav-profile-menu"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className={`flex items-center gap-2 rounded-xl border p-1.5 pr-2.5 transition-all text-left ${
                  isLight
                    ? 'border-slate-300 bg-slate-100 hover:border-slate-400 text-slate-800'
                    : 'border-red-900/50 bg-zinc-900/90 hover:border-red-600 text-zinc-200'
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-black text-xs text-white ${currentTeknisi.avatarColor}`}
                >
                  {currentTeknisi.namaLengkap.charAt(0)}
                </div>
                <div className="hidden lg:block">
                  <p
                    className={`text-xs font-bold leading-tight truncate max-w-[140px] ${
                      isLight ? 'text-black' : 'text-zinc-200'
                    }`}
                  >
                    {currentTeknisi.namaLengkap.split(' ')[0]}
                  </p>
                  <p
                    className={`text-[10px] font-mono leading-tight ${
                      isLight ? 'text-black font-semibold' : 'text-zinc-400'
                    }`}
                  >
                    {currentTeknisi.gelar}
                  </p>
                </div>
                <ChevronDown
                  className={`h-3.5 w-3.5 ${
                    isLight ? 'text-black' : 'text-zinc-400'
                  }`}
                />
              </button>

              {/* Profile Dropdown */}
              {showProfileMenu && (
                <div
                  id="profile-dropdown-popup"
                  className={`absolute right-0 mt-2 w-72 origin-top-right rounded-2xl border p-3 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 ${
                    isLight
                      ? 'border-slate-200 bg-white text-slate-800 shadow-slate-300/30'
                      : 'border-red-900/60 bg-zinc-900 text-zinc-100'
                  }`}
                >
                  <div
                    className={`border-b pb-3 ${
                      isLight ? 'border-slate-200' : 'border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-black uppercase border ${
                          currentTeknisi.role === 'admin'
                            ? isLight
                              ? 'bg-red-50 text-red-800 border-red-200'
                              : 'bg-red-950 text-red-300 border-red-800/60'
                            : isLight
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : 'bg-blue-950 text-blue-300 border-blue-800/60'
                        }`}
                      >
                        {currentTeknisi.role === 'admin'
                          ? 'ADMIN / TEKNISI ELEKTROMEDIS'
                          : 'PETUGAS RUANGAN'}
                      </span>
                    </div>
                    <p
                      className={`text-sm font-black ${
                        isLight ? 'text-slate-900' : 'text-white'
                      }`}
                    >
                      {currentTeknisi.namaLengkap}
                    </p>
                    <p
                      className={`text-xs font-mono mt-0.5 ${
                        isLight ? 'text-slate-500' : 'text-zinc-400'
                      }`}
                    >
                      NIP: {currentTeknisi.nip || '-'}
                    </p>
                    <p
                      className={`text-[11px] mt-1 ${
                        isLight ? 'text-slate-600' : 'text-zinc-400'
                      }`}
                    >
                      {currentTeknisi.jabatan}
                    </p>
                    {currentTeknisi.email && (
                      <p className="text-[10px] text-blue-600 dark:text-blue-400 font-mono mt-1 truncate">
                        {currentTeknisi.email}
                      </p>
                    )}
                  </div>

                  {/* Theme Mode Toggle inside Profile Dropdown */}
                  {toggleTheme && (
                    <div
                      className={`py-2 border-b ${
                        isLight ? 'border-slate-200' : 'border-zinc-800'
                      }`}
                    >
                      <button
                        id="btn-profile-toggle-theme"
                        onClick={() => {
                          toggleTheme();
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs font-bold transition-colors cursor-pointer ${
                          isLight
                            ? 'text-slate-700 hover:bg-slate-100'
                            : 'text-zinc-300 hover:bg-zinc-800'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isLight ? (
                            <Sun className="h-4 w-4 text-amber-500" />
                          ) : (
                            <Moon className="h-4 w-4 text-indigo-400" />
                          )}
                          <span>Ganti Tema</span>
                        </div>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            isLight
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-amber-950/60 text-amber-300 border border-amber-800/40'
                          }`}
                        >
                          {isLight ? '☀️ Mode Terang' : '🌙 Mode Gelap'}
                        </span>
                      </button>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      id="btn-logout"
                      onClick={() => {
                        setShowProfileMenu(false);
                        onLogout();
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Keluar (Logout)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div
          className={`flex space-x-1 overflow-x-auto scrollbar-none border-t py-1.5 ${
            isLight ? 'border-slate-200' : 'border-zinc-800/60'
          }`}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                onClick={() => setActiveTab(item.id as any)}
                className={`flex items-center gap-2 shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-red-700 via-red-600 to-red-800 text-white shadow-md shadow-red-900/30 border border-red-500/40'
                    : item.isAi
                    ? isLight
                      ? 'text-red-700 hover:bg-red-50 hover:text-red-800 border border-red-200 bg-red-50/50'
                      : 'text-red-300 hover:bg-red-950/40 hover:text-red-200 border border-red-900/40 bg-red-950/20'
                    : isLight
                    ? 'text-black hover:bg-slate-200 hover:text-black'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${
                    isActive
                      ? 'text-white'
                      : item.isAi
                      ? isLight
                        ? 'text-red-600 animate-pulse'
                        : 'text-red-400 animate-pulse'
                      : isLight
                      ? 'text-black'
                      : 'text-zinc-400'
                  }`}
                />
                <span>{item.label}</span>
                {item.isAi && !isActive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
