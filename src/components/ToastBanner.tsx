import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  type: 'info' | 'success' | 'error';
  message: string;
}

interface ToastBannerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const ToastBanner: React.FC<ToastBannerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-md px-4 pointer-events-none">
      {toasts.map((toast) => {
        const icon =
          toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-sky-400 shrink-0" />
          );

        const borderClass =
          toast.type === 'error'
            ? 'border-rose-400/35'
            : toast.type === 'success'
              ? 'border-emerald-400/35'
              : 'border-sky-400/35';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl backdrop-blur-xl bg-slate-950/75 border ${borderClass} shadow-[0_8px_30px_rgba(0,0,0,0.45)] text-xs text-white/95`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {icon}
              <span className="leading-relaxed break-words">{toast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="text-white/50 hover:text-white transition-colors shrink-0"
              aria-label="Đóng thông báo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
