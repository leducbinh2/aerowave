export type AudioFormat = 'mp3' | 'flac' | 'm4a' | 'wav';

export type DownloadStatus =
  | 'queued'
  | 'downloading'
  | 'converting'
  | 'completed'
  | 'error'
  | 'cancelled';

export type ProcessingStage =
  | 'idle'
  | 'downloading'
  | 'extracting'
  | 'metadata'
  | 'done';

export interface QueueItem {
  id: string;
  url: string;
  videoId: string;
  title: string;
  uploader: string;
  duration: number | null;
  thumbnail: string | null;
  format: AudioFormat;
  embedMeta: boolean;
  status: DownloadStatus;
  progress: number;
  speed: string;
  speedBytesPerSec: number;
  eta: string;
  stage: ProcessingStage;
  stageText: string;
  filePath: string | null;
  error: string | null;
  addedAt: number;
  completedAt: number | null;
}

export interface AppConfig {
  downloadDir: string;
  format: AudioFormat;
  embedMeta: boolean;
  customBgPath: string | null;
}

export interface ToolchainBinaryStatus {
  available: boolean;
  version: string | null;
}

export interface ToolchainStatus {
  ytDlp: ToolchainBinaryStatus;
  ffmpeg: ToolchainBinaryStatus;
}

export interface DiskInfo {
  drive: string;
  freeGB: number;
  totalGB: number;
  usedPercent: number;
}

export interface EnqueueResult {
  ok: boolean;
  addedCount: number;
  isPlaylist: boolean;
  playlistTitle?: string;
  error?: string;
}

export interface AeroWaveAPI {
  minimizeWindow: () => Promise<void>;
  toggleMaximizeWindow: () => Promise<boolean>;
  closeWindow: () => Promise<void>;
  isWindowMaximized: () => Promise<boolean>;
  onMaximizedChange: (cb: (isMaximized: boolean) => void) => () => void;

  getToolchainStatus: () => Promise<ToolchainStatus>;
  getDiskInfo: (targetPath?: string) => Promise<DiskInfo>;

  getConfig: () => Promise<AppConfig>;
  updateConfig: (partial: Partial<AppConfig>) => Promise<AppConfig>;
  selectFolder: () => Promise<string | null>;
  openFolder: (targetPath?: string) => Promise<void>;
  showItemInFolder: (filePath: string) => Promise<boolean>;
  selectBackground: () => Promise<AppConfig>;

  getQueue: () => Promise<QueueItem[]>;
  enqueueUrl: (url: string) => Promise<EnqueueResult>;
  cancelItem: (id: string) => Promise<void>;
  retryItem: (id: string) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  clearCompleted: () => Promise<void>;
  cancelAll: () => Promise<void>;
  onQueueUpdate: (cb: (items: QueueItem[]) => void) => () => void;

  toMediaUrl: (filePath: string) => string;
}
