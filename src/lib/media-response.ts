import { promises as fs } from 'node:fs';
import { Readable } from 'node:stream';
import path from 'node:path';

const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.flac': 'audio/flac', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8' };

/** One bounded file stream, shared by original-output and library player URLs. */
export async function serveMediaFile(request: Request, file: string): Promise<Response> {
  const headers = new Headers({ 'Cache-Control': 'private, no-store', 'Accept-Ranges': 'bytes', 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
  const handle = await fs.open(file, 'r');
  let streaming = false;
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) return new Response(null, { status: 404, headers });
    let start = 0, end = stat.size - 1, status = 200;
    const range = request.headers.get('range');
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      let valid = !!match && !!(match[1] || match[2]) && stat.size > 0;
      if (match && valid) {
        if (match[1]) { start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), end) : end; }
        else { const suffix = Number(match[2]); start = Math.max(0, stat.size - suffix); valid = suffix > 0 && Number.isSafeInteger(suffix); }
        valid = valid && Number.isSafeInteger(start) && Number.isSafeInteger(end) && start <= end && start < stat.size;
      }
      if (!valid) { headers.set('Content-Range', `bytes */${stat.size}`); return new Response(null, { status: 416, headers }); }
      status = 206; headers.set('Content-Range', `bytes ${start}-${end}/${stat.size}`);
    }
    headers.set('Content-Length', String(Math.max(0, end - start + 1)));
    if (request.method === 'HEAD' || stat.size === 0) return new Response(null, { status, headers });
    const stream = handle.createReadStream({ start, end, autoClose: true, highWaterMark: 64 * 1024 });
    streaming = true;
    const abort = () => stream.destroy();
    request.signal.addEventListener('abort', abort, { once: true });
    stream.once('close', () => request.signal.removeEventListener('abort', abort));
    if (request.signal.aborted) abort();
    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, { status, headers });
  } finally { if (!streaming) await handle.close(); }
}
