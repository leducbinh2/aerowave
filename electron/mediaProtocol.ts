import { protocol, type CustomScheme } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Readable } from 'node:stream';

export const MEDIA_SCHEME = 'aerowave-media';

export const MEDIA_SCHEME_PRIVILEGES: CustomScheme = {
  scheme: MEDIA_SCHEME,
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    stream: true,
    corsEnabled: true
  }
};

const MIME_BY_EXT: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp'
};

export function toMediaUrl(filePath: string): string {
  return `${MEDIA_SCHEME}://local?path=${encodeURIComponent(filePath)}`;
}

function parseRangeHeader(
  rangeHeader: string,
  fileSize: number
): { start: number; end: number } | null {
  const match = rangeHeader.trim().match(/^bytes=(\d*)-(\d*)$/i);
  if (!match) return null;

  const [, rawStart, rawEnd] = match;

  if (rawStart === '' && rawEnd === '') {
    return null;
  }

  if (rawStart === '') {
    const suffixLength = Number(rawEnd);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    const start = Math.max(0, fileSize - suffixLength);
    return { start, end: fileSize - 1 };
  }

  const start = Number(rawStart);
  const end = rawEnd === '' ? fileSize - 1 : Math.min(fileSize - 1, Number(rawEnd));

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || start >= fileSize) {
    return null;
  }

  return { start, end };
}

export function registerMediaProtocol(): void {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    try {
      const parsedUrl = new URL(request.url);
      if (parsedUrl.hostname !== 'local') {
        return new Response('Bad Request', { status: 400 });
      }

      const filePath = parsedUrl.searchParams.get('path');
      if (!filePath) {
        return new Response('Missing file path', { status: 400 });
      }

      const ext = path.extname(filePath).toLowerCase();
      const mimeType = MIME_BY_EXT[ext];
      if (!mimeType) {
        return new Response('Unsupported media type', { status: 403 });
      }

      let stat: fs.Stats;
      try {
        stat = await fs.promises.stat(filePath);
      } catch {
        return new Response('File not found', { status: 404 });
      }

      if (!stat.isFile()) {
        return new Response('Not a file', { status: 404 });
      }

      const fileSize = stat.size;
      const baseHeaders: Record<string, string> = {
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      };

      const rangeHeader = request.headers.get('range');
      if (rangeHeader) {
        if (fileSize === 0) {
          return new Response(null, {
            status: 416,
            headers: {
              ...baseHeaders,
              'Content-Range': 'bytes */0'
            }
          });
        }

        const parsedRange = parseRangeHeader(rangeHeader, fileSize);
        if (!parsedRange) {
          return new Response(null, {
            status: 416,
            headers: {
              ...baseHeaders,
              'Content-Range': `bytes */${fileSize}`
            }
          });
        }

        const { start, end } = parsedRange;
        const contentLength = end - start + 1;
        const stream = Readable.toWeb(
          fs.createReadStream(filePath, { start, end })
        ) as unknown as ReadableStream<Uint8Array>;

        return new Response(stream, {
          status: 206,
          headers: {
            ...baseHeaders,
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Content-Length': String(contentLength)
          }
        });
      }

      const stream = Readable.toWeb(
        fs.createReadStream(filePath)
      ) as unknown as ReadableStream<Uint8Array>;

      return new Response(stream, {
        status: 200,
        headers: {
          ...baseHeaders,
          'Content-Length': String(fileSize)
        }
      });
    } catch {
      return new Response('Internal Media Error', { status: 500 });
    }
  });
}
