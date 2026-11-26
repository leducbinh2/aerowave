import React, { useState } from 'react';
import { Check, Copy, Terminal, X } from 'lucide-react';
import type { DiskInfo, ToolchainStatus } from '../../shared/types';

interface TelemetryBarProps {
  toolchain: ToolchainStatus | null;
  diskInfo: DiskInfo | null;
  completedCount: number;
  totalCount: number;
  hasActiveDownload: boolean;
}

export const TelemetryBar: React.FC<TelemetryBarProps> = ({
  toolchain,
  diskInfo,
  completedCount,
  totalCount,
  hasActiveDownload
}) => {
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const missingAny =
    toolchain !== null && (!toolchain.ytDlp.available || !toolchain.ffmpeg.available);

  const copyCommand = async (cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCmd(cmd);
      setTimeout(() => setCopiedCmd(null), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="relative flex flex-wrap items-end gap-8 select-none app-no-drag">
      {/* Install command popover if yt-dlp or ffmpeg is missing */}
      {showInstallHelp && missingAny && (
        <div className="absolute bottom-full left-0 mb-3 z-30 w-[340px] p-3.5 rounded-2xl backdrop-blur-xl bg-slate-950/90 border border-amber-400/35 shadow-[0_12px_36px_rgba(0,0,0,0.55)] text-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-amber-300 font-medium">
              <Terminal className="w-3.5 h-3.5" />
              <span>Cài đặt công cụ qua winget</span>
            </div>
            <button
              type="button"
              onClick={() => setShowInstallHelp(false)}
              className="text-white/50 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-white/70 font-light leading-relaxed mb-2">
            Mở PowerShell / CMD và chạy các lệnh sau, sau đó khởi động lại AEROWAVE:
          </p>
          <div className="flex flex-col gap-1.5">
            {!toolchain?.ytDlp.available && (
              <button
                type="button"
                onClick={() => void copyCommand('winget install yt-dlp.yt-dlp')}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 font-mono text-[11px] text-sky-200"
              >
                <span>winget install yt-dlp.yt-dlp</span>
                {copiedCmd === 'winget install yt-dlp.yt-dlp' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-white/55" />
                )}
              </button>
            )}
            {!toolchain?.ffmpeg.available && (
              <button
                type="button"
                onClick={() => void copyCommand('winget install Gyan.FFmpeg')}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 font-mono text-[11px] text-sky-200"
              >
                <span>winget install Gyan.FFmpeg</span>
                {copiedCmd === 'winget install Gyan.FFmpeg' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-white/55" />
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Toolchain status block */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-light tracking-[0.22em] uppercase text-white/55">
          HỆ THỐNG
        </span>
        <div className="flex items-center gap-3 text-xs font-light">
          <button
            type="button"
            onClick={() => {
              if (missingAny) setShowInstallHelp((prev) => !prev);
            }}
            className={`flex items-center gap-1.5 ${
              missingAny ? 'cursor-pointer hover:opacity-90' : 'cursor-default'
            }`}
            title={
              toolchain?.ytDlp.available
                ? `yt-dlp ${toolchain.ytDlp.version}`
                : 'Thiếu yt-dlp trong PATH — bấm để xem lệnh winget'
            }
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                toolchain === null
                  ? 'bg-white/40'
                  : toolchain.ytDlp.available
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                    : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
              }`}
            />
            <span className="text-white/85">yt-dlp</span>
            <span className="text-white/55 text-[11px]">
              {toolchain === null
                ? '...'
                : toolchain.ytDlp.available
                  ? toolchain.ytDlp.version
                  : 'Thiếu'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (missingAny) setShowInstallHelp((prev) => !prev);
            }}
            className={`flex items-center gap-1.5 ${
              missingAny ? 'cursor-pointer hover:opacity-90' : 'cursor-default'
            }`}
            title={
              toolchain?.ffmpeg.available
                ? `ffmpeg ${toolchain.ffmpeg.version}`
                : 'Thiếu ffmpeg trong PATH — bấm để xem lệnh winget'
            }
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                toolchain === null
                  ? 'bg-white/40'
                  : toolchain.ffmpeg.available
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                    : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
              }`}
            />
            <span className="text-white/85">FFmpeg</span>
            <span className="text-white/55 text-[11px]">
              {toolchain === null
                ? '...'
                : toolchain.ffmpeg.available
                  ? toolchain.ffmpeg.version
                  : 'Thiếu'}
            </span>
          </button>
        </div>
      </div>

      {/* Queue counter block */}
      <div className="flex flex-col">
        <span className="text-[10px] font-light tracking-[0.22em] uppercase text-white/55">
          HÀNG ĐỢI
        </span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[28px] leading-none font-extralight tabular-nums text-white drop-shadow">
            {completedCount}/{totalCount}
          </span>
          {hasActiveDownload && (
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
          )}
        </div>
      </div>

      {/* Disk space block matching Rainmeter C:/ D:/ readout */}
      <div className="flex items-center gap-3">
        <span className="text-[28px] leading-none font-extralight text-white drop-shadow">
          {diskInfo?.drive ?? 'C:/'}
        </span>
        <div className="flex flex-col gap-1 min-w-[140px]">
          <div className="flex items-center justify-between gap-3 text-[11px] font-light text-white/85 tabular-nums">
            <span>
              {diskInfo ? `${diskInfo.freeGB} GB trống / ${diskInfo.totalGB} GB` : 'Đang kiểm tra...'}
            </span>
          </div>
          <div className="w-full h-[3px] rounded-full bg-white/15 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 to-sky-200 transition-all duration-500"
              style={{ width: `${diskInfo?.usedPercent ?? 0}%` }}
            />
          </div>
          <span className="text-[10px] font-light text-white/55 tabular-nums">
            {diskInfo ? `${diskInfo.usedPercent}% Đã dùng` : ''}
          </span>
        </div>
      </div>
    </div>
  );
};
