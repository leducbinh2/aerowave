import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AppConfig,
  AudioFormat,
  DiskInfo,
  QueueItem,
  ToolchainStatus
} from '../shared/types';
import { AudioVisualizer } from './components/AudioVisualizer';
import { BackgroundLayer } from './components/BackgroundLayer';
import { HeroClockBar } from './components/HeroClockBar';
import { QueuePanel } from './components/QueuePanel';
import { RadialHud } from './components/RadialHud';
import { TelemetryBar } from './components/TelemetryBar';
import { ToastBanner, type ToastItem } from './components/ToastBanner';
import { WindowControls } from './components/WindowControls';
import { useAudioPlayer } from './hooks/useAudioPlayer';

export const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig>({
    downloadDir: '',
    format: 'mp3',
    embedMeta: true,
    customBgPath: null
  });
  const [toolchain, setToolchain] = useState<ToolchainStatus | null>(null);
  const [diskInfo, setDiskInfo] = useState<DiskInfo | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = useCallback((type: ToastItem['type'], message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-2), { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const audioPlayer = useAudioPlayer((errMsg) => {
    pushToast('error', errMsg);
  });

  const refreshDisk = useCallback(async (dir?: string) => {
    const info = await window.aerowave.getDiskInfo(dir);
    setDiskInfo(info);
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const [cfg, tc, initialQueue, maximized] = await Promise.all([
        window.aerowave.getConfig(),
        window.aerowave.getToolchainStatus(),
        window.aerowave.getQueue(),
        window.aerowave.isWindowMaximized()
      ]);
      if (!mounted) return;
      setConfig(cfg);
      setToolchain(tc);
      setQueue(initialQueue);
      setIsMaximized(maximized);

      const disk = await window.aerowave.getDiskInfo(cfg.downloadDir);
      if (mounted) setDiskInfo(disk);

      if (!tc.ytDlp.available || !tc.ffmpeg.available) {
        const missing: string[] = [];
        if (!tc.ytDlp.available) missing.push('yt-dlp');
        if (!tc.ffmpeg.available) missing.push('ffmpeg');
        pushToast(
          'error',
          `Thiếu ${missing.join(' & ')} trong PATH hệ thống. Bấm vào chỉ số góc dưới trái để xem lệnh cài đặt.`
        );
      }
    };

    void init();

    const unsubQueue = window.aerowave.onQueueUpdate((items) => {
      setQueue(items);
    });
    const unsubMax = window.aerowave.onMaximizedChange((maximized) => {
      setIsMaximized(maximized);
    });

    const diskTimer = setInterval(() => {
      void window.aerowave.getDiskInfo().then((info) => {
        if (mounted) setDiskInfo(info);
      });
    }, 15000);

    return () => {
      mounted = false;
      unsubQueue();
      unsubMax();
      clearInterval(diskTimer);
    };
  }, [pushToast]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && queueOpen) {
        setQueueOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [queueOpen]);

  const activeItem = useMemo(
    () =>
      queue.find((i) => i.status === 'downloading' || i.status === 'converting') ??
      null,
    [queue]
  );

  const latestCompleted = useMemo(
    () => queue.find((i) => i.status === 'completed') ?? null,
    [queue]
  );

  const featuredItem = activeItem ?? audioPlayer.playingItem ?? latestCompleted;
  const backgroundTarget = audioPlayer.playingItem ?? activeItem ?? latestCompleted;

  const completedCount = useMemo(
    () => queue.filter((i) => i.status === 'completed').length,
    [queue]
  );

  const handleSubmitUrl = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed || isSubmitting) return;

    if (toolchain && !toolchain.ytDlp.available) {
      pushToast('error', 'Chưa tìm thấy yt-dlp trong PATH hệ thống.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await window.aerowave.enqueueUrl(trimmed);
      if (!res.ok) {
        pushToast('error', res.error || 'Không thể thêm liên kết vào hàng đợi.');
        return;
      }

      setUrlInput('');
      if (res.isPlaylist) {
        pushToast(
          'success',
          `Đã thêm ${res.addedCount} bài từ playlist${
            res.playlistTitle ? ` "${res.playlistTitle}"` : ''
          }.`
        );
      } else {
        pushToast('success', 'Đã thêm bài hát vào hàng đợi tải xuống.');
      }
    } catch {
      pushToast('error', 'Lỗi giao tiếp khi xử lý liên kết YouTube.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeFormat = async (format: AudioFormat) => {
    const updated = await window.aerowave.updateConfig({ format });
    setConfig(updated);
    pushToast('info', `Định dạng xuất mặc định: ${format.toUpperCase()}`);
  };

  const handleToggleEmbedMeta = async () => {
    const updated = await window.aerowave.updateConfig({
      embedMeta: !config.embedMeta
    });
    setConfig(updated);
    pushToast(
      'info',
      updated.embedMeta
        ? 'Đã bật tự động nhúng ảnh bìa & ID3 tags.'
        : 'Đã tắt nhúng ảnh bìa & ID3 tags.'
    );
  };

  const handleSelectFolder = async () => {
    const selected = await window.aerowave.selectFolder();
    if (selected) {
      setConfig((prev) => ({ ...prev, downloadDir: selected }));
      await refreshDisk(selected);
      pushToast('success', `Thư mục lưu mới: ${selected}`);
    }
  };

  const handleSelectBackground = async () => {
    const updated = await window.aerowave.selectBackground();
    setConfig(updated);
    if (updated.customBgPath) {
      pushToast('success', 'Đã cập nhật hình nền HUD tùy chọn.');
    }
  };

  const handleResetBackground = async () => {
    const updated = await window.aerowave.updateConfig({ customBgPath: null });
    setConfig(updated);
    pushToast('info', 'Đã khôi phục hình nền hoàng hôn mặc định.');
  };

  const handleShowInFolder = async (filePath: string) => {
    const ok = await window.aerowave.showItemInFolder(filePath);
    if (!ok) {
      pushToast('error', 'Tệp nhạc không còn tồn tại trên ổ đĩa.');
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col justify-between">
      <BackgroundLayer
        trackThumbnail={backgroundTarget?.thumbnail ?? null}
        trackVideoId={backgroundTarget?.videoId ?? null}
        customBgPath={config.customBgPath}
      />

      <WindowControls
        isMaximized={isMaximized}
        onMinimize={() => void window.aerowave.minimizeWindow()}
        onToggleMaximize={() => void window.aerowave.toggleMaximizeWindow()}
        onClose={() => void window.aerowave.closeWindow()}
      />

      <ToastBanner toasts={toasts} onDismiss={dismissToast} />

      {/* Main HUD stage */}
      <main className="relative z-10 flex-1 flex flex-col justify-between pt-14 pb-6 px-8">
        {/* Upper & Center Row: Top-Left Hero Clock/URL + Right Radial HUD & Arc Dock */}
        <div className="flex items-start justify-between gap-6">
          <HeroClockBar
            urlInput={urlInput}
            onUrlChange={setUrlInput}
            onSubmit={() => void handleSubmitUrl()}
            isSubmitting={isSubmitting}
            featuredItem={featuredItem}
            playingItemId={audioPlayer.playingItem?.id ?? null}
            isPlaying={audioPlayer.isPlaying}
            onTogglePlayItem={(item) => void audioPlayer.playItem(item)}
          />

          <div className="pt-2">
            <RadialHud
              activeItem={activeItem}
              playingItem={audioPlayer.playingItem}
              isPlaying={audioPlayer.isPlaying}
              format={config.format}
              embedMeta={config.embedMeta}
              customBgPath={config.customBgPath}
              queueCount={queue.length}
              hasActiveDownload={Boolean(activeItem)}
              onChangeFormat={(fmt) => void handleChangeFormat(fmt)}
              onToggleEmbedMeta={() => void handleToggleEmbedMeta()}
              onSelectFolder={() => void handleSelectFolder()}
              onOpenFolder={() => void window.aerowave.openFolder(config.downloadDir)}
              onSelectBackground={() => void handleSelectBackground()}
              onResetBackground={() => void handleResetBackground()}
              onOpenQueue={() => setQueueOpen(true)}
            />
          </div>
        </div>

        {/* Bottom Row: Bottom-Left Telemetry + Bottom-Right Hanging Audio Visualizer */}
        <div className="flex items-end justify-between gap-6">
          <TelemetryBar
            toolchain={toolchain}
            diskInfo={diskInfo}
            completedCount={completedCount}
            totalCount={queue.length}
            hasActiveDownload={Boolean(activeItem)}
          />

          <AudioVisualizer
            analyserRef={audioPlayer.analyserRef}
            playingItem={audioPlayer.playingItem}
            isPlaying={audioPlayer.isPlaying}
            currentTime={audioPlayer.currentTime}
            duration={audioPlayer.duration}
            volume={audioPlayer.volume}
            onTogglePlay={() => void audioPlayer.togglePlay()}
            onSeek={audioPlayer.seek}
            onVolumeChange={audioPlayer.setVolume}
          />
        </div>
      </main>

      <QueuePanel
        open={queueOpen}
        items={queue}
        playingItemId={audioPlayer.playingItem?.id ?? null}
        isPlaying={audioPlayer.isPlaying}
        onClose={() => setQueueOpen(false)}
        onPlayItem={(item) => void audioPlayer.playItem(item)}
        onShowInFolder={(filePath) => void handleShowInFolder(filePath)}
        onRetryItem={(id) => void window.aerowave.retryItem(id)}
        onCancelItem={(id) => void window.aerowave.cancelItem(id)}
        onRemoveItem={(id) => {
          if (audioPlayer.playingItem?.id === id) {
            audioPlayer.stop();
          }
          void window.aerowave.removeItem(id);
        }}
        onClearCompleted={() => void window.aerowave.clearCompleted()}
        onCancelAll={() => void window.aerowave.cancelAll()}
      />
    </div>
  );
};

export default App;
