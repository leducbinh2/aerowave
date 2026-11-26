import React, { useEffect, useRef } from 'react';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react';
import type { QueueItem } from '../../shared/types';

interface AudioVisualizerProps {
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  playingItem: QueueItem | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (vol: number) => void;
}

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00';
  const total = Math.floor(sec);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  analyserRef,
  playingItem,
  isPlaying,
  currentTime,
  duration,
  volume,
  onTogglePlay,
  onSeek,
  onVolumeChange
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const smoothHeightsRef = useRef<Float32Array>(new Float32Array(48));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const barCount = 48;
    const freqBuffer = new Uint8Array(128);

    const draw = (timestamp: number) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const targetW = Math.max(1, Math.floor(rect.width * dpr));
      const targetH = Math.max(1, Math.floor(rect.height * dpr));

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      const width = rect.width;
      const height = rect.height;

      ctx.clearRect(0, 0, width, height);

      const lineY = 2;
      const maxBarHeight = Math.max(12, height - 8);
      const analyser = analyserRef.current;

      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(freqBuffer);
      }

      // Top hairline matching reference screenshot deck edge
      const lineGrad = ctx.createLinearGradient(0, 0, width, 0);
      lineGrad.addColorStop(0, 'rgba(148, 163, 184, 0.15)');
      lineGrad.addColorStop(0.25, 'rgba(186, 230, 253, 0.8)');
      lineGrad.addColorStop(0.8, 'rgba(56, 189, 248, 0.85)');
      lineGrad.addColorStop(1, 'rgba(148, 163, 184, 0.2)');
      ctx.fillStyle = lineGrad;
      ctx.fillRect(0, lineY - 1, width, 1.5);

      const slotWidth = width / barCount;
      const barWidth = Math.max(2, slotWidth * 0.56);
      const timeSec = timestamp * 0.0018;

      for (let i = 0; i < barCount; i += 1) {
        let targetNorm = 0;
        if (analyser && isPlaying) {
          const binIndex = Math.min(
            freqBuffer.length - 1,
            Math.floor((i / barCount) * 72)
          );
          targetNorm = freqBuffer[binIndex] / 255;
        } else {
          // Gentle ambient breathing wave while idle
          const wave1 = Math.sin(timeSec + i * 0.34);
          const wave2 = Math.cos(timeSec * 0.7 - i * 0.21);
          const envelope = Math.sin((i / (barCount - 1)) * Math.PI);
          targetNorm = (0.12 + 0.14 * ((wave1 + wave2) * 0.5 + 1) * 0.5) * (0.45 + 0.55 * envelope);
        }

        const prev = smoothHeightsRef.current[i];
        const next = prev + (targetNorm - prev) * (isPlaying ? 0.38 : 0.08);
        smoothHeightsRef.current[i] = next;

        const barH = Math.max(3, next * maxBarHeight);
        const x = i * slotWidth + (slotWidth - barWidth) * 0.5;

        const barGrad = ctx.createLinearGradient(0, lineY, 0, lineY + barH);
        barGrad.addColorStop(0, 'rgba(125, 211, 252, 0.95)');
        barGrad.addColorStop(0.55, 'rgba(56, 189, 248, 0.78)');
        barGrad.addColorStop(1, 'rgba(37, 99, 235, 0.12)');

        ctx.shadowColor = 'rgba(56, 189, 248, 0.55)';
        ctx.shadowBlur = isPlaying ? 10 : 5;
        ctx.fillStyle = barGrad;
        ctx.fillRect(x, lineY + 1, barWidth, barH);
      }

      ctx.restore();
      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [analyserRef, isPlaying]);

  return (
    <div className="w-[410px] max-w-[44vw] flex flex-col items-end app-no-drag">
      {/* Compact playback scrubber shown when a local track is loaded */}
      {playingItem && (
        <div className="w-full mb-2 px-3 py-1.5 rounded-xl backdrop-blur-md bg-slate-950/40 border border-white/15 flex items-center gap-2.5 text-[11px]">
          <button
            type="button"
            onClick={onTogglePlay}
            title={isPlaying ? 'Tạm dừng' : 'Phát'}
            className="w-6 h-6 rounded-full bg-sky-400/20 hover:bg-sky-400 hover:text-slate-950 text-sky-200 flex items-center justify-center transition-colors shrink-0"
          >
            {isPlaying ? (
              <Pause className="w-3 h-3" />
            ) : (
              <Play className="w-3 h-3 translate-x-[0.5px]" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 text-[10px] text-white/80 mb-0.5">
              <span className="truncate font-light">{playingItem.title}</span>
              <span className="tabular-nums text-white/60 shrink-0">
                {formatSeconds(currentTime)} / {formatSeconds(duration)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={duration > 0 ? duration : 1}
              step={0.1}
              value={Math.min(currentTime, duration || 1)}
              onChange={(e) => onSeek(Number(e.target.value))}
              className="w-full h-1 accent-sky-400 cursor-pointer bg-white/15 rounded-lg"
            />
          </div>

          <button
            type="button"
            onClick={() => onVolumeChange(volume > 0 ? 0 : 0.85)}
            title={volume > 0 ? 'Tắt tiếng' : 'Bật tiếng'}
            className="text-white/65 hover:text-white transition-colors shrink-0"
          >
            {volume > 0 ? (
              <Volume2 className="w-3.5 h-3.5" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-rose-300" />
            )}
          </button>
        </div>
      )}

      {/* Hanging blue Audio Visualizer Canvas */}
      <canvas ref={canvasRef} className="w-full h-[88px] block" />
    </div>
  );
};
