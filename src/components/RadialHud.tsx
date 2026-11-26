import React, { useState } from 'react';
import {
  FolderInput,
  FolderOpen,
  Image as ImageIcon,
  ListMusic,
  Music,
  RotateCcw,
  Tag
} from 'lucide-react';
import type { AudioFormat, QueueItem } from '../../shared/types';

interface RadialHudProps {
  activeItem: QueueItem | null;
  playingItem: QueueItem | null;
  isPlaying: boolean;
  format: AudioFormat;
  embedMeta: boolean;
  customBgPath: string | null;
  queueCount: number;
  hasActiveDownload: boolean;
  onChangeFormat: (format: AudioFormat) => void;
  onToggleEmbedMeta: () => void;
  onSelectFolder: () => void;
  onOpenFolder: () => void;
  onSelectBackground: () => void;
  onResetBackground: () => void;
  onOpenQueue: () => void;
}

const FORMAT_OPTIONS: Array<{ value: AudioFormat; label: string; hint: string }> = [
  { value: 'mp3', label: 'MP3', hint: '320 kbps' },
  { value: 'flac', label: 'FLAC', hint: 'Lossless' },
  { value: 'm4a', label: 'M4A', hint: 'Âm thanh gốc' },
  { value: 'wav', label: 'WAV', hint: 'Không nén' }
];

function computeSpeedPercent(bytesPerSec: number): number {
  if (bytesPerSec <= 0) return 0;
  const mbps = bytesPerSec / 1_048_576;
  const normalized = Math.log10(1 + mbps * 4) / Math.log10(1 + 20 * 4);
  return Math.min(100, Math.max(4, normalized * 100));
}

function computeStagePercent(item: QueueItem | null): number {
  if (!item) return 0;
  if (item.status === 'completed') return 100;
  switch (item.stage) {
    case 'downloading':
      return 22;
    case 'extracting':
      return 62;
    case 'metadata':
      return 88;
    case 'done':
      return 100;
    default:
      return 0;
  }
}

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy - radius * Math.sin(rad)
  };
}

export const RadialHud: React.FC<RadialHudProps> = ({
  activeItem,
  playingItem,
  isPlaying,
  format,
  embedMeta,
  customBgPath,
  queueCount,
  hasActiveDownload,
  onChangeFormat,
  onToggleEmbedMeta,
  onSelectFolder,
  onOpenFolder,
  onSelectBackground,
  onResetBackground,
  onOpenQueue
}) => {
  const [formatMenuOpen, setFormatMenuOpen] = useState(false);

  const hudItem = activeItem ?? playingItem;
  const dlPercent =
    activeItem?.status === 'downloading'
      ? activeItem.progress
      : activeItem?.status === 'converting' || activeItem?.status === 'completed'
        ? 100
        : playingItem
          ? 100
          : 0;
  const speedPercent =
    activeItem?.status === 'downloading'
      ? computeSpeedPercent(activeItem.speedBytesPerSec)
      : 0;
  const stagePercent = computeStagePercent(activeItem ?? (playingItem ? playingItem : null));

  const outerR = 128;
  const midR = 110;
  const innerR = 92;

  const outerC = 2 * Math.PI * outerR;
  const midC = 2 * Math.PI * midR;
  const innerC = 2 * Math.PI * innerR;

  const outerOffset = outerC - (dlPercent / 100) * outerC;
  const midOffset = midC - (speedPercent / 100) * midC;
  const innerOffset = innerC - (stagePercent / 100) * innerC;

  // Center of the 440x380 stage; radial SVG is centered at (270, 190)
  const dockCx = 270;
  const dockCy = 190;
  const dockRadius = 178;
  const dockAngles = [122, 145.2, 168.4, 191.6, 214.8, 238];

  const coverUrl = hudItem?.thumbnail ?? null;
  const centerPercentText =
    activeItem && (activeItem.status === 'downloading' || activeItem.status === 'converting')
      ? `${Math.round(activeItem.progress)}%`
      : playingItem
        ? isPlaying
          ? 'PLAY'
          : 'PAUSE'
        : 'IDLE';

  const centerSubText =
    activeItem?.status === 'downloading'
      ? `${activeItem.speed} • ${activeItem.eta}`
      : activeItem?.status === 'converting'
        ? activeItem.stage === 'metadata'
          ? 'ID3 & Cover'
          : 'FFmpeg...'
        : playingItem
          ? playingItem.format.toUpperCase()
          : `${format.toUpperCase()} • Sẵn sàng`;

  const dockButtons = [
    {
      key: 'format',
      title: `Định dạng xuất (${format.toUpperCase()})`,
      active: formatMenuOpen,
      onClick: () => setFormatMenuOpen((prev) => !prev),
      content: (
        <span className="text-[10px] font-semibold tracking-wider uppercase">
          {format}
        </span>
      )
    },
    {
      key: 'meta',
      title: embedMeta
        ? 'Nhúng ảnh bìa & ID3 tags: ĐANG BẬT'
        : 'Nhúng ảnh bìa & ID3 tags: ĐANG TẮT',
      active: embedMeta,
      onClick: onToggleEmbedMeta,
      content: <Tag className="w-4 h-4" />
    },
    {
      key: 'select-dir',
      title: 'Chọn thư mục lưu nhạc',
      active: false,
      onClick: onSelectFolder,
      content: <FolderInput className="w-4 h-4" />
    },
    {
      key: 'open-dir',
      title: 'Mở thư mục lưu trong Explorer',
      active: false,
      onClick: onOpenFolder,
      content: <FolderOpen className="w-4 h-4" />
    },
    {
      key: 'bg',
      title: 'Đổi hình nền HUD từ máy',
      active: Boolean(customBgPath),
      onClick: onSelectBackground,
      content: <ImageIcon className="w-4 h-4" />
    },
    {
      key: 'queue',
      title: 'Mở Hàng đợi & Lịch sử tải',
      active: hasActiveDownload,
      onClick: onOpenQueue,
      content: (
        <div className="relative flex items-center justify-center">
          <ListMusic className="w-4 h-4" />
          {queueCount > 0 && (
            <span className="absolute -top-2.5 -right-2.5 min-w-[17px] h-[17px] px-1 rounded-full bg-sky-400 text-slate-950 text-[10px] font-bold flex items-center justify-center shadow-[0_0_10px_rgba(56,189,248,0.8)]">
              {queueCount > 99 ? '99+' : queueCount}
            </span>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="relative w-[440px] h-[380px] shrink-0 select-none app-no-drag">
      {/* Format selector popover */}
      {formatMenuOpen && (
        <div
          className="absolute z-30 left-2 top-3 p-2 rounded-2xl backdrop-blur-xl bg-slate-950/85 border border-white/20 shadow-[0_12px_36px_rgba(0,0,0,0.5)] flex flex-col gap-1 min-w-[148px]"
          onMouseLeave={() => setFormatMenuOpen(false)}
        >
          <div className="px-2 py-1 text-[10px] uppercase tracking-widest text-white/50">
            Định dạng âm thanh
          </div>
          {FORMAT_OPTIONS.map((opt) => {
            const selected = opt.value === format;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChangeFormat(opt.value);
                  setFormatMenuOpen(false);
                }}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-colors ${
                  selected
                    ? 'bg-sky-400/25 text-sky-200 border border-sky-400/50'
                    : 'text-white/80 hover:bg-white/10'
                }`}
              >
                <span className="font-medium">{opt.label}</span>
                <span className="text-[10px] text-white/55">{opt.hint}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Optional quick reset wallpaper chip when custom wallpaper is active */}
      {customBgPath && (
        <button
          type="button"
          onClick={onResetBackground}
          title="Khôi phục nền hoàng hôn mặc định"
          className="absolute left-6 bottom-9 z-20 flex items-center gap-1 px-2.5 py-1 rounded-full backdrop-blur-md bg-slate-950/55 border border-white/15 text-[10px] text-white/75 hover:text-white hover:border-sky-400/50 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Nền mặc định</span>
        </button>
      )}

      {/* Circular Arc Dock wrapping left edge of radial HUD */}
      {dockButtons.map((btn, idx) => {
        const pos = polarToCartesian(dockCx, dockCy, dockRadius, dockAngles[idx]);
        return (
          <button
            key={btn.key}
            type="button"
            title={btn.title}
            onClick={btn.onClick}
            style={{
              left: `${pos.x - 21}px`,
              top: `${pos.y - 21}px`
            }}
            className={`absolute z-20 w-[42px] h-[42px] rounded-full flex items-center justify-center backdrop-blur-md transition-all duration-200 border ${
              btn.active
                ? 'bg-sky-400/25 border-sky-300/75 text-sky-200 shadow-[0_0_18px_rgba(56,189,248,0.45)] scale-105'
                : 'bg-slate-950/50 border-white/20 text-white/80 hover:text-white hover:border-white/50 hover:bg-slate-900/70 hover:scale-105'
            }`}
          >
            {btn.content}
          </button>
        );
      })}

      {/* Concentric SVG Radial HUD */}
      <div
        className="absolute"
        style={{
          left: `${dockCx - 150}px`,
          top: `${dockCy - 150}px`,
          width: '300px',
          height: '300px'
        }}
      >
        <svg viewBox="0 0 300 300" className="w-full h-full overflow-visible">
          <defs>
            <filter id="hud-glow-blue" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Subtle ambient radial glass backing */}
          <circle
            cx="150"
            cy="150"
            r="140"
            fill="rgba(8, 15, 30, 0.28)"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="1"
          />

          {/* Base tracks */}
          <circle
            cx="150"
            cy="150"
            r={outerR}
            fill="none"
            stroke="rgba(255, 255, 255, 0.14)"
            strokeWidth="7"
          />
          <circle
            cx="150"
            cy="150"
            r={midR}
            fill="none"
            stroke="rgba(255, 255, 255, 0.11)"
            strokeWidth="6"
          />
          <circle
            cx="150"
            cy="150"
            r={innerR}
            fill="none"
            stroke="rgba(255, 255, 255, 0.09)"
            strokeWidth="5"
          />

          {/* Active progress arcs */}
          <circle
            cx="150"
            cy="150"
            r={outerR}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={outerC}
            strokeDashoffset={outerOffset}
            transform="rotate(-90 150 150)"
            filter="url(#hud-glow-blue)"
            className="transition-[stroke-dashoffset] duration-300 ease-out"
          />

          <circle
            cx="150"
            cy="150"
            r={midR}
            fill="none"
            stroke="#fbbf24"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={midC}
            strokeDashoffset={midOffset}
            transform="rotate(-90 150 150)"
            className="transition-[stroke-dashoffset] duration-300 ease-out"
          />

          <circle
            cx="150"
            cy="150"
            r={innerR}
            fill="none"
            stroke="#a78bfa"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={innerC}
            strokeDashoffset={innerOffset}
            transform="rotate(-90 150 150)"
            className={`transition-[stroke-dashoffset] duration-500 ease-out ${
              activeItem?.status === 'converting' ? 'animate-pulse' : ''
            }`}
          />

          {/* Rainmeter-inspired micro radial readout labels */}
          <text
            x="150"
            y="16"
            textAnchor="middle"
            className="fill-sky-300/90 text-[9px] font-light tracking-[0.2em]"
          >
            DL {Math.round(dlPercent)}%
          </text>
          <text
            x="150"
            y="36"
            textAnchor="middle"
            className="fill-amber-300/85 text-[8.5px] font-light tracking-[0.18em]"
          >
            {activeItem?.status === 'downloading' ? activeItem.speed : 'SPD --'}
          </text>
          <text
            x="150"
            y="54"
            textAnchor="middle"
            className="fill-violet-300/85 text-[8.5px] font-light tracking-[0.16em]"
          >
            {activeItem?.status === 'converting' ? 'FFMPEG' : 'META'}
          </text>
        </svg>

        {/* Center circular album art & live percentage */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-[144px] h-[144px] rounded-full overflow-hidden border border-white/25 bg-slate-950/70 shadow-[inset_0_0_24px_rgba(0,0,0,0.65)] flex items-center justify-center">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={hudItem?.title ?? 'Album Cover'}
                className="w-full h-full object-cover animate-spin-slow opacity-75"
                style={{
                  animationPlayState: isPlaying ? 'running' : 'paused'
                }}
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-slate-900/90 to-sky-950/60">
                <Music className="w-10 h-10 text-sky-300/35" />
              </div>
            )}

            <div className="absolute inset-0 bg-slate-950/55 flex flex-col items-center justify-center px-2 text-center">
              <span className="text-[28px] leading-none font-extralight tracking-tight text-white tabular-nums">
                {centerPercentText}
              </span>
              <span className="mt-1.5 text-[10px] font-light tracking-wide text-sky-200/90 truncate max-w-[120px]">
                {centerSubText}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
