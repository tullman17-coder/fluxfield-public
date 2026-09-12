import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function GET(
  _request: Request,
  context: { params: Promise<{ name: string }> },
) {
  const { name } = await context.params;
  if (name.includes("..") || name.includes("/") || name.includes("\\")) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), ".data", "outputs", name);
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(name).toLowerCase();
    const type =
      ext === ".svg"
        ? "image/svg+xml"
        : ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".webp"
            ? "image/webp"
            : ext === ".wav"
              ? "audio/wav"
              : ext === ".mp3"
                ? "audio/mpeg"
                : ext === ".mp4"
                  ? "video/mp4"
                  : ext === ".txt"
                    ? "text/plain; charset=utf-8"
                    : "image/png";
    return new NextResponse(data, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
