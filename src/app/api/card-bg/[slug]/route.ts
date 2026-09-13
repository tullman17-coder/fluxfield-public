import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getImage2Wrapper, sampleValues } from "@/lib/wrappers/catalog";
import { createAndRunJob } from "@/lib/jobs/runner";
import { getJob } from "@/lib/jobs/store";
import { recordCardEngine } from "@/lib/wrappers/card-art";
import { findShippedExample } from "@/lib/wrappers/shipped-examples";
import { currentMode } from "@/lib/adapters/effective-mode";
import { readSettings } from "@/lib/settings";

const CACHE_DIR = path.join(process.cwd(), ".data", "card-bg");
const EXTS = ["png", "jpg", "webp", "svg"] as const;

function contentType(ext: string) {
  return ext === "svg"
    ? "image/svg+xml"
    : ext === "jpg"
      ? "image/jpeg"
      : ext === "webp"
        ? "image/webp"
        : "image/png";
}

async function findCached(slug: string) {
  for (const ext of EXTS) {
    const file = path.join(CACHE_DIR, `${slug}.${ext}`);
    try {
      const data = await fs.readFile(file);
      return { data, ext };
    } catch {
      // try next extension
    }
  }
  return null;
}

async function waitForJob(id: string, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const job = await getJob(id);
    if (!job) return null;
    if (job.status === "completed") return job;
    if (job.status === "failed") throw new Error(job.error || "job failed");
    await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error("card art timed out");
}

async function readCachedEngine(slug: string) {
  try {
    const raw = await fs.readFile(path.join(CACHE_DIR, `${slug}.json`), "utf8");
    const { engine } = JSON.parse(raw) as { engine?: string };
    return engine ?? null;
  } catch {
    return null;
  }
}

function serve(data: Buffer, ext: string, maxAge: number) {
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType(ext),
      "Cache-Control": `public, max-age=${maxAge}`,
    },
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const wrapper = getImage2Wrapper(slug);
  if (!wrapper) {
    return NextResponse.json({ error: "Unknown wrapper" }, { status: 404 });
  }

  const refresh = _request.url.includes("refresh=1");
  const settings = await readSettings();
  const { mode } = await currentMode(settings);
  const realBackend = mode === "local-studio" || mode === "comfyui";

  const cached = await findCached(slug);
  const cachedEngine = cached ? await readCachedEngine(slug) : null;

  // Live Studio/Comfy redraws win when present (never prefer stale mock).
  if (cached && cachedEngine && cachedEngine !== "mock" && !refresh) {
    return serve(cached.data, cached.ext, 300);
  }

  // Shipped campaign samples — default for public hosts / no GPU.
  // Never regenerate over these with mock art.
  const shipped = await findShippedExample(slug);
  if (shipped && (!refresh || !realBackend)) {
    return serve(shipped.data, shipped.ext, 86_400);
  }

  const job = await createAndRunJob({
    tool: "image2",
    workflowSlug: slug,
    presetId: wrapper.presets[0].id,
    inputs: {
      ...sampleValues(wrapper),
      aspect: wrapper.aspectDefault,
      maxDim: "600",
      silent: "card-bg",
    },
  });

  const done = await waitForJob(job.id);
  const art = [...(done?.outputs ?? [])]
    .reverse()
    .find((o) => o.kind === "image" && o.url);
  if (!art?.url) {
    if (shipped) return serve(shipped.data, shipped.ext, 86_400);
    return NextResponse.json({ error: "no art produced" }, { status: 502 });
  }

  // Prefer a shipped sample over caching mock output as "the example".
  if (done!.modeUsed === "mock" && shipped) {
    return serve(shipped.data, shipped.ext, 86_400);
  }

  const srcName = art.url.split("/").pop()!;
  const ext = (srcName.split(".").pop() || "png").toLowerCase();
  const src = path.join(process.cwd(), ".data", "outputs", srcName);
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const dest = path.join(CACHE_DIR, `${slug}.${ext}`);
  await fs.copyFile(src, dest);
  await recordCardEngine(slug, done!.modeUsed);
  const data = await fs.readFile(dest);

  return serve(data, ext, 300);
}
