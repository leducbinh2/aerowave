import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DiskInfo, ToolchainBinaryStatus, ToolchainStatus } from '../shared/types';

function runVersionCommand(
  binary: string,
  args: string[]
): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = (ok: boolean, output: string) => {
      if (settled) return;
      settled = true;
      resolve({ ok, output });
    };

    try {
      const child = spawn(binary, args, {
        windowsHide: true,
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1'
        }
      });

      const timer = setTimeout(() => {
        try {
          child.kill();
        } catch {
          // ignore
        }
        finish(false, '');
      }, 5000);

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
      });

      child.on('error', () => {
        clearTimeout(timer);
        finish(false, '');
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        const combined = (stdout || stderr).trim();
        finish(code === 0 && combined.length > 0, combined);
      });
    } catch {
      finish(false, '');
    }
  });
}

function parseYtDlpStatus(res: { ok: boolean; output: string }): ToolchainBinaryStatus {
  if (!res.ok) {
    return { available: false, version: null };
  }
  const firstLine = res.output.split(/\r?\n/)[0]?.trim() ?? '';
  return {
    available: true,
    version: firstLine || 'installed'
  };
}

function parseFfmpegStatus(res: { ok: boolean; output: string }): ToolchainBinaryStatus {
  if (!res.ok) {
    return { available: false, version: null };
  }
  const firstLine = res.output.split(/\r?\n/)[0]?.trim() ?? '';
  const match = firstLine.match(/ffmpeg\s+version\s+([^\s]+)/i);
  const rawVersion = match?.[1] ?? firstLine;
  const shortVersion = rawVersion.split('-')[0] || rawVersion;
  return {
    available: true,
    version: shortVersion || 'installed'
  };
}

export async function checkToolchain(): Promise<ToolchainStatus> {
  const [ytDlpRes, ffmpegRes] = await Promise.all([
    runVersionCommand('yt-dlp', ['--version']),
    runVersionCommand('ffmpeg', ['-version'])
  ]);

  return {
    ytDlp: parseYtDlpStatus(ytDlpRes),
    ffmpeg: parseFfmpegStatus(ffmpegRes)
  };
}

async function resolveExistingPath(targetPath: string): Promise<string> {
  let current = path.resolve(targetPath);

  for (let i = 0; i < 16; i += 1) {
    try {
      await fs.promises.access(current);
      return current;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) {
        return current;
      }
      current = parent;
    }
  }
  return current;
}

function extractDriveLabel(targetPath: string): string {
  const parsed = path.parse(path.resolve(targetPath));
  const root = parsed.root || 'C:\\';
  const letterMatch = root.match(/^([A-Za-z]:)/);
  if (letterMatch) {
    return `${letterMatch[1].toUpperCase()}/`;
  }
  return root.replace(/\\/g, '/');
}

export async function getDiskInfo(targetPath: string): Promise<DiskInfo> {
  const drive = extractDriveLabel(targetPath);

  try {
    const existingPath = await resolveExistingPath(targetPath);
    const stats = await fs.promises.statfs(existingPath);
    const bsize = Number(stats.bsize);
    const blocks = Number(stats.blocks);
    const bavail = Number(stats.bavail);

    const totalBytes = blocks * bsize;
    const freeBytes = bavail * bsize;
    const gbDivisor = 1024 ** 3;

    const totalGB = totalBytes > 0 ? Number((totalBytes / gbDivisor).toFixed(1)) : 0;
    const freeGB = freeBytes > 0 ? Number((freeBytes / gbDivisor).toFixed(1)) : 0;
    const usedPercent =
      totalBytes > 0
        ? Math.min(100, Math.max(0, Math.round(((totalBytes - freeBytes) / totalBytes) * 100)))
        : 0;

    return {
      drive,
      freeGB,
      totalGB,
      usedPercent
    };
  } catch {
    return {
      drive,
      freeGB: 0,
      totalGB: 0,
      usedPercent: 0
    };
  }
}

export function killProcessTree(pid: number | undefined): Promise<void> {
  if (!pid || pid <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      try {
        const killer = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
          windowsHide: true
        });
        killer.on('error', () => {
          try {
            process.kill(pid, 'SIGKILL');
          } catch {
            // already exited
          }
          resolve();
        });
        killer.on('close', () => resolve());
      } catch {
        resolve();
      }
      return;
    }

    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // already exited
    }
    resolve();
  });
}
