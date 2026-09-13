import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { LIBRARY_DIR } from "@/lib/data/paths";

function contentTypeFor(name: string) {
  const ext = path.extname(name).toLowerCase();
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".flac") return "audio/flac";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".txt") return "text/plain; charset=utf-8";
  return "image/png";
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const parts = (await context.params).path || [];
  if (parts.some((p) => !p || p === "." || p === ".." || p.includes("\0"))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const relative = parts.join("/");
  const absolute = path.resolve(LIBRARY_DIR, relative);
  if (
    absolute !== LIBRARY_DIR &&
    !absolute.startsWith(LIBRARY_DIR + path.sep)
  ) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const data = await fs.readFile(absolute);
    return new NextResponse(data, {
      headers: {
        "Content-Type": contentTypeFor(absolute),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
