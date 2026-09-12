import { promises as fs } from "fs";
import path from "path";
import { nanoid } from "nanoid";
import type {
  AdapterContext,
  AdapterResult,
  JobOutput,
  StudioSettings,
} from "@/lib/adapters/types";

function aspectToSize(aspect: string): string {
  const map: Record<string, string> = {
    "1:1": "1024x1024",
    "4:5": "896x1152",
    "9:16": "768x1344",
    "16:9": "1344x768",
    "2:3": "832x1216",
    "3:4": "896x1152",
    "1.91:1": "1216x640",
  };
  return map[aspect] ?? "1024x1024";
}

export async function checkLocalStudioHealth(
  settings: StudioSettings,
): Promise<boolean> {
  if (!settings.studioUrl) return false;
  try {
    const headers: HeadersInit = {};
    if (settings.studioApiKey) {
      headers.authorization = `Bearer ${settings.studioApiKey}`;
    }
    const res = await fetch(
      new URL("/health", settings.studioUrl).toString(),
      {
        headers,
        signal: AbortSignal.timeout(2500),
        redirect: "manual",
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Local Dream Studio / Local Studio controller adapter.
 * Contract: POST /v1/images/generations with bearer auth (OpenAI-ish images API).
 */
export async function runLocalStudioAdapter(
  ctx: AdapterContext,
  count = 1,
): Promise<AdapterResult> {
  const base = ctx.settings.studioUrl.replace(/\/$/, "");
  if (!base) throw new Error("Local Studio URL is empty");
  if (!ctx.settings.studioApiKey) {
    throw new Error(
      "Local Studio API key missing. Set it in Adapters (or LOCAL_STUDIO_API_KEY).",
    );
  }

  const n = Math.min(4, Math.max(1, count));
  const payload = {
    prompt: ctx.job.prompt,
    negative_prompt: ctx.job.negativePrompt || undefined,
    n,
    size: ctx.job.inputs.size || aspectToSize(ctx.job.aspect),
    steps: Number(ctx.job.inputs.steps || 4),
    cfg_scale: Number(ctx.job.inputs.cfg || 1),
    seed: ctx.job.inputs.seed ? Number(ctx.job.inputs.seed) : undefined,
  };

  const res = await fetch(new URL("/v1/images/generations", base).toString(), {
    method: "POST",
    redirect: "manual",
    headers: {
      authorization: `Bearer ${ctx.settings.studioApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(180_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Local Studio rejected generation (${res.status}): ${body.slice(0, 200)}`,
    );
  }

  const body = (await res.json()) as {
    created?: number;
    prompt_id?: string;
    data?: { url: string; revised_prompt?: string }[];
  };

  if (!Array.isArray(body.data) || body.data.length === 0) {
    throw new Error("Local Studio returned no image data");
  }

  const outputs: JobOutput[] = [];
  const outDir = path.join(process.cwd(), ".data", "outputs");
  await fs.mkdir(outDir, { recursive: true });

  for (const [index, item] of body.data.entries()) {
    const absolute = new URL(item.url, base);
    if (absolute.origin !== new URL(base).origin) {
      throw new Error("Local Studio returned an off-origin asset URL");
    }
    if (
      !absolute.pathname.startsWith("/v1/images/files/") ||
      absolute.pathname === "/v1/images/files/"
    ) {
      throw new Error("Local Studio asset path is not under /v1/images/files/");
    }

    const imgRes = await fetch(absolute.toString(), {
      headers: { authorization: `Bearer ${ctx.settings.studioApiKey}` },
      redirect: "manual",
      signal: AbortSignal.timeout(120_000),
    });
    if (!imgRes.ok) {
      throw new Error(`Failed to download Local Studio image (${imgRes.status})`);
    }
    const mime = imgRes.headers.get("content-type")?.split(";")[0]?.trim();
    const ext =
      mime === "image/jpeg"
        ? ".jpg"
        : mime === "image/webp"
          ? ".webp"
          : ".png";
    const id = nanoid(8);
    const filename = `${ctx.job.id}-${id}${ext}`;
    await fs.writeFile(
      path.join(outDir, filename),
      Buffer.from(await imgRes.arrayBuffer()),
    );
    outputs.push({
      id,
      kind: "image",
      label: `Image ${index + 1}`,
      url: `/api/outputs/${filename}`,
    });
  }

  return { outputs, remotePromptId: body.prompt_id };
}
