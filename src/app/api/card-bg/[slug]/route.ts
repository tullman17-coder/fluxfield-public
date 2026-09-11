import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getImage2Wrapper } from "@/lib/wrappers/catalog";
import { createAndRunJob } from "@/lib/jobs/runner";
import { getJob } from "@/lib/jobs/store";

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

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const wrapper = getImage2Wrapper(slug);
  if (!wrapper) {
    return NextResponse.json({ error: "Unknown wrapper" }, { status: 404 });
  }

  const cached = await findCached(slug);
  if (cached) {
    return new NextResponse(new Uint8Array(cached.data), {
      headers: {
        "Content-Type": contentType(cached.ext),
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  // First hit: generate real card art through the active adapter chain
  // (Local Studio → ComfyUI → mock) and cache it under .data/card-bg/.
  const job = await createAndRunJob({
    tool: "dream",
    workflowSlug: "dream",
    presetId: "cinematic",
    inputs: {
      prompt: `${wrapper.name} marketing key art — ${wrapper.tagline} ${wrapper.category} campaign atmosphere, dominant accent color ${wrapper.accent}, bold composition, no text, no words, no letters`,
      negativePrompt: "text, words, letters, logo, watermark, caption",
      ratio: wrapper.span === "wide" ? "landscape" : "portrait",
      framing: "auto",
      count: "1",
      steps: "4",
      cfg: "1",
      assist: "on",
      productName: wrapper.name,
    },
  });

  const done = await waitForJob(job.id);
  const art = done?.outputs.find((o) => o.kind === "image" && o.url);
  if (!art?.url) {
    return NextResponse.json({ error: "no art produced" }, { status: 502 });
  }

  const srcName = art.url.split("/").pop()!;
  const ext = (srcName.split(".").pop() || "png").toLowerCase();
  const src = path.join(process.cwd(), ".data", "outputs", srcName);
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const dest = path.join(CACHE_DIR, `${slug}.${ext}`);
  await fs.copyFile(src, dest);
  const data = await fs.readFile(dest);

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType(ext),
      "Cache-Control": "public, max-age=300",
    },
  });
}
