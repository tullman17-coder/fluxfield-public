import { promises as fs, constants } from "fs";
import type { StudioJob } from "@/lib/adapters/types";
import path from "path";
import { BlockList, isIP } from "node:net";
import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { nanoid } from "nanoid";

const MAX_BYTES = 8 * 1024 * 1024;
const UPLOADS = () => path.join(process.cwd(), ".data", "uploads");

export class ReferenceInputError extends Error {}

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif",
};

const nonPublic = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) nonPublic.addSubnet(address, prefix, "ipv4");
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
for (const [address, prefix] of [["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20]] as const) {
  nonPublic.addSubnet(address, prefix, "ipv6");
}

export function isPublicAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return !nonPublic.check(address, "ipv4");
  // Reject mapped/compatible IPv4, translation, local, multicast and transition ranges.
  return family === 6 && globalV6.check(address, "ipv6") && !nonPublic.check(address, "ipv6");
}

function hostAllowed(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || (!host.includes(":") && !host.includes("."))) return false;
  return !isIP(host) || isPublicAddress(host);
}

export const UPLOAD_LIMITS = { referenceImage: MAX_BYTES, voiceSample: MAX_BYTES, soundtrack: 64 * 1024 * 1024 };
type UploadKind = keyof typeof UPLOAD_LIMITS;
const AUDIO_TYPES: Record<string, string> = {
  "audio/wav": ".wav", "audio/wave": ".wav", "audio/x-wav": ".wav", "audio/vnd.wave": ".wav",
  "audio/flac": ".flac", "audio/x-flac": ".flac", "audio/mpeg": ".mp3", "audio/mp3": ".mp3",
};

function detectedFormat(bytes: Buffer): string | undefined {
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.toString("ascii", 12, 16) === "IHDR") return ".png";
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return ".jpg";
  if (/^GIF8[79]a$/.test(bytes.toString("ascii", 0, 6))) return ".gif";
  if (bytes.toString("ascii", 0, 4) === "RIFF") {
    if (bytes.toString("ascii", 8, 12) === "WEBP") return ".webp";
    if (bytes.toString("ascii", 8, 12) === "WAVE") return ".wav";
  }
  if (bytes.toString("ascii", 0, 4) === "fLaC") return ".flac";
  if (bytes.toString("ascii", 0, 3) === "ID3" || bytes.length >= 4 && bytes[0] === 255 && (bytes[1] & 0xe0) === 0xe0 && (bytes[1] & 0x06) !== 0 && (bytes[2] & 0xf0) !== 0xf0) return ".mp3";
}
const canonicalExt = (ext: string) => ext.toLowerCase() === ".jpeg" ? ".jpg" : ext.toLowerCase();

function validateBytes(bytes: Buffer, ext: string, kind: UploadKind) {
  if (!bytes.length || bytes.length > UPLOAD_LIMITS[kind]) throw new ReferenceInputError(`${kind} size must be 1–${UPLOAD_LIMITS[kind] / 1024 / 1024}MB`);
  const allowed = kind === "referenceImage" ? Object.values(IMAGE_TYPES) : kind === "voiceSample" ? [".wav", ".flac"] : [".wav", ".flac", ".mp3"];
  if (!allowed.includes(ext) || detectedFormat(bytes) !== ext) throw new ReferenceInputError(`Unsupported or mismatched ${kind} format`);
}

async function saveBytes(bytes: Buffer, ext: string) {
  const name = `${nanoid(8)}${ext}`;
  const dest = path.join(UPLOADS(), name);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, bytes, { flag: "wx" });
  return { dest, name };
}

export async function saveReferenceBytes(bytes: Buffer, ext: string) {
  ext = canonicalExt(ext);
  validateBytes(bytes, ext, "referenceImage");
  return saveBytes(bytes, ext);
}

/** Validate metadata before File.arrayBuffer (including other files in a request). */
export function validateUpload(file: Pick<File, "size" | "type" | "name">, kind: UploadKind) {
  if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > UPLOAD_LIMITS[kind]) throw new ReferenceInputError(`${kind} size must be 1–${UPLOAD_LIMITS[kind] / 1024 / 1024}MB`);
  const ext = canonicalExt(path.extname(file.name));
  const types = kind === "referenceImage" ? IMAGE_TYPES : AUDIO_TYPES;
  const mime = file.type.toLowerCase();
  if (!Object.values(types).includes(ext) || kind === "voiceSample" && ext === ".mp3" || mime && mime !== "application/octet-stream" && types[mime] !== ext) throw new ReferenceInputError(`Unsupported ${kind} type or format`);
  return ext;
}

export async function saveUpload(file: File, kind: UploadKind) {
  const ext = validateUpload(file, kind);
  const bytes = Buffer.from(await file.arrayBuffer());
  validateBytes(bytes, ext, kind);
  if (bytes.length !== file.size) throw new ReferenceInputError("Upload size changed while reading");
  return saveBytes(bytes, ext);
}

/** Copy a saved Create reference through one bounded, no-follow file handle. */
export async function reuseReferenceImage(source: StudioJob | undefined) {
  if (!source || source.tool !== "dream" || source.workflowSlug !== "dream" || typeof source.referenceImagePath !== "string" || !source.referenceImagePath) throw new ReferenceInputError("Saved Create reference is unavailable");
  const file = source.referenceImagePath;
  const name = path.basename(file);
  // Legacy records keep an absolute release prefix plus the durable upload name.
  // Map only that exact layout/identity; never reopen the old release's path.
  const legacyUpload = path.isAbsolute(file) && source.inputs?.referenceImage === name &&
    file === path.join(path.dirname(path.dirname(path.dirname(file))), ".data", "uploads", name);
  if (!/^[A-Za-z0-9_-]{8}\.(?:png|jpg|jpeg|webp|gif)$/i.test(name) || file !== path.join(UPLOADS(), name) && !legacyUpload) throw new ReferenceInputError("Saved reference is not an owned upload");
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
  let bytes: Buffer;
  try {
    // The configured .data may be shared; uploads itself and its leaf must not be symlinks.
    const uploads = path.join(await fs.realpath(path.dirname(UPLOADS())), "uploads");
    if (await fs.realpath(uploads) !== uploads) throw new ReferenceInputError("Saved reference is not an owned upload");
    handle = await fs.open(path.join(uploads, name), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size < 1 || stat.size > MAX_BYTES) throw new ReferenceInputError("Saved reference has invalid type or size");
    const buffer = Buffer.alloc(stat.size + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length !== stat.size) throw new ReferenceInputError("Saved reference size changed while reading");
    bytes = buffer.subarray(0, length);
  } catch (error) {
    if (error instanceof ReferenceInputError) throw error;
    throw new ReferenceInputError("Saved reference is missing or is not a regular upload");
  } finally { await handle?.close(); }
  // A fresh snapshot prevents later generation from reopening a swapped source.
  return saveReferenceBytes(bytes, path.extname(name));
}

export function referenceUrl(value: string) {
  let url: URL;
  try { url = new URL(value); }
  catch { throw new ReferenceInputError("Image URL is not valid"); }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) {
    throw new ReferenceInputError("Image URL must be http or https without credentials");
  }
  if (!hostAllowed(url.hostname)) throw new ReferenceInputError("Image URL host is not allowed");
  return url;
}

export async function fetchReferenceImage(value: string) {
  const url = referenceUrl(value);
  const hostname = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new ReferenceInputError("Reference download timed out");
      controller.abort(error);
      reject(error);
    }, 20000);
  });
  let downloaded: { bytes: Buffer; ext: string };
  try {
    downloaded = await Promise.race([deadline, (async () => {
      const family = isIP(hostname);
      const addresses = family ? [{ address: hostname, family }] : await dns.lookup(hostname, { all: true, verbatim: true });
      controller.signal.throwIfAborted();
      if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
        throw new ReferenceInputError("Image URL must resolve only to public addresses");
      }
      const pinned = addresses[0];
      return new Promise<{ bytes: Buffer; ext: string }>((resolve, reject) => {
        // Connect to the validated numeric address, never resolve the name again.
        // Fresh sockets prevent pooling from bypassing pinning. Host/SNI keep TLS
        // certificate verification on the original name (not the selected IP).
        const request = (url.protocol === "https:" ? https : http).request({
          protocol: url.protocol, hostname: pinned.address, family: pinned.family,
          port: url.port || undefined, path: url.pathname + url.search, method: "GET",
          headers: { Host: url.host, Accept: Object.keys(IMAGE_TYPES).join(", "), "Accept-Encoding": "identity" },
          ...(url.protocol === "https:" ? { rejectUnauthorized: true, ...(!family ? { servername: hostname } : {}) } : {}),
          agent: false, signal: controller.signal,
        }, (response) => {
          const fail = (message: string) => {
            response.destroy();
            request.destroy();
            reject(new ReferenceInputError(message));
          };
          const status = response.statusCode || 0;
          if (status >= 300 && status < 400) return fail("Image URL redirects are not allowed");
          if (status < 200 || status >= 300) return fail(`Could not fetch image (${status})`);
          const type = (response.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
          const ext = Object.hasOwn(IMAGE_TYPES, type) ? IMAGE_TYPES[type] : undefined;
          if (!ext || response.headers["content-encoding"] && response.headers["content-encoding"] !== "identity") return fail("Unsupported image format or encoding");
          const declared = response.headers["content-length"];
          if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_BYTES)) return fail("Reference image must be under 8MB");
          const chunks: Buffer[] = [];
          let length = 0;
          response.on("data", (chunk: Buffer) => {
            length += chunk.length;
            if (length > MAX_BYTES) return fail("Reference image must be under 8MB");
            chunks.push(chunk);
          });
          response.on("end", () => resolve({ bytes: Buffer.concat(chunks, length), ext }));
          response.on("error", reject);
          response.on("aborted", () => reject(new ReferenceInputError("Image download was interrupted")));
        });
        request.on("error", reject);
        request.end();
      });
    })()]);
  } catch (error) {
    if (error instanceof ReferenceInputError) throw error;
    // Network errors may contain host details; keep the client error bounded.
    throw new ReferenceInputError("Could not download reference image");
  } finally { clearTimeout(timer!); }
  return saveReferenceBytes(downloaded.bytes, downloaded.ext);
}
