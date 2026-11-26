import React from 'react';
import { Copy, Minus, Square, X } from 'lucide-react';

interface WindowControlsProps {
  isMaximized: boolean;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
}

export const WindowControls: React.FC<WindowControlsProps> = ({
  isMaximized,
  onMinimize,
  onToggleMaximize,
  onClose
}) => {
  return (
    <header className="fixed top-0 left-0 right-0 h-10 z-40 flex items-center justify-between px-4 app-drag">
      <div className="flex items-center gap-2 opacity-60 pointer-events-none select-none">
        <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)]" />
        <span className="text-[11px] font-light tracking-[0.28em] uppercase text-white/80">
          AEROWAVE
        </span>
      </div>

      <div className="flex items-center gap-1 app-no-drag">
        <button
          type="button"
          onClick={onMinimize}
          title="Thu nhỏ"
          className="h-7 w-8 rounded-md flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onToggleMaximize}
          title={isMaximized ? 'Khôi phục cửa sổ' : 'Phóng to'}
          className="h-7 w-8 rounded-md flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          {isMaximized ? (
            <Copy className="w-3 h-3" />
          ) : (
            <Square className="w-3 h-3" />
          )}
        </button>
        <button
          type="button"
          onClick={onClose}
          title="Đóng ứng dụng"
          className="h-7 w-8 rounded-md flex items-center justify-center text-white/70 hover:text-white hover:bg-rose-500/80 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
