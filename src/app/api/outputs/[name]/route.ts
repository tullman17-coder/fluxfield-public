import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { resolveOutputFile } from "@/lib/jobs/store";

function contentTypeFor(name: string) {
  const ext = path.extname(name).toLowerCase();
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".txt") return "text/plain; charset=utf-8";
  return "image/png";
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ name: string }> },
) {
  const { name } = await context.params;
  if (name.includes("..") || name.includes("/") || name.includes("\\")) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  const filePath = await resolveOutputFile(name);
  if (!filePath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const data = await fs.readFile(filePath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": contentTypeFor(name),
        "Content-Disposition": `inline; filename="${name}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
