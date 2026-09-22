import { NextResponse } from "next/server";
import { readRequestPayload } from "@/lib/jobs/input";
import { readSettings, writeSettings, publicSettings, settingsPatchSchema } from "@/lib/settings";

export async function GET() {
  const settings = await readSettings();
  return NextResponse.json({ settings: publicSettings(settings) });
}

export async function PUT(request: Request) {
  let body: unknown;
  try { body = await readRequestPayload(request, "json", 64 * 1024); }
  catch { return NextResponse.json({ error: "Invalid settings JSON" }, { status: 400 }); }
  const parsed = settingsPatchSchema.safeParse(body);
  if (!parsed.success) {
    // Never echo values: validation failures can contain credentials.
    return NextResponse.json({ error: "Invalid settings fields or values" }, { status: 400 });
  }
  const settings = await writeSettings(parsed.data);

  return NextResponse.json({ settings: publicSettings(settings) });
}
