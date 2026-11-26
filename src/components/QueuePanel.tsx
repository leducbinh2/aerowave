import React from 'react';
import {
  FolderSearch,
  Music2,
  Pause,
  Play,
  RotateCw,
  Trash2,
  X,
  XCircle
} from 'lucide-react';
import type { QueueItem } from '../../shared/types';

interface QueuePanelProps {
  open: boolean;
  items: QueueItem[];
  playingItemId: string | null;
  isPlaying: boolean;
  onClose: () => void;
  onPlayItem: (item: QueueItem) => void;
  onShowInFolder: (filePath: string) => void;
  onRetryItem: (id: string) => void;
  onCancelItem: (id: string) => void;
  onRemoveItem: (id: string) => void;
  onClearCompleted: () => void;
  onCancelAll: () => void;
}

function getStatusBadge(status: QueueItem['status']): {
  label: string;
  classes: string;
} {
  switch (status) {
    case 'queued':
      return { label: 'Đang chờ', classes: 'bg-white/10 text-white/75 border-white/15' };
    case 'downloading':
      return { label: 'Đang tải', classes: 'bg-sky-400/20 text-sky-200 border-sky-400/40' };
    case 'converting':
      return { label: 'Đang chuyển đổi', classes: 'bg-violet-400/20 text-violet-200 border-violet-400/40' };
    case 'completed':
      return { label: 'Hoàn tất', classes: 'bg-emerald-400/20 text-emerald-200 border-emerald-400/40' };
    case 'error':
      return { label: 'Lỗi', classes: 'bg-rose-500/20 text-rose-200 border-rose-400/40' };
    case 'cancelled':
      return { label: 'Đã hủy', classes: 'bg-slate-500/20 text-slate-300 border-slate-400/30' };
  }
}

export const QueuePanel: React.FC<QueuePanelProps> = ({
  open,
  items,
  playingItemId,
  isPlaying,
  onClose,
  onPlayItem,
  onShowInFolder,
  onRetryItem,
  onCancelItem,
  onRemoveItem,
  onClearCompleted,
  onCancelAll
}) => {
  const hasRunningOrQueued = items.some(
    (i) => i.status === 'queued' || i.status === 'downloading' || i.status === 'converting'
  );
  const hasFinished = items.some(
    (i) => i.status === 'completed' || i.status === 'error' || i.status === 'cancelled'
  );

  return (
    <>
      {/* Click-away backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/25 backdrop-blur-[1px]"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-10 right-0 bottom-0 z-40 w-[430px] max-w-[92vw] backdrop-blur-2xl bg-slate-950/80 border-l border-white/15 shadow-[-16px_0_48px_rgba(0,0,0,0.55)] flex flex-col transition-transform duration-300 ease-out app-no-drag ${
          open ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium tracking-wide text-white">
              Hàng đợi & Lịch sử
            </h2>
            <p className="text-[11px] font-light text-white/55">
              {items.length} mục trong danh sách
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {hasRunningOrQueued && (
              <button
                type="button"
                onClick={onCancelAll}
                className="px-2.5 py-1 rounded-lg text-[11px] bg-rose-500/15 hover:bg-rose-500/30 text-rose-200 border border-rose-400/30 transition-colors"
              >
                Hủy tất cả
              </button>
            )}
            {hasFinished && (
              <button
                type="button"
                onClick={onClearCompleted}
                className="px-2.5 py-1 rounded-lg text-[11px] bg-white/10 hover:bg-white/15 text-white/80 border border-white/15 transition-colors"
              >
                Xóa đã xong
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              title="Đóng bảng hàng đợi"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Queue items */}
        <div className="flex-1 overflow-y-auto hud-scrollbar p-4 flex flex-col gap-2.5">
          {items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12 text-white/50">
              <Music2 className="w-10 h-10 mb-3 text-sky-300/30" />
              <p className="text-xs font-light leading-relaxed">
                Chưa có bài hát nào trong hàng đợi. Hãy dán liên kết YouTube hoặc Playlist ở góc trên bên trái.
              </p>
            </div>
          ) : (
            items.map((item) => {
              const badge = getStatusBadge(item.status);
              const isActive = item.status === 'downloading' || item.status === 'converting';
              const isItemPlaying = playingItemId === item.id && isPlaying;

              return (
                <div
                  key={item.id}
                  className="p-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 transition-colors flex flex-col gap-2"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-900 border border-white/10 shrink-0 flex items-center justify-center">
                      {item.thumbnail ? (
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Music2 className="w-5 h-5 text-white/35" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white line-clamp-1">
                        {item.title}
                      </div>
                      <div className="mt-1 flex items-center flex-wrap gap-1.5 text-[10px]">
                        <span className={`px-1.5 py-0.5 rounded-md border ${badge.classes}`}>
                          {badge.label}
                        </span>
                        <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-white/80 uppercase">
                          {item.format === 'mp3' ? 'MP3 320k' : item.format.toUpperCase()}
                        </span>
                        {isActive && (
                          <span className="text-sky-300/90 tabular-nums">
                            {Math.round(item.progress)}% • {item.speed}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Progress bar while active */}
                  {isActive && (
                    <div>
                      <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            item.status === 'converting'
                              ? 'bg-gradient-to-r from-violet-400 to-sky-400 animate-pulse'
                              : 'bg-gradient-to-r from-sky-400 to-amber-300'
                          }`}
                          style={{ width: `${Math.max(4, item.progress)}%` }}
                        />
                      </div>
                      <div className="mt-1 text-[10px] font-light text-white/60">
                        {item.stageText}
                      </div>
                    </div>
                  )}

                  {/* Error message */}
                  {item.status === 'error' && item.error && (
                    <div className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-400/25 text-[11px] text-rose-200 leading-snug">
                      {item.error}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1.5 pt-0.5">
                    {item.status === 'completed' && item.filePath && (
                      <>
                        <button
                          type="button"
                          onClick={() => onPlayItem(item)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-400/20 hover:bg-sky-400/35 text-sky-200 text-[11px] transition-colors"
                        >
                          {isItemPlaying ? (
                            <>
                              <Pause className="w-3 h-3" />
                              <span>Dừng</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3" />
                              <span>Nghe thử</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onShowInFolder(item.filePath!)}
                          title="Mở vị trí file"
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white/80 text-[11px] transition-colors"
                        >
                          <FolderSearch className="w-3 h-3" />
                          <span>Thư mục</span>
                        </button>
                      </>
                    )}

                    {(item.status === 'error' || item.status === 'cancelled') && (
                      <button
                        type="button"
                        onClick={() => onRetryItem(item.id)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/35 text-amber-200 text-[11px] transition-colors"
                      >
                        <RotateCw className="w-3 h-3" />
                        <span>Thử lại</span>
                      </button>
                    )}

                    {(isActive || item.status === 'queued') ? (
                      <button
                        type="button"
                        onClick={() => onCancelItem(item.id)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-200 text-[11px] transition-colors"
                      >
                        <XCircle className="w-3 h-3" />
                        <span>Hủy</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.id)}
                        title="Xóa khỏi danh sách"
                        className="p-1.5 rounded-lg text-white/45 hover:text-rose-300 hover:bg-white/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
};
