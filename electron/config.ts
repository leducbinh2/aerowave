import { app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AppConfig, AudioFormat } from '../shared/types';

const VALID_FORMATS: ReadonlySet<AudioFormat> = new Set(['mp3', 'flac', 'm4a', 'wav']);

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'config.json');
}

export function getDefaultConfig(): AppConfig {
  return {
    downloadDir: path.join(app.getPath('music'), 'AEROWAVE'),
    format: 'mp3',
    embedMeta: true,
    customBgPath: null
  };
}

function sanitizeConfig(raw: Partial<AppConfig>, fallback: AppConfig): AppConfig {
  const format =
    raw.format && VALID_FORMATS.has(raw.format) ? raw.format : fallback.format;
  const downloadDir =
    typeof raw.downloadDir === 'string' && raw.downloadDir.trim().length > 0
      ? raw.downloadDir.trim()
      : fallback.downloadDir;
  const embedMeta =
    typeof raw.embedMeta === 'boolean' ? raw.embedMeta : fallback.embedMeta;
  const customBgPath =
    raw.customBgPath === null
      ? null
      : typeof raw.customBgPath === 'string' && raw.customBgPath.trim().length > 0
        ? raw.customBgPath.trim()
        : fallback.customBgPath;

  return {
    downloadDir,
    format,
    embedMeta,
    customBgPath
  };
}

export async function loadConfig(): Promise<AppConfig> {
  const defaults = getDefaultConfig();
  const configPath = getConfigPath();

  try {
    const rawText = await fs.promises.readFile(configPath, 'utf8');
    const parsed = JSON.parse(rawText) as Partial<AppConfig>;
    return sanitizeConfig(parsed, defaults);
  } catch {
    await persistConfig(defaults);
    return defaults;
  }
}

export async function persistConfig(config: AppConfig): Promise<void> {
  const configPath = getConfigPath();
  await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
  await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
}

export async function updateConfig(
  current: AppConfig,
  partial: Partial<AppConfig>
): Promise<AppConfig> {
  const next = sanitizeConfig(partial, current);
  await persistConfig(next);
  return next;
}
