import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  AudioFormat,
  EnqueueResult,
  QueueItem
} from '../shared/types';
import { killProcessTree } from './system';

const ALLOWED_YT_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be'
]);

interface YtDlpThumbnail {
  url?: string;
}

interface YtDlpEntry {
  id?: string;
  title?: string;
  uploader?: string;
  channel?: string;
  duration?: number | null;
  thumbnail?: string;
  thumbnails?: YtDlpThumbnail[];
  webpage_url?: string;
  url?: string;
}

interface YtDlpDump extends YtDlpEntry {
  _type?: string;
  entries?: Array<YtDlpEntry | null>;
}

const YT_DLP_ENV = {
  ...process.env,
  PYTHONIOENCODING: 'utf-8',
  PYTHONUTF8: '1'
};

function isValidYouTubeUrl(rawUrl: string): URL | null {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    if (!ALLOWED_YT_HOSTS.has(parsed.hostname.toLowerCase())) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function pickThumbnail(entry: YtDlpEntry): string | null {
  if (Array.isArray(entry.thumbnails) && entry.thumbnails.length > 0) {
    for (let i = entry.thumbnails.length - 1; i >= 0; i -= 1) {
      const candidate = entry.thumbnails[i]?.url;
      if (candidate && candidate.startsWith('http')) {
        return candidate;
      }
    }
  }
  if (entry.thumbnail && entry.thumbnail.startsWith('http')) {
    return entry.thumbnail;
  }
  if (entry.id) {
    return `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`;
  }
  return null;
}

function parseSpeedToBytesPerSec(speedText: string): number {
  const match = speedText.trim().match(/^([\d.]+)\s*([KMG]?i?B)\/s$/i);
  if (!match) return 0;

  const value = Number(match[1]);
  if (!Number.isFinite(value)) return 0;

  const unit = match[2].toUpperCase();
  switch (unit) {
    case 'B':
      return value;
    case 'KB':
      return value * 1_000;
    case 'KIB':
      return value * 1_024;
    case 'MB':
      return value * 1_000_000;
    case 'MIB':
      return value * 1_048_576;
    case 'GB':
      return value * 1_000_000_000;
    case 'GIB':
      return value * 1_073_741_824;
    default:
      return 0;
  }
}

function translateYtDlpError(rawError: string): string {
  const text = rawError.toLowerCase();
  if (!text.trim()) {
    return 'Không thể xử lý yêu cầu tải xuống. Vui lòng thử lại.';
  }
  if (text.includes('enoent') || text.includes('not recognized')) {
    return 'Thiếu yt-dlp trong PATH hệ thống.';
  }
  if (text.includes('ffmpeg') && (text.includes('not found') || text.includes('probe') || text.includes('ffprobe'))) {
    return 'Thiếu FFmpeg/FFprobe trong PATH để chuyển đổi âm thanh.';
  }
  if (text.includes('private video')) {
    return 'Video ở chế độ riêng tư (Private), không thể truy cập.';
  }
  if (text.includes('members-only') || text.includes('join this channel')) {
    return 'Video chỉ dành cho hội viên kênh.';
  }
  if (text.includes('video unavailable') || text.includes('this video is not available')) {
    return 'Video không tồn tại hoặc đã bị gỡ khỏi YouTube.';
  }
  if (text.includes('sign in to confirm') || text.includes('age-restricted')) {
    return 'Video bị giới hạn độ tuổi hoặc yêu cầu đăng nhập YouTube.';
  }
  if (
    text.includes('unable to download webpage') ||
    text.includes('getaddrinfo') ||
    text.includes('timed out') ||
    text.includes('connection') ||
    text.includes('network is unreachable')
  ) {
    return 'Lỗi kết nối mạng khi truy cập YouTube.';
  }
  if (text.includes('playlist does not exist') || text.includes('the playlist does not exist')) {
    return 'Playlist không tồn tại hoặc đang ở chế độ riêng tư.';
  }
  if (text.includes('unsupported url') || text.includes('is not a valid url')) {
    return 'Liên kết YouTube không hợp lệ.';
  }

  const lines = rawError
    .split(/\r?\n/)
    .map((line) => line.replace(/^ERROR:\s*/i, '').trim())
    .filter(Boolean);
  return lines[lines.length - 1] ?? 'Đã xảy ra lỗi không xác định khi tải.';
}

function buildFormatArgs(format: AudioFormat, embedMeta: boolean): string[] {
  const args: string[] = ['-x', '--audio-format', format];

  if (format === 'mp3') {
    args.push('--audio-quality', '320K');
  } else if (format === 'm4a') {
    args.push('--audio-quality', '0');
  }

  if (embedMeta) {
    if (format === 'mp3' || format === 'm4a') {
      args.push(
        '--embed-thumbnail',
        '--convert-thumbnails',
        'jpg',
        '--ppa',
        'ThumbnailsConvertor+ffmpeg_o:-c:v mjpeg -vf crop=(iw+ih-abs(iw-ih))/2:(iw+ih-abs(iw-ih))/2',
        '--add-metadata'
      );
    } else {
      args.push('--add-metadata');
    }
  }

  return args;
}

export class DownloadManager {
  private queue: QueueItem[] = [];
  private activeProcesses = new Map<string, ChildProcess>();
  private cancelledIds = new Set<string>();
  private isProcessing = false;
  private isDestroying = false;
  private readonly onQueueUpdate: (items: QueueItem[]) => void;

  constructor(onQueueUpdate: (items: QueueItem[]) => void) {
    this.onQueueUpdate = onQueueUpdate;
  }

  getQueue(): QueueItem[] {
    return this.queue.map((item) => ({ ...item }));
  }

  private emitUpdate(): void {
    this.onQueueUpdate(this.getQueue());
  }

  private updateItem(id: string, patch: Partial<QueueItem>): void {
    const index = this.queue.findIndex((item) => item.id === id);
    if (index === -1) return;
    this.queue[index] = { ...this.queue[index], ...patch };
    this.emitUpdate();
  }

  async enqueueUrl(
    rawUrl: string,
    format: AudioFormat,
    embedMeta: boolean,
    downloadDir: string
  ): Promise<EnqueueResult> {
    const parsedUrl = isValidYouTubeUrl(rawUrl);
    if (!parsedUrl) {
      return {
        ok: false,
        addedCount: 0,
        isPlaylist: false,
        error: 'Vui lòng nhập liên kết YouTube hợp lệ (youtube.com hoặc youtu.be).'
      };
    }

    const inspectResult = await this.inspectMetadata(parsedUrl.toString());
    if (!inspectResult.ok || !inspectResult.data) {
      return {
        ok: false,
        addedCount: 0,
        isPlaylist: false,
        error: inspectResult.error ?? 'Không thể đọc thông tin video từ YouTube.'
      };
    }

    const dump = inspectResult.data;
    const isPlaylist = dump._type === 'playlist' || Array.isArray(dump.entries);
    const now = Date.now();
    const newItems: QueueItem[] = [];

    if (isPlaylist && Array.isArray(dump.entries)) {
      for (const entry of dump.entries) {
        if (!entry) continue;
        const entryTitle = entry.title?.trim();
        if (entryTitle === '[Deleted video]' || entryTitle === '[Private video]') {
          continue;
        }
        const entryUrl =
          entry.webpage_url ||
          (entry.url && entry.url.startsWith('http')
            ? entry.url
            : entry.id
              ? `https://www.youtube.com/watch?v=${entry.id}`
              : '');

        if (!entryUrl) continue;

        newItems.push({
          id: randomUUID(),
          url: entryUrl,
          videoId: entry.id ?? '',
          title: entryTitle || 'Video chưa rõ tiêu đề',
          uploader: entry.uploader || entry.channel || dump.uploader || dump.channel || 'YouTube',
          duration: typeof entry.duration === 'number' ? entry.duration : null,
          thumbnail: pickThumbnail(entry),
          format,
          embedMeta,
          status: 'queued',
          progress: 0,
          speed: '0 B/s',
          speedBytesPerSec: 0,
          eta: '--:--',
          stage: 'idle',
          stageText: 'Đang chờ trong hàng đợi',
          filePath: null,
          error: null,
          addedAt: now,
          completedAt: null
        });
      }

      if (newItems.length === 0) {
        return {
          ok: false,
          addedCount: 0,
          isPlaylist: true,
          error: 'Playlist không có video khả dụng nào để tải.'
        };
      }
    } else {
      const videoUrl = dump.webpage_url || parsedUrl.toString();
      newItems.push({
        id: randomUUID(),
        url: videoUrl,
        videoId: dump.id ?? '',
        title: dump.title?.trim() || 'Video YouTube',
        uploader: dump.uploader || dump.channel || 'YouTube',
        duration: typeof dump.duration === 'number' ? dump.duration : null,
        thumbnail: pickThumbnail(dump),
        format,
        embedMeta,
        status: 'queued',
        progress: 0,
        speed: '0 B/s',
        speedBytesPerSec: 0,
        eta: '--:--',
        stage: 'idle',
        stageText: 'Đang chờ trong hàng đợi',
        filePath: null,
        error: null,
        addedAt: now,
        completedAt: null
      });
    }

    this.queue.unshift(...newItems);
    this.emitUpdate();
    void this.processQueue(downloadDir);

    return {
      ok: true,
      addedCount: newItems.length,
      isPlaylist,
      playlistTitle: isPlaylist ? dump.title?.trim() : undefined
    };
  }

  private inspectMetadata(
    url: string
  ): Promise<{ ok: boolean; data?: YtDlpDump; error?: string }> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let settled = false;

      const finish = (result: { ok: boolean; data?: YtDlpDump; error?: string }) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      try {
        const child = spawn(
          'yt-dlp',
          [
            '--flat-playlist',
            '--dump-single-json',
            '--no-warnings',
            '--ignore-errors',
            '--encoding',
            'utf-8',
            url
          ],
          {
            windowsHide: true,
            env: YT_DLP_ENV
          }
        );

        const timer = setTimeout(() => {
          void killProcessTree(child.pid);
          finish({
            ok: false,
            error: 'Quá thời gian chờ khi đọc thông tin từ YouTube.'
          });
        }, 30000);

        child.stdout.on('data', (chunk: Buffer) => {
          stdout += chunk.toString('utf8');
        });
        child.stderr.on('data', (chunk: Buffer) => {
          stderr += chunk.toString('utf8');
        });

        child.on('error', (err) => {
          clearTimeout(timer);
          finish({
            ok: false,
            error: translateYtDlpError(err.message)
          });
        });

        child.on('close', (code) => {
          clearTimeout(timer);
          const trimmed = stdout.trim();
          if (trimmed) {
            try {
              const parsed = JSON.parse(trimmed) as YtDlpDump;
              finish({ ok: true, data: parsed });
              return;
            } catch {
              // fall through to error translation
            }
          }
          finish({
            ok: false,
            error:
              code === 0
                ? 'Không nhận được dữ liệu metadata từ yt-dlp.'
                : translateYtDlpError(stderr)
          });
        });
      } catch (err) {
        finish({
          ok: false,
          error: translateYtDlpError(err instanceof Error ? err.message : String(err))
        });
      }
    });
  }

  private async processQueue(downloadDir: string): Promise<void> {
    if (this.isProcessing || this.isDestroying) return;
    this.isProcessing = true;

    try {
      while (!this.isDestroying) {
        const nextItem = [...this.queue]
          .reverse()
          .find((item) => item.status === 'queued');

        if (!nextItem) break;

        await this.downloadItem(nextItem, downloadDir);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async downloadItem(item: QueueItem, downloadDir: string): Promise<void> {
    this.cancelledIds.delete(item.id);
    this.updateItem(item.id, {
      status: 'downloading',
      progress: 0,
      speed: '0 B/s',
      speedBytesPerSec: 0,
      eta: '--:--',
      stage: 'downloading',
      stageText: 'Đang chuẩn bị tải xuống...',
      error: null
    });

    try {
      await fs.promises.mkdir(downloadDir, { recursive: true });
    } catch (err) {
      this.updateItem(item.id, {
        status: 'error',
        stage: 'idle',
        stageText: 'Lỗi thư mục lưu',
        error: `Không thể tạo thư mục lưu nhạc: ${err instanceof Error ? err.message : String(err)}`
      });
      return;
    }

    const outputTemplate = path.join(downloadDir, '%(title).180B.%(ext)s');
    const args = [
      ...buildFormatArgs(item.format, item.embedMeta),
      '--newline',
      '--progress',
      '--no-colors',
      '--no-playlist',
      '--windows-filenames',
      '--encoding',
      'utf-8',
      '--print',
      'after_move:AEROWAVE_FILEPATH:%(filepath)s',
      '-o',
      outputTemplate,
      item.url
    ];

    await new Promise<void>((resolve) => {
      let resolvedPath: string | null = null;
      let fallbackPath: string | null = null;
      const stderrLines: string[] = [];
      let stdoutBuffer = '';
      let stderrBuffer = '';

      const handleLine = (rawLine: string, isErrorStream: boolean) => {
        const line = rawLine.trim();
        if (!line) return;

        if (isErrorStream) {
          stderrLines.push(line);
        }

        if (line.startsWith('AEROWAVE_FILEPATH:')) {
          const captured = line.slice('AEROWAVE_FILEPATH:'.length).trim();
          if (captured) resolvedPath = captured;
          return;
        }

        const destMatch = line.match(/^\[(?:ExtractAudio|download)\]\s+Destination:\s+(.+)$/);
        if (destMatch?.[1]) {
          fallbackPath = destMatch[1].trim();
        }

        const alreadyMatch = line.match(/^\[download\]\s+(.+)\s+has already been downloaded$/);
        if (alreadyMatch?.[1]) {
          fallbackPath = alreadyMatch[1].trim();
        }

        const progressMatch = line.match(
          /^\[download\]\s+([\d.]+)%\s+of\s+~?[\d.]+\S+(?:\s+at\s+([^\s]+))?(?:\s+ETA\s+([^\s]+))?/
        );
        if (progressMatch) {
          const pct = Math.min(100, Math.max(0, Number(progressMatch[1]) || 0));
          const speedText = progressMatch[2] && progressMatch[2] !== 'Unknown' ? progressMatch[2] : '0 B/s';
          const etaText = progressMatch[3] && progressMatch[3] !== 'Unknown' ? progressMatch[3] : '--:--';
          this.updateItem(item.id, {
            status: 'downloading',
            progress: pct,
            speed: speedText,
            speedBytesPerSec: parseSpeedToBytesPerSec(speedText),
            eta: etaText,
            stage: 'downloading',
            stageText: `Đang tải luồng âm thanh (${pct.toFixed(1)}%)`
          });
          return;
        }

        if (line.includes('[ExtractAudio]') || line.includes('[FixupM4a]')) {
          this.updateItem(item.id, {
            status: 'converting',
            progress: 100,
            speed: '0 B/s',
            speedBytesPerSec: 0,
            eta: '00:00',
            stage: 'extracting',
            stageText: `Đang chuyển đổi sang ${item.format.toUpperCase()} (FFmpeg)...`
          });
          return;
        }

        if (
          line.includes('[EmbedThumbnail]') ||
          line.includes('[ThumbnailsConvertor]') ||
          line.includes('[Metadata]')
        ) {
          this.updateItem(item.id, {
            status: 'converting',
            progress: 100,
            speed: '0 B/s',
            speedBytesPerSec: 0,
            eta: '00:00',
            stage: 'metadata',
            stageText: 'Đang nhúng ảnh bìa & ID3 tags...'
          });
        }
      };

      try {
        const child = spawn('yt-dlp', args, {
          windowsHide: true,
          env: YT_DLP_ENV
        });

        this.activeProcesses.set(item.id, child);

        child.stdout.on('data', (chunk: Buffer) => {
          stdoutBuffer += chunk.toString('utf8');
          const parts = stdoutBuffer.split(/\r\n|\n|\r/);
          stdoutBuffer = parts.pop() ?? '';
          for (const part of parts) {
            handleLine(part, false);
          }
        });

        child.stderr.on('data', (chunk: Buffer) => {
          stderrBuffer += chunk.toString('utf8');
          const parts = stderrBuffer.split(/\r\n|\n|\r/);
          stderrBuffer = parts.pop() ?? '';
          for (const part of parts) {
            handleLine(part, true);
          }
        });

        child.on('error', (err) => {
          this.activeProcesses.delete(item.id);
          if (this.cancelledIds.has(item.id)) {
            resolve();
            return;
          }
          this.updateItem(item.id, {
            status: 'error',
            speed: '0 B/s',
            speedBytesPerSec: 0,
            stage: 'idle',
            stageText: 'Tải thất bại',
            error: translateYtDlpError(err.message)
          });
          resolve();
        });

        child.on('close', (code) => {
          if (stdoutBuffer) handleLine(stdoutBuffer, false);
          if (stderrBuffer) handleLine(stderrBuffer, true);
          this.activeProcesses.delete(item.id);

          if (this.cancelledIds.has(item.id) || this.isDestroying) {
            this.updateItem(item.id, {
              status: 'cancelled',
              speed: '0 B/s',
              speedBytesPerSec: 0,
              stage: 'idle',
              stageText: 'Đã hủy'
            });
            resolve();
            return;
          }

          const finalPath = resolvedPath || fallbackPath;
          if (code === 0 && finalPath && fs.existsSync(finalPath)) {
            this.updateItem(item.id, {
              status: 'completed',
              progress: 100,
              speed: '0 B/s',
              speedBytesPerSec: 0,
              eta: '00:00',
              stage: 'done',
              stageText: 'Hoàn tất',
              filePath: finalPath,
              error: null,
              completedAt: Date.now()
            });
          } else {
            this.updateItem(item.id, {
              status: 'error',
              speed: '0 B/s',
              speedBytesPerSec: 0,
              stage: 'idle',
              stageText: 'Tải thất bại',
              error: translateYtDlpError(stderrLines.join('\n'))
            });
          }
          resolve();
        });
      } catch (err) {
        this.activeProcesses.delete(item.id);
        this.updateItem(item.id, {
          status: 'error',
          stage: 'idle',
          stageText: 'Tải thất bại',
          error: translateYtDlpError(err instanceof Error ? err.message : String(err))
        });
        resolve();
      }
    });
  }

  async cancelItem(id: string): Promise<void> {
    const item = this.queue.find((q) => q.id === id);
    if (!item) return;

    this.cancelledIds.add(id);
    const proc = this.activeProcesses.get(id);
    if (proc?.pid) {
      await killProcessTree(proc.pid);
      this.activeProcesses.delete(id);
    }

    this.updateItem(id, {
      status: 'cancelled',
      speed: '0 B/s',
      speedBytesPerSec: 0,
      stage: 'idle',
      stageText: 'Đã hủy'
    });
  }

  async retryItem(id: string, downloadDir: string): Promise<void> {
    const item = this.queue.find((q) => q.id === id);
    if (!item || item.status === 'downloading' || item.status === 'converting') {
      return;
    }

    this.cancelledIds.delete(id);
    this.updateItem(id, {
      status: 'queued',
      progress: 0,
      speed: '0 B/s',
      speedBytesPerSec: 0,
      eta: '--:--',
      stage: 'idle',
      stageText: 'Đang chờ trong hàng đợi',
      error: null
    });

    void this.processQueue(downloadDir);
  }

  async removeItem(id: string): Promise<void> {
    const item = this.queue.find((q) => q.id === id);
    if (!item) return;

    if (item.status === 'downloading' || item.status === 'converting') {
      await this.cancelItem(id);
    }

    this.queue = this.queue.filter((q) => q.id !== id);
    this.emitUpdate();
  }

  clearCompleted(): void {
    this.queue = this.queue.filter(
      (item) =>
        item.status === 'queued' ||
        item.status === 'downloading' ||
        item.status === 'converting'
    );
    this.emitUpdate();
  }

  async cancelAll(): Promise<void> {
    for (const item of this.queue) {
      if (item.status === 'queued') {
        this.cancelledIds.add(item.id);
        item.status = 'cancelled';
        item.stage = 'idle';
        item.stageText = 'Đã hủy';
      }
    }

    const activeKills: Promise<void>[] = [];
    for (const [id, proc] of this.activeProcesses.entries()) {
      this.cancelledIds.add(id);
      activeKills.push(killProcessTree(proc.pid));
    }
    await Promise.all(activeKills);
    this.activeProcesses.clear();
    this.emitUpdate();
  }

  async destroyAll(): Promise<void> {
    this.isDestroying = true;
    const kills: Promise<void>[] = [];
    for (const proc of this.activeProcesses.values()) {
      kills.push(killProcessTree(proc.pid));
    }
    await Promise.all(kills);
    this.activeProcesses.clear();
  }
}
