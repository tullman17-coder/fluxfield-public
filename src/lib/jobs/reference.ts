import { promises as fs } from "fs";
import path from "path";
import { nanoid } from "nanoid";

const MAX_BYTES = 8 * 1024 * 1024;
const UPLOADS = () => path.join(process.cwd(), ".data", "uploads");

function extFromType(type: string, fallback: string) {
  if (type.includes("jpeg") || type.includes("jpg")) return ".jpg";
  if (type.includes("webp")) return ".webp";
  if (type.includes("png")) return ".png";
  if (type.includes("gif")) return ".gif";
  return fallback;
}

function hostAllowed(hostname: string) {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "::1") return false;
  if (h === "169.254.169.254") return false;
  return true;
}

export async function saveReferenceBytes(bytes: Buffer, ext: string) {
  if (bytes.length > MAX_BYTES) throw new Error("Reference image must be under 8MB");
  const name = `${nanoid(8)}${ext || ".png"}`;
  const dest = path.join(UPLOADS(), name);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, bytes);
  return { dest, name };
}

export async function fetchReferenceImage(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error("Image URL is not valid");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Image URL must be http or https");
  }
  if (!hostAllowed(parsed.hostname)) throw new Error("Image URL host is not allowed");
  const res = await fetch(parsed.href, { redirect: "follow", signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Could not fetch image (${res.status})`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const ext = extFromType(res.headers.get("content-type") || "", path.extname(parsed.pathname) || ".png");
  return saveReferenceBytes(bytes, ext);
}
