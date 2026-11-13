import React from 'react';
import { Bell, AlertTriangle, FileText, CheckCircle2, X, ArrowRight, Radio } from 'lucide-react';
import { ApkNotification } from '../types';

interface ApkNotificationToastProps {
  notifications: ApkNotification[];
  onDismiss: (id: string) => void;
  onActionClick?: (notification: ApkNotification) => void;
}

export const ApkNotificationToast: React.FC<ApkNotificationToastProps> = ({
  notifications = [],
  onDismiss,
  onActionClick,
}) => {
  if (!notifications || notifications.length === 0) return null;

  return (
    <div
      id="apk-notification-container"
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
    >
      {notifications.map((notif) => (
        <div
          key={notif.id}
          className={`pointer-events-auto rounded-2xl p-4 shadow-2xl border backdrop-blur-md transition-all transform animate-in slide-in-from-top-4 duration-300 ${
            notif.type === 'penarikan_bap'
              ? 'border-red-600 bg-zinc-950/95 text-white shadow-red-950/50'
              : notif.type === 'sync'
              ? 'border-cyan-600 bg-zinc-950/95 text-white shadow-cyan-950/50'
              : notif.type === 'perbaikan'
              ? 'border-amber-600 bg-zinc-950/95 text-white shadow-amber-950/50'
              : 'border-emerald-600 bg-zinc-950/95 text-white shadow-emerald-950/50'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`p-2 rounded-xl shrink-0 ${
                notif.type === 'penarikan_bap'
                  ? 'bg-red-950 text-red-400 border border-red-800 animate-pulse'
                  : notif.type === 'sync'
                  ? 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                  : notif.type === 'perbaikan'
                  ? 'bg-amber-950 text-amber-400 border border-amber-800'
                  : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
              }`}
            >
              {notif.type === 'penarikan_bap' ? (
                <FileText className="h-5 w-5" />
              ) : notif.type === 'sync' ? (
                <Radio className="h-5 w-5 animate-spin" />
              ) : notif.type === 'perbaikan' ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <Bell className="h-5 w-5" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-red-400 font-mono">
                  {notif.type === 'penarikan_bap' ? 'NOTIFIKASI APK • PENARIKAN ALKES' : 'SISTEM UPTD RSUD LAMADDUKELLENG'}
                </span>
                <button
                  onClick={() => onDismiss(notif.id)}
                  className="text-zinc-400 hover:text-white p-0.5 rounded-lg"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <h4 className="text-xs font-black text-white mt-0.5">{notif.title}</h4>
              <p className="text-xs text-zinc-300 mt-1 leading-snug">{notif.message}</p>

              {/* Action Button for BAP */}
              {notif.type === 'penarikan_bap' && notif.alkesPayload && (
                <button
                  onClick={() => onActionClick && onActionClick(notif)}
                  className="mt-3 flex items-center justify-center gap-1.5 w-full rounded-xl bg-gradient-to-r from-red-600 to-red-700 py-1.5 px-3 text-xs font-black text-white shadow-lg shadow-red-950 hover:from-red-500 hover:to-red-600 transition-all"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Buat Berita Acara (BAP) Sekarang</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}

              <p className="text-[9px] text-zinc-500 mt-1.5 font-mono">
                {new Date(notif.timestamp).toLocaleTimeString('id-ID')}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
