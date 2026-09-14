import { NextResponse } from "next/server";
import { resolveOutputFile } from "@/lib/jobs/store";
import { serveMediaFile } from "@/lib/media-response";

export async function GET(request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  if (!name || name.includes("..") || /[/\\\0]/.test(name)) return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  const file = await resolveOutputFile(name);
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try { return await serveMediaFile(request, file); }
  catch { return NextResponse.json({ error: "Not found" }, { status: 404 }); }
}
export const HEAD = GET;
