import { NextResponse } from "next/server";
import { readSettings } from "@/lib/settings";
import { probeOllama, pickPreferredModel } from "@/lib/adapters/probe";

export async function GET() {
  const settings = await readSettings();
  const probe = await probeOllama(settings.ollamaUrl);
  const models = probe.models || [];
  return NextResponse.json({
    models,
    ollamaModel:
      pickPreferredModel(models, settings.ollamaModel) || settings.ollamaModel,
    reachable: probe.reachable,
    ok: probe.ok,
    detail: probe.detail,
    dialect: probe.dialect,
  });
}
