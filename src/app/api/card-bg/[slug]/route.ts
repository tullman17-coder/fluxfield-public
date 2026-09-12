import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getImage2Wrapper, sampleValues } from "@/lib/wrappers/catalog";
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
  const refresh = _request.url.includes("refresh=1");
  if (cached && !refresh) {
    return new NextResponse(new Uint8Array(cached.data), {
      headers: {
        "Content-Type": contentType(cached.ext),
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  // A card should show what its layout actually makes, so run the layout for
  // real with its own example copy and keep the finished piece.
  const job = await createAndRunJob({
    tool: "image2",
    workflowSlug: slug,
    presetId: wrapper.presets[0].id,
    inputs: {
      ...sampleValues(wrapper),
      aspect: wrapper.aspectDefault,
      // Cards render around 600px wide; full-size art would be megabytes each.
      maxDim: "600",
    },
  });

  const done = await waitForJob(job.id);
  // The composed layout is the last image; earlier ones are the bare subject.
  const art = [...(done?.outputs ?? [])]
    .reverse()
    .find((o) => o.kind === "image" && o.url);
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
