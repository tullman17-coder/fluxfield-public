import { NextResponse } from "next/server";
import { readSettings } from "@/lib/settings";

export async function GET() {
  const settings = await readSettings();
  try {
    const res = await fetch(
      `${settings.ollamaUrl.replace(/\/$/, "")}/api/tags`,
      { signal: AbortSignal.timeout(3000) },
    );
    if (!res.ok) throw new Error(`tags ${res.status}`);
    const data = (await res.json()) as { models?: { name: string }[] };
    const models = (data.models || [])
      .map((m) => m.name)
      .filter(Boolean)
      .sort();
    return NextResponse.json({ models, ollamaModel: settings.ollamaModel });
  } catch {
    return NextResponse.json({ models: [], ollamaModel: settings.ollamaModel });
  }
}
