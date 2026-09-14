import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { LIBRARY_DIR } from "@/lib/data/paths";
import { serveMediaFile } from "@/lib/media-response";

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const parts = (await context.params).path || [];
  if (!parts.length || parts.some(p => !p || p === "." || p === ".." || /[/\\\0]/.test(p))) return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  try {
    const root = await fs.realpath(LIBRARY_DIR);
    const file = await fs.realpath(path.resolve(root, ...parts));
    if (!file.startsWith(root + path.sep)) return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    return await serveMediaFile(request, file);
  } catch { return NextResponse.json({ error: "Not found" }, { status: 404 }); }
}
export const HEAD = GET;
