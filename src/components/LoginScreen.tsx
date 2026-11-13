import React, { useState } from 'react';
import { Shield, Lock, User, Activity, CheckCircle2, AlertTriangle, Cpu, Sun, Moon, Cloud } from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import { DAFTAR_TEKNISI, Teknisi } from '../types';
import { unlockAudio } from '../utils/soundAlerts';
import { requestNotificationPermission } from '../utils/notificationService';
import { auth, BOOTSTRAP_ADMIN_EMAIL, googleProvider } from '../firebase';
import { syncUserProfileToFirestore } from '../utils/firestoreService';

interface LoginScreenProps {
  onLoginSuccess: (teknisi: Teknisi) => void;
  theme?: 'light' | 'dark';
  toggleTheme?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  theme = 'dark',
  toggleTheme,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const isLight = theme === 'light';

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    setIsGoogleLoading(true);
    unlockAudio();
    requestNotificationPermission().catch(() => {});

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      const { role } = await syncUserProfileToFirestore(fbUser);

      if (fbUser.email === BOOTSTRAP_ADMIN_EMAIL || role === 'admin') {
        onLoginSuccess({
          ...DAFTAR_TEKNISI.adi,
          namaLengkap: fbUser.email === BOOTSTRAP_ADMIN_EMAIL ? DAFTAR_TEKNISI.adi.namaLengkap : (fbUser.displayName || DAFTAR_TEKNISI.adi.namaLengkap),
          email: fbUser.email || DAFTAR_TEKNISI.adi.email,
          role: 'admin',
        });
      } else {
        onLoginSuccess({
          username: fbUser.uid,
          namaLengkap: fbUser.displayName || fbUser.email || 'Petugas Ruangan',
          gelar: 'Petugas Ruangan',
          nip: 'FIREBASE-USER',
          jabatan: 'Pelapor Kerusakan Alat Kesehatan Ruangan',
          avatarColor: 'bg-blue-700',
          role: 'user',
          email: fbUser.email || '',
        });
      }
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setErrorMsg('Login Google dibatalkan sebelum selesai.');
      } else {
        setErrorMsg(`Gagal masuk dengan Google: ${err?.message || 'Terjadi kesalahan autentikasi.'}`);
      }
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    unlockAudio();
    requestNotificationPermission().catch(() => {});

    setTimeout(() => {
      const cleanUser = username.trim().toLowerCase();
      const cleanPass = password.trim();

      const user = DAFTAR_TEKNISI[cleanUser];
      if (user && (cleanPass === cleanUser || (cleanUser === 'user' && cleanPass === 'user'))) {
        onLoginSuccess(user);
      } else {
        setErrorMsg('Username atau Password salah. Silakan periksa kembali kredensial Anda.');
        setIsLoading(false);
      }
    }, 400);
  };

  return (
    <div
      id="login-screen-wrapper"
      className={`min-h-screen w-full flex items-center justify-center p-4 sm:p-6 transition-colors relative ${
        isLight
          ? 'bg-gradient-to-br from-slate-100 via-slate-50 to-red-50 text-slate-800'
          : 'bg-gradient-to-br from-zinc-950 via-zinc-900 to-red-950/80 text-zinc-100'
      }`}
    >
      {/* Theme Toggle Button in Corner */}
      {toggleTheme && (
        <div className="absolute top-4 right-4 z-20">
          <button
            id="btn-login-theme-toggle"
            type="button"
            onClick={toggleTheme}
            title={isLight ? 'Ganti ke Mode Gelap' : 'Ganti ke Mode Terang'}
            className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all shadow-md cursor-pointer ${
              isLight
                ? 'border-slate-300 bg-white/90 text-slate-700 hover:bg-slate-100 shadow-slate-300/40'
                : 'border-zinc-700 bg-zinc-850/90 text-zinc-200 hover:border-zinc-500 shadow-black/40'
            }`}
          >
            {isLight ? (
              <>
                <Moon className="h-4 w-4 text-indigo-600 fill-indigo-100" />
                <span>Mode Gelap</span>
              </>
            ) : (
              <>
                <Sun className="h-4 w-4 text-amber-400 fill-amber-400/20" />
                <span>Mode Terang</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Background Glow Ambience */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className={`absolute -top-40 -left-40 h-96 w-96 rounded-full blur-3xl ${
            isLight ? 'bg-red-400/10' : 'bg-red-900/20'
          }`}
        />
        <div
          className={`absolute -bottom-40 -right-40 h-96 w-96 rounded-full blur-3xl ${
            isLight ? 'bg-red-500/10' : 'bg-red-800/20'
          }`}
        />
      </div>

      <div className="relative w-full max-w-md">
        {/* Main Card */}
        <div
          id="login-card"
          className={`overflow-hidden rounded-3xl border shadow-2xl backdrop-blur-xl transition-all ${
            isLight
              ? 'border-slate-200 bg-white/95 shadow-slate-300/60'
              : 'border-red-900/60 bg-zinc-900/90 shadow-red-950/40'
          }`}
        >
          {/* Header Banner with Blood Red Accent */}
          <div className="relative bg-gradient-to-r from-red-800 via-red-700 to-red-900 p-6 text-center text-white border-b border-red-600/50">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 p-3 shadow-inner ring-2 ring-white/30 backdrop-blur-md">
              <Activity className="h-10 w-10 text-white animate-pulse" />
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-0.5 text-[11px] font-semibold text-red-200 uppercase tracking-widest border border-white/10 mb-1.5">
              <Cpu className="h-3 w-3 text-red-400" />
              IPSRS ELEKTROMEDIS & PELAYANAN
            </div>

            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white drop-shadow">
              SIM-ALKES UPTD RSUD LAMADDUKELLENG
            </h1>
            <p className="text-xs text-red-100/90 font-medium mt-1">
              Kabupaten Wajo, Sulawesi Selatan
            </p>
          </div>

          <div className="p-6">
            {/* Error Message */}
            {errorMsg && (
              <div
                id="login-error-alert"
                className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/60 bg-red-50 dark:bg-red-950/70 p-3 text-xs text-red-700 dark:text-red-200"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Google Sign-In Button */}
            <button
              id="btn-google-signin"
              type="button"
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading || isLoading}
              className={`mb-4 flex w-full items-center justify-center gap-2.5 rounded-xl border py-2.5 text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer ${
                isLight
                  ? 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50 shadow-sm'
                  : 'border-zinc-700 bg-zinc-800/80 text-white hover:bg-zinc-800 hover:border-zinc-500 shadow-sm'
              }`}
            >
              {isGoogleLoading ? (
                <>
                  <Activity className="h-4 w-4 animate-spin text-red-500" />
                  <span>Menghubungkan Akun Google...</span>
                </>
              ) : (
                <>
                  <Cloud className="h-4 w-4 text-red-500" />
                  <span>Masuk dengan Akun Google</span>
                </>
              )}
            </button>

            <div className="relative mb-4 flex items-center justify-center">
              <div className={`w-full border-t ${isLight ? 'border-slate-200' : 'border-zinc-800'}`} />
              <span
                className={`px-3 text-[10px] font-bold uppercase tracking-widest shrink-0 ${
                  isLight ? 'bg-white text-slate-500' : 'bg-zinc-900 text-zinc-500'
                }`}
              >
                atau akun teknisi
              </span>
              <div className={`w-full border-t ${isLight ? 'border-slate-200' : 'border-zinc-800'}`} />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="input-username"
                  className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${
                    isLight ? 'text-black' : 'text-zinc-300'
                  }`}
                >
                  Username
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-zinc-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    id="input-username"
                    type="text"
                    required
                    autoFocus
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Masukkan username"
                    className={`w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 ${
                      isLight
                        ? 'border-slate-300 bg-white text-black font-semibold placeholder-slate-400'
                        : 'border-zinc-700 bg-zinc-950/90 text-white placeholder-zinc-500'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="input-password"
                  className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${
                    isLight ? 'text-black' : 'text-zinc-300'
                  }`}
                >
                  Password
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-zinc-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="input-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    className={`w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 ${
                      isLight
                        ? 'border-slate-300 bg-white text-black font-semibold placeholder-slate-400'
                        : 'border-zinc-700 bg-zinc-950/90 text-white placeholder-zinc-500'
                    }`}
                  />
                </div>
              </div>

              <button
                id="btn-submit-login"
                type="submit"
                disabled={isLoading}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-700 via-red-600 to-red-800 py-3 text-sm font-bold text-white shadow-lg shadow-red-900/50 transition-all hover:from-red-600 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/40 disabled:opacity-50 active:scale-[0.98] cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Activity className="h-4 w-4 animate-spin text-white" />
                    <span>Memverifikasi Akses...</span>
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4" />
                    <span>Masuk ke Sistem</span>
                  </>
                )}
              </button>
            </form>

            {/* Hospital Security Badge */}
            <div
              className={`mt-6 flex items-center justify-center gap-2 border-t pt-4 text-[11px] font-semibold ${
                isLight ? 'border-slate-200 text-black' : 'border-zinc-800/80 text-zinc-500'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-500" />
              <span>Sistem Terenkripsi & Terintegrasi UPTD RSUD LAMADDUKELLENG</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
