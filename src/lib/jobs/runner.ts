import path from "path";
import { promises as fs } from "fs";
import { fillPrompt, getWorkflow } from "@/lib/workflows";
import {
  fillWrapperPrompt,
  getImage2Wrapper,
} from "@/lib/wrappers/catalog";
import {
  getDurationBeats,
  getDurationSeconds,
  getExplainerPreset,
} from "@/lib/explainer/presets";
import { readSettings } from "@/lib/settings";
import { newJobId, saveJob, updateJob, getJob } from "@/lib/jobs/store";
import { checkComfyHealth, runComfyAdapter } from "@/lib/adapters/comfyui";
import {
  checkLocalStudioHealth,
  runLocalStudioAdapter,
} from "@/lib/adapters/local-studio";
import { runMockAdapter } from "@/lib/adapters/mock";
import { runMusicAdapter } from "@/lib/adapters/music";
import { runZermoAdapter, runChainedWanClips, WAN_FAST } from "@/lib/adapters/zermo";
import { runHiggsfieldAdapter, checkHiggsfieldHealth } from "@/lib/adapters/higgsfield";
import { assembleExplainerVideo, concatClips, checkFfmpeg } from "@/lib/adapters/ffmpeg";
import { fitZermoSize } from "@/lib/adapters/zermo-image-size";
import { runDirectorAdapter } from "@/lib/adapters/director";
import { runVideoWorkflowAdapter } from "@/lib/adapters/video-workflow";
import {
  getVideoWorkflow,
  getVideoWorkflowMode,
} from "@/lib/video-workflows/catalog";
import { getGenre } from "@/lib/music/theory";
import {
  fallbackExplainerScript,
  fallbackMarketingCopy,
  generateExplainerScript,
  generateMarketingCopy,
} from "@/lib/adapters/ollama";
import { synthesizeSpeech } from "@/lib/adapters/tts";
import { composeCreative } from "@/lib/compose/engine";
import {
  applyMarketingCopy,
  localCohereCopy,
  parseMarketingCopy,
} from "@/lib/compose/copy";
import {
  formatReviewNote,
  verifyCreative,
  verifySubject,
} from "@/lib/compose/verify";
import {
  layoutForWorkflowCategory,
  wrapperForLayout,
} from "@/lib/compose/layout-map";
import { getBrandKit } from "@/lib/brand-kits/store";
import type { BrandPalette } from "@/lib/compose/engine";
import {
  applyDreamPreset,
  applyFraming,
  dreamPresets,
  dreamRatio,
  enhanceNegativePrompt,
  enhancePrompt,
  stripContentFilters,
} from "@/lib/dream/presets";
import { visualQaSummary } from "@/lib/studio/presentation";
import type { JobTool, ModeUsed, StudioJob } from "@/lib/adapters/types";
import { nanoid } from "nanoid";

export type CreateJobInput = {
  tool: JobTool;
  workflowSlug: string;
  presetId: string;
  inputs: Record<string, string>;
  referenceImagePath?: string;
};

export async function createAndRunJob(
  input: CreateJobInput,
): Promise<StudioJob> {
  const now = new Date().toISOString();
  const { unrestricted, generationMode } = await readSettings();
  let workflowName = input.workflowSlug;
  let presetLabel = input.presetId;
  let prompt = "";
  let negativePrompt = "";
  let aspect = "1:1";

  if (input.tool === "dream") {
    const available = dreamPresets(unrestricted);
    const preset =
      available.find((p) => p.id === input.presetId) ?? available[0];
    const base = input.inputs.prompt?.trim() || "";
    if (!base) throw new Error("Describe the image you want to create.");
    const ratio = dreamRatio(input.inputs.ratio);
    const assist = input.inputs.assist !== "off";
    const framing = input.inputs.framing || "auto";
    workflowName = "Dream Studio";
    presetLabel = preset.label;
    aspect = ratio.aspect;
    if (generationMode === "zermo") {
      const size = fitZermoSize(ratio.width, ratio.height);
      input.inputs.size ||= `${size.width}x${size.height}`;
      input.inputs.steps ||= "8";
      input.inputs.cfg ||= "1";
    } else input.inputs.size = `${ratio.width}x${ratio.height}`;
    prompt = enhancePrompt(base, preset.id, framing, assist);
    negativePrompt = enhanceNegativePrompt(
      base,
      input.inputs.negativePrompt || "",
      framing,
      assist,
    );
  } else if (input.tool === "image2") {
    const wrapper = getImage2Wrapper(input.workflowSlug);
    if (!wrapper) throw new Error("Unknown Image-2 wrapper");
    const preset =
      wrapper.presets.find((p) => p.id === input.presetId) ??
      wrapper.presets[0];
    workflowName = wrapper.name;
    presetLabel = preset.label;
    aspect = input.inputs.aspect || wrapper.aspectDefault;
    prompt = fillWrapperPrompt(
      wrapper.promptTemplate,
      input.inputs,
      preset.label,
    );
    negativePrompt = wrapper.negativePrompt;
    ({ prompt, negativePrompt } = enrichWithDreamControls(
      prompt,
      negativePrompt,
      input.inputs,
    ));
  } else if (input.tool === "explainer") {
    const preset = getExplainerPreset(input.presetId);
    const topic = input.inputs.topic?.trim() || "Untitled topic";
    workflowName = "Explainer";
    presetLabel = preset.name;
    aspect = input.inputs.aspect || "16:9";
    const beats = getDurationBeats(input.inputs.duration || "1m");
    input.inputs.beats = String(beats);
    prompt = `${preset.stylePrompt}. Explainer keyframe about: ${topic}`;
    negativePrompt = preset.negativePrompt;
    ({ prompt, negativePrompt } = enrichWithDreamControls(
      prompt,
      negativePrompt,
      input.inputs,
    ));
  } else if (input.tool === "music") {
    const { interpretMusicBrief, applyMusicChip } = await import("@/lib/music/brief");
    const parsed = applyMusicChip(input.inputs.genre, interpretMusicBrief(input.inputs.brief || ""));
    const genre = getGenre(parsed.genre);
    const brief = input.inputs.brief?.trim() || "";
    if (!brief) throw new Error("Describe the track you want.");
    workflowName = "Music";
    presetLabel = genre.label;
    input.inputs.genre = genre.id;
    input.inputs.acePrompt = input.inputs.acePrompt || parsed.tags;
    input.inputs.lyricTopic = parsed.topic;
    prompt = brief;
  } else if (input.tool === "director") {
    const brief = input.inputs.brief?.trim() || "";
    if (!brief) throw new Error("Describe the film or video you want.");
    workflowName = input.inputs.mode === "music-video" ? "Music Video" : "TikTok";
    presetLabel = input.presetId;
    aspect = input.inputs.aspect || (input.inputs.mode === "music-video" ? "16:9" : "9:16");
    prompt = brief;
  } else if (
    input.tool === "ugc" ||
    input.tool === "ad-multiplier" ||
    input.tool === "faceless"
  ) {
    const def = getVideoWorkflow(input.tool);
    if (!def) throw new Error("Unknown video workflow");
    const mode = getVideoWorkflowMode(def, input.presetId || def.defaultMode);
    const brief =
      input.inputs.brief?.trim() || input.inputs.topic?.trim() || "";
    if (!brief) throw new Error("Describe what the video should cover.");
    workflowName = def.name;
    presetLabel = mode.label;
    aspect = input.inputs.aspect || def.aspectDefault;
    prompt = brief;
    input.inputs.mode = mode.id;
  } else {
    const workflow = getWorkflow(input.workflowSlug);
    if (!workflow) throw new Error("Unknown workflow");
    const preset =
      workflow.presets.find((p) => p.id === input.presetId) ??
      workflow.presets[0];
    workflowName = workflow.name;
    presetLabel = preset.label;
    aspect = input.inputs.aspect || workflow.aspectDefault;
    prompt = fillPrompt(workflow.promptTemplate, input.inputs, preset.label);
    negativePrompt = workflow.negativePrompt;
    ({ prompt, negativePrompt } = enrichWithDreamControls(
      prompt,
      negativePrompt,
      input.inputs,
    ));
  }

  // One place to take the filters back out, so every tool behaves the same.
  if (unrestricted) negativePrompt = stripContentFilters(negativePrompt);

  const job: StudioJob = {
    id: newJobId(),
    tool: input.tool,
    workflowSlug: input.workflowSlug,
    workflowName,
    presetId: input.presetId,
    presetLabel,
    status: "queued",
    progress: 5,
    prompt,
    negativePrompt,
    aspect,
    inputs: input.inputs,
    modeUsed: generationMode === "zermo" ? "zermo" : "mock",
    generationMode,
    referenceImagePath: input.referenceImagePath,
    outputs: [],
    phase: "intake",
    brandKitId: input.inputs.brandKitId || undefined,
    createdAt: now,
    updatedAt: now,
  };

  await saveJob(job);
  void resumeJob(job.id);
  return job;
}

// ponytail: one runner per job in this server process; use DB leases for multi-process hosting.
const activeJobs = new Set<string>();
export async function resumeJob(jobId: string) {
  if (activeJobs.has(jobId)) return;
  activeJobs.add(jobId);
  try { await processJob(jobId); } finally { activeJobs.delete(jobId); }
}

async function processJob(jobId: string) {
  const existing = await getJob(jobId);
  if (!existing || existing.status === "completed") return;
  const settings = await readSettings();
  await updateJob(jobId, { status: "running", progress: 12, error: undefined });

  const current = await getJob(jobId);
  if (!current) return;
  if (current.generationMode) settings.generationMode = current.generationMode;
  const referenceImagePath = current.referenceImagePath;

  try {
    let script: string | undefined;

    if (current.script && settings.generationMode === "zermo") {
      script = current.script;
    } else if (current.tool === "explainer") {
      const preset = getExplainerPreset(current.presetId);
      const beats = Number(current.inputs.beats || 6);
      script =
        (await generateExplainerScript(settings, {
          topic: current.inputs.topic || "topic",
          presetName: preset.name,
          beats,
          duration: current.inputs.duration || "1m",
        })) ||
        fallbackExplainerScript({
          topic: current.inputs.topic || "topic",
          presetName: preset.name,
          beats,
        });
    } else if (current.tool === "dream") {
      script = [
        `PROMPT: ${current.prompt}`,
        `NEGATIVE: ${current.negativePrompt || "—"}`,
        `SIZE: ${current.inputs.size || current.aspect} · STEPS: ${current.inputs.steps || 8} · CFG: ${current.inputs.cfg || 1} · SEED: ${current.inputs.seed || "random"}`,
      ].join("\n");
    } else if (
      current.tool === "music" ||
      current.tool === "director" ||
      current.tool === "ugc" ||
      current.tool === "ad-multiplier" ||
      current.tool === "faceless"
    ) {
      // These tools build their own storyboard / arrangement text.
      script = undefined;
    } else {
      script =
        (await generateMarketingCopy(settings, {
          wrapperName: current.workflowName,
          presetLabel: current.presetLabel,
          brandName:
            current.inputs.brandName ||
            current.inputs.productName ||
            "Brand",
          productName: current.inputs.productName || "Product",
          productDescription:
            current.inputs.productDescription ||
            current.inputs.bodyCopy ||
            "",
        })) ||
        fallbackMarketingCopy({
          wrapperName: current.workflowName,
          presetLabel: current.presetLabel,
          brandName:
            current.inputs.brandName ||
            current.inputs.productName ||
            "Brand",
          productName: current.inputs.productName || "Product",
        });
    }

    await updateJob(jobId, { script, progress: 30 });

    // Music does not run through the image adapter chain.
    if (current.tool === "music") {
      const music = await runMusicAdapter({
        settings,
        job: current,
        referenceImagePath: undefined,
      });
      await updateJob(jobId, {
        status: "completed",
        progress: 100,
        modeUsed: settings.generationMode === "zermo" ? "zermo" : music.usedServer ? "local-studio" : "mock",
        outputs: music.outputs,
        script: music.outputs.find((o) => o.kind === "storyboard")?.text,
      });
      return;
    }

    // Long-form productions plan their own shots and frames.
    if (current.tool === "director") {
      const directed = await runDirectorAdapter({
        settings,
        job: current,
        referenceImagePath: referenceImagePath
          ? path.resolve(referenceImagePath)
          : current.referenceImagePath
            ? path.resolve(current.referenceImagePath)
            : undefined,
      });
      await updateJob(jobId, {
        status: "completed",
        progress: 100,
        modeUsed: directed.modeUsed,
        outputs: directed.outputs,
        script: directed.outputs.find((o) => o.kind === "storyboard")?.text,
      });
      return;
    }

    // UGC / ad multiplier / faceless — storyboard + keyframes (+ optional VO/video).
    if (
      current.tool === "ugc" ||
      current.tool === "ad-multiplier" ||
      current.tool === "faceless"
    ) {
      await updateJob(jobId, { progress: 40, phase: "compose" });
      const pack = await runVideoWorkflowAdapter({
        settings,
        job: current,
        referenceImagePath: referenceImagePath
          ? path.resolve(referenceImagePath)
          : undefined,
      });
      const primary = pack.outputs.find((o) => o.kind === "video")
        ?? pack.outputs.find((o) => o.kind === "image");
      await updateJob(jobId, {
        status: "completed",
        progress: 100,
        phase: "finalize",
        modeUsed: pack.modeUsed,
        outputs: pack.outputs,
        script: pack.script,
        primaryOutputId: primary?.id,
      });
      return;
    }

    const wantStudio = settings.generationMode !== "mock" && settings.generationMode !== "zermo";
    const studioUp =
      wantStudio &&
      Boolean(settings.studioUrl && settings.studioApiKey) &&
      (await checkLocalStudioHealth(settings));
    const comfyUp =
      settings.generationMode !== "zermo" &&
      settings.generationMode !== "mock" &&
      settings.generationMode !== "local-studio" &&
      (await checkComfyHealth(settings.comfyUrl));
    const higgsfieldUp =
      (settings.generationMode === "higgsfield" || settings.generationMode === "auto") &&
      Boolean(settings.higgsfieldApiKey) &&
      (await checkHiggsfieldHealth(settings.higgsfieldApiKey));

    let modeUsed: ModeUsed = settings.generationMode === "zermo" ? "zermo" : "mock";
    if (settings.generationMode === "higgsfield") {
      if (!higgsfieldUp) {
        throw new Error(
          `Higgsfield API not reachable. Check your API key in Settings → Connections.`,
        );
      }
      modeUsed = "higgsfield";
    } else if (settings.generationMode === "local-studio") {
      if (!studioUp) {
        throw new Error(
          `Local Studio not reachable at ${settings.studioUrl}. Point it at DGX Spark with the Studio key, or switch mode to auto/mock.`,
        );
      }
      modeUsed = "local-studio";
    } else if (settings.generationMode === "comfyui") {
      if (!comfyUp) {
        throw new Error(
          `ComfyUI not reachable at ${settings.comfyUrl}. Start it on DGX, or leave Comfy blank and use Studio.`,
        );
      }
      modeUsed = "comfyui";
    } else if (settings.generationMode === "auto") {
      if (studioUp) modeUsed = "local-studio";
      else if (comfyUp) modeUsed = "comfyui";
      else if (higgsfieldUp) modeUsed = "higgsfield";
      else modeUsed = "mock";
    }

    const refreshed = (await getJob(jobId))!;
    const ctx = {
      settings,
      job: refreshed,
      referenceImagePath: referenceImagePath
        ? path.resolve(referenceImagePath)
        : undefined,
    };

    await updateJob(jobId, {
      modeUsed,
      phase: "subject",
      progress: 50,
    });

    let packCount = 1;
    if (current.tool === "workflow") {
      const workflow = getWorkflow(current.workflowSlug);
      packCount =
        workflow?.kind === "pack"
          ? 3
          : current.workflowSlug === "marketplace-pack"
            ? 4
            : 1;
    } else if (current.tool === "image2") {
      packCount = 1;
    } else if (current.tool === "dream") {
      packCount = Math.min(4, Math.max(1, Number(current.inputs.count || 1)));
    } else if (current.tool === "explainer") {
      packCount = Math.min(12, Math.max(1, Number(current.inputs.beats || 6)));
      if (settings.generationMode === "zermo") {
        refreshed.inputs.size = "640x352";
        ctx.job.inputs.size = "640x352";
      }
    } else {
      packCount = Number(current.inputs.beats || 6);
    }

    // A health probe only says a machine answered, not that it can finish the
    // job. In auto mode keep walking down the chain when one actually fails.
    const chain: ModeUsed[] =
      settings.generationMode === "auto"
        ? (["local-studio", "comfyui", "higgsfield", "mock"] as const).filter(
            (m) =>
              m === "mock" ||
              (m === "local-studio" && studioUp) ||
              (m === "comfyui" && comfyUp) ||
              (m === "higgsfield" && higgsfieldUp),
          )
        : [modeUsed];

    const runWith = (mode: ModeUsed, job = refreshed) => {
      const next = { ...ctx, job };
      if (mode === "zermo") return runZermoAdapter(next, packCount);
      if (mode === "higgsfield") return runHiggsfieldAdapter(next);
      return mode === "local-studio"
        ? runLocalStudioAdapter(next, packCount)
        : mode === "comfyui"
          ? runComfyAdapter(next)
          : runMockAdapter(next, packCount);
    };

    let result: Awaited<ReturnType<typeof runWith>> | undefined;
    let lastError: unknown;
    for (const mode of chain) {
      try {
        result = await runWith(mode);
        if (mode !== modeUsed) {
          modeUsed = mode;
          await updateJob(jobId, { modeUsed });
        }
        break;
      } catch (err) {
        lastError = err;
      }
    }
    if (!result) throw lastError ?? new Error("Could not make the art");

    const qc: string[] = [];
    if (modeUsed !== "mock" && current.inputs.visualQa === "on") {
      const subjectOut = result.outputs.find((o) => o.kind === "image" && o.url);
      const subjectCheck = await verifySubject(settings, {
        imageUrl: subjectOut?.url,
        prompt: refreshed.prompt,
      });
      if (
        modeUsed !== "zermo" &&
        subjectCheck.status === "checked" &&
        !subjectCheck.review.anatomy.ok &&
        subjectCheck.review.repair
      ) {
        await updateJob(jobId, { phase: "subject", progress: 58 });
        try {
          result = await runWith(modeUsed, {
            ...refreshed,
            prompt: `${refreshed.prompt}. ${subjectCheck.review.repair}`,
          });
        } catch {
          // keep the first pass
        }
      }
      qc.push(formatReviewNote("Subject", subjectCheck));
    }

    const live = (await getJob(jobId)) ?? current;
    const mergedInputs = applyMarketingCopy(
      live.inputs,
      script ? parseMarketingCopy(script) : {},
    );
    const copy = localCohereCopy(mergedInputs);
    live.inputs = { ...mergedInputs, ...copy };

    await updateJob(jobId, { phase: "compose", progress: 70 });
    result = {
      ...result,
      outputs: await finalizeStills(live, result.outputs, modeUsed),
    };

    if (modeUsed !== "mock" && current.inputs.visualQa === "on") {
      const creative = [...result.outputs]
        .reverse()
        .find((o) => o.kind === "image" && /creative/i.test(o.label));
      const layoutCheck = await verifyCreative(settings, {
        imageUrl: creative?.url,
        prompt: live.prompt,
        copy,
      });
      qc.push(formatReviewNote("Layout", layoutCheck));
    }

    const qaSummary = visualQaSummary(current.inputs.visualQa, modeUsed, qc);
    result.outputs.push({
      id: nanoid(8),
      kind: "text",
      label: "Visual QA",
      text: qaSummary,
    });
    script = [script, "VISUAL QA", qaSummary].filter(Boolean).join("\n\n");

    await updateJob(jobId, { progress: 75, outputs: result.outputs });

    // Explainer post: TTS + ffmpeg assemble when available
    if (current.tool === "explainer") {
      const voText =
        script
          ?.split("\n")
          .filter((l) => l.includes("[VO") || l.startsWith("BEAT"))
          .join(" ")
          .slice(0, 2000) ||
        current.inputs.topic ||
        "Explainer";

      const audio = await synthesizeSpeech({
        settings,
        text: voText,
        jobId,
        label: `Narration · ${current.inputs.voice || "default voice"}`,
      });

      const imageUrls = result.outputs
        .filter((o) => o.kind === "image" && o.url)
        .map((o) => o.url!);

      const extras: NonNullable<typeof audio>[] = [];
      if (audio) extras.push(audio);

      if (modeUsed === "zermo") {
        const outDir = path.join(process.cwd(), ".data", "outputs");
        const chained = await runChainedWanClips(
          { settings, job: (await getJob(jobId)) ?? current, referenceImagePath: undefined },
          imageUrls.map((url) => ({
            imagePath: path.join(outDir, path.basename(url)),
            prompt: current.prompt,
          })),
        );
        extras.push(...chained.outputs.filter((o) => o.kind === "video" || o.kind === "audio"));
        const cut = await concatClips({
          jobId,
          videoUrls: chained.clipUrls,
          audioUrl: audio?.url,
          clipSec: WAN_FAST.frames / WAN_FAST.fps,
          xfade: WAN_FAST.xfade,
        });
        if (cut) extras.push(cut);
      } else if (await checkFfmpeg()) {
        const video = await assembleExplainerVideo({
          jobId,
          imageUrls,
          audioUrl: audio?.url,
          secondsPerBeat:
            getDurationSeconds(current.inputs.duration || "1m") /
            Math.max(1, imageUrls.length),
        });
        if (video) extras.push(video);
      }

      result = {
        ...result,
        outputs: [...result.outputs, ...extras],
      };
    }

    if (modeUsed === "mock") await new Promise((r) => setTimeout(r, 400));

    const primary =
      result.outputs.find((o) => o.label.includes("layout") || o.label.includes("creative"))
      ?? [...result.outputs].reverse().find((o) => o.kind === "image");

    await updateJob(jobId, {
      status: "completed",
      progress: 100,
      phase: "finalize",
      outputs: result.outputs,
      remotePromptId: result.remotePromptId,
      modeUsed,
      script,
      primaryOutputId: primary?.id,
    });
  } catch (error) {
    await updateJob(jobId, {
      status: "failed",
      progress: 100,
      error: error instanceof Error ? error.message : "Generation failed",
    });
  }
}

export async function imageDataUri(url?: string, required = false): Promise<string | undefined> {
  if (!url) {
    if (required) throw new Error("Generated subject is missing; remote render retained");
    return undefined;
  }
  try {
    const name = url.split("/").pop()!;
    if (!name || name.includes("..") || name.includes("\\") || name.includes("\0")) throw new Error("Invalid subject path");
    const file = path.join(process.cwd(), ".data", "outputs", name);
    const info = await fs.stat(file);
    if (!info.isFile() || info.size > 8 * 1024 * 1024) throw new Error("Subject exceeds composition byte limit");
    const buf = await fs.readFile(file);
    if (!buf.byteLength || buf.byteLength > 8 * 1024 * 1024) throw new Error("Invalid subject size");
    const mime = name.endsWith(".webp")
      ? "image/webp"
      : name.endsWith(".jpg") || name.endsWith(".jpeg")
        ? "image/jpeg"
        : "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    if (required) throw new Error("Generated subject could not be read or exceeds 8 MiB; remote render retained");
    return undefined;
  }
}

async function brandPaletteFor(
  job: StudioJob,
): Promise<BrandPalette | undefined> {
  const id = job.brandKitId || job.inputs.brandKitId;
  if (!id) return undefined;
  const kit = await getBrandKit(id);
  return kit?.palette;
}

async function finalizeStills(
  job: StudioJob,
  outputs: StudioJob["outputs"],
  modeUsed: ModeUsed,
) {
  const wrapDream = job.tool === "dream" && job.inputs.campaignWrap === "on";
  const wrapWorkflow = job.tool === "workflow";
  const wrapImage2 = job.tool === "image2" && modeUsed !== "mock";
  if (!wrapImage2 && !wrapWorkflow && !wrapDream) return outputs;

  const brand = await brandPaletteFor(job);
  const images = outputs.filter((o) => o.kind === "image" && o.url);
  if (!images.length) {
    if (modeUsed !== "mock") throw new Error("Generated subject is missing; remote render retained");
    return outputs;
  }

  if (wrapImage2) {
    const wrapper = getImage2Wrapper(job.workflowSlug);
    if (!wrapper) return outputs;
    const subject = images[0];
    if (subject) subject.label = "Subject";
    const composed = await composeCreative({
      wrapper,
      values: job.inputs,
      presetLabel: job.presetLabel,
      aspect: job.aspect,
      jobId: job.id,
      subjectHint: job.inputs.productDescription || job.prompt,
      subjectImageDataUri: await imageDataUri(subject?.url, true),
      brand,
      outfitThumbs: (
        await Promise.all(images.slice(1, 5).map((o) => imageDataUri(o.url)))
      ).filter((u): u is string => Boolean(u)),
    });
    return [
      ...outputs.filter((o) => o.kind !== "image"),
      {
        id: nanoid(8),
        kind: "image" as const,
        label: `${wrapper.name} creative`,
        url: composed.url,
      },
    ];
  }

  const workflow = wrapWorkflow ? getWorkflow(job.workflowSlug) : undefined;
  const layout = wrapWorkflow
    ? layoutForWorkflowCategory(workflow?.category || "ads")
    : "poster-cta";
  const wrapper = wrapperForLayout(
    layout,
    job.workflowName,
    job.inputs.brandName || job.inputs.productName || job.workflowName,
    job.presetLabel,
  );

  const extras = [];
  for (const image of images) {
    const composed = await composeCreative({
      wrapper,
      values: {
        brandName: job.inputs.brandName || job.workflowName,
        productName: job.inputs.productName || job.presetLabel,
        productDescription:
          job.inputs.productDescription || job.inputs.prompt || job.prompt,
        headline: job.inputs.headline,
        cta: job.inputs.cta || "Shop now",
        price: job.inputs.price,
        bodyCopy: job.inputs.bodyCopy,
      },
      presetLabel: job.presetLabel,
      aspect: job.aspect,
      jobId: job.id,
      subjectHint: job.prompt,
      subjectImageDataUri: await imageDataUri(image.url, modeUsed !== "mock"),
      brand,
    });
    extras.push({
      id: nanoid(8),
      kind: "image" as const,
      label: `${job.workflowName} creative`,
      url: composed.url,
    });
  }
  return [...outputs.filter((o) => o.kind !== "image"), ...extras];
}

function enrichWithDreamControls(
  prompt: string,
  negativePrompt: string,
  inputs: Record<string, string>,
): { prompt: string; negativePrompt: string } {
  const next = applyDreamPreset(prompt, inputs.dreamStyle);
  const framed = applyFraming(next, inputs.framing);
  const negative = [negativePrompt, framed.negativeExtra]
    .filter(Boolean)
    .join(", ");
  return { prompt: framed.prompt, negativePrompt: negative };
}
