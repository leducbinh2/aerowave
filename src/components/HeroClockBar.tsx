import React, { useEffect, useState } from 'react';
import {
  ClipboardPaste,
  Download,
  Loader2,
  Music2,
  Pause,
  Play,
  X
} from 'lucide-react';
import type { QueueItem } from '../../shared/types';

interface HeroClockBarProps {
  urlInput: string;
  onUrlChange: (val: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  featuredItem: QueueItem | null;
  playingItemId: string | null;
  isPlaying: boolean;
  onTogglePlayItem: (item: QueueItem) => void;
}

const VIET_DAYS = [
  'Chủ Nhật',
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy'
];

function formatClock(now: Date): { time: string; date: string } {
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const dayName = VIET_DAYS[now.getDay()];
  const dayNum = now.getDate();
  const monthNum = now.getMonth() + 1;
  return {
    time: `${hours}:${minutes}`,
    date: `${dayName}, ${dayNum} Tháng ${monthNum}`
  };
}

export const HeroClockBar: React.FC<HeroClockBarProps> = ({
  urlInput,
  onUrlChange,
  onSubmit,
  isSubmitting,
  featuredItem,
  playingItemId,
  isPlaying,
  onTogglePlayItem
}) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const { time, date } = formatClock(now);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        onUrlChange(text.trim());
      }
    } catch {
      // Clipboard access blocked or empty
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isSubmitting) {
      e.preventDefault();
      onSubmit();
    }
  };

  const isFeaturedPlaying =
    Boolean(featuredItem && playingItemId === featuredItem.id && isPlaying);
  const canPlayFeatured = Boolean(
    featuredItem && featuredItem.status === 'completed' && featuredItem.filePath
  );

  return (
    <section className="flex flex-col items-start max-w-[490px] w-full app-no-drag">
      {/* Ultra-light hero clock matching Rainmeter aesthetic */}
      <div className="select-none mb-5">
        <div className="text-[76px] leading-[0.94] font-extralight tracking-tight text-white tabular-nums drop-shadow-[0_4px_24px_rgba(0,0,0,0.45)]">
          {time}
        </div>
        <div className="mt-1.5 text-[21px] font-light tracking-wide text-white/90 drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]">
          {date}
        </div>
      </div>

      {/* Frosted glass YouTube URL bar */}
      <div className="w-full flex items-center gap-1.5 pl-4 pr-1.5 py-1.5 rounded-full backdrop-blur-md bg-slate-950/35 border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.3)] focus-within:border-sky-400/60 focus-within:bg-slate-950/50 transition-all">
        <input
          type="text"
          value={urlInput}
          onChange={(e) => onUrlChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Dán link YouTube hoặc Playlist..."
          disabled={isSubmitting}
          className="flex-1 min-w-0 bg-transparent text-[13px] font-light text-white placeholder:text-white/50 focus:outline-none"
        />

        {urlInput ? (
          <button
            type="button"
            onClick={() => onUrlChange('')}
            title="Xóa liên kết"
            className="p-1.5 rounded-full text-white/55 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handlePaste()}
            title="Dán từ bộ nhớ tạm"
            className="p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting || !urlInput.trim()}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium tracking-wide bg-sky-400/90 hover:bg-sky-300 text-slate-950 disabled:opacity-45 disabled:cursor-not-allowed transition-all shadow-[0_0_18px_rgba(56,189,248,0.4)] shrink-0"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Đang đọc...</span>
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5" />
              <span>Tải ngay</span>
            </>
          )}
        </button>
      </div>

      {/* Mini active / latest completed track card */}
      {featuredItem && (
        <div className="mt-3.5 w-full max-w-[420px] flex items-center gap-3 p-2.5 rounded-2xl backdrop-blur-md bg-slate-950/35 border border-white/15 shadow-[0_8px_28px_rgba(0,0,0,0.28)]">
          <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-900/80 border border-white/10 shrink-0 flex items-center justify-center">
            {featuredItem.thumbnail ? (
              <img
                src={featuredItem.thumbnail}
                alt={featuredItem.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <Music2 className="w-5 h-5 text-sky-300/70" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-white truncate">
              {featuredItem.title}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] font-light text-white/65 truncate">
              <span className="uppercase text-sky-300/90 font-normal">
                {featuredItem.format}
              </span>
              <span>•</span>
              <span className="truncate">
                {featuredItem.status === 'completed'
                  ? featuredItem.uploader
                  : featuredItem.stageText}
              </span>
            </div>

            {(featuredItem.status === 'downloading' ||
              featuredItem.status === 'converting') && (
              <div className="mt-1.5 h-1 w-full rounded-full bg-white/15 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 to-amber-300 transition-all duration-300"
                  style={{ width: `${Math.max(4, featuredItem.progress)}%` }}
                />
              </div>
            )}
          </div>

          {canPlayFeatured && (
            <button
              type="button"
              onClick={() => onTogglePlayItem(featuredItem)}
              title={isFeaturedPlaying ? 'Tạm dừng' : 'Nghe thử ngay'}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-white/15 hover:bg-sky-400 hover:text-slate-950 text-white border border-white/20 transition-all shrink-0"
            >
              {isFeaturedPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4 translate-x-[1px]" />
              )}
            </button>
          )}
        </div>
      )}
    </section>
  );
};
