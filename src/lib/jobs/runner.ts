import path from "path";
import { promises as fs } from "fs";
import { fillPrompt, getWorkflow } from "@/lib/workflows";
import {
  fillWrapperPrompt,
  getImage2Wrapper,
} from "@/lib/wrappers/catalog";
import {
  getDurationBeats,
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
import { runDirectorAdapter } from "@/lib/adapters/director";
import { getGenre } from "@/lib/music/theory";
import {
  fallbackExplainerScript,
  fallbackMarketingCopy,
  generateExplainerScript,
  generateMarketingCopy,
} from "@/lib/adapters/ollama";
import { synthesizeSpeech } from "@/lib/adapters/tts";
import { assembleExplainerVideo } from "@/lib/adapters/ffmpeg";
import { composeWrapperSvg } from "@/lib/compose/wrapper-svg";
import {
  applyDreamPreset,
  applyFraming,
  DREAM_PRESETS,
  dreamRatio,
  enhanceNegativePrompt,
  enhancePrompt,
} from "@/lib/dream/presets";
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
  let workflowName = input.workflowSlug;
  let presetLabel = input.presetId;
  let prompt = "";
  let negativePrompt = "";
  let aspect = "1:1";

  if (input.tool === "dream") {
    const preset =
      DREAM_PRESETS.find((p) => p.id === input.presetId) ?? DREAM_PRESETS[0];
    const base = input.inputs.prompt?.trim() || "";
    if (!base) throw new Error("Describe the image you want to create.");
    const ratio = dreamRatio(input.inputs.ratio);
    const assist = input.inputs.assist !== "off";
    const framing = input.inputs.framing || "auto";
    workflowName = "Dream Studio";
    presetLabel = preset.label;
    aspect = ratio.aspect;
    input.inputs.size = `${ratio.width}x${ratio.height}`;
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
    const genre = getGenre(input.presetId || input.inputs.genre || "synthwave");
    const brief = input.inputs.brief?.trim() || "";
    if (!brief) throw new Error("Describe the track you want.");
    workflowName = "Music";
    presetLabel = genre.label;
    input.inputs.genre = genre.id;
    prompt = brief;
  } else if (input.tool === "director") {
    const brief = input.inputs.brief?.trim() || "";
    if (!brief) throw new Error("Describe the film or video you want.");
    workflowName = input.inputs.mode === "film" ? "Short Film" : "Music Video";
    presetLabel = input.presetId;
    aspect = input.inputs.aspect || "16:9";
    prompt = brief;
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
    modeUsed: "mock",
    outputs: [],
    createdAt: now,
    updatedAt: now,
  };

  await saveJob(job);
  void processJob(job.id, input.referenceImagePath);
  return job;
}

async function processJob(jobId: string, referenceImagePath?: string) {
  const settings = await readSettings();
  await updateJob(jobId, { status: "running", progress: 12 });

  const current = await getJob(jobId);
  if (!current) return;

  try {
    let script: string | undefined;

    if (current.tool === "explainer") {
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
        `SIZE: ${current.inputs.size || current.aspect} · STEPS: ${current.inputs.steps || 4} · CFG: ${current.inputs.cfg || 1} · SEED: ${current.inputs.seed || "random"}`,
      ].join("\n");
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
        modeUsed: settings.musicUrl ? "local-studio" : "mock",
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
        referenceImagePath: undefined,
      });
      await updateJob(jobId, {
        status: "completed",
        progress: 100,
        modeUsed: "mock",
        outputs: directed.outputs,
        script: directed.outputs.find((o) => o.kind === "storyboard")?.text,
      });
      return;
    }

    const wantStudio = settings.generationMode !== "mock";
    const studioUp =
      wantStudio &&
      Boolean(settings.studioUrl && settings.studioApiKey) &&
      (await checkLocalStudioHealth(settings));
    const comfyUp =
      settings.generationMode !== "mock" &&
      settings.generationMode !== "local-studio" &&
      (await checkComfyHealth(settings.comfyUrl));

    let modeUsed: ModeUsed = "mock";
    if (settings.generationMode === "local-studio") {
      if (!studioUp) {
        throw new Error(
          `Local Studio not reachable at ${settings.studioUrl}. Check Netbird peer DNS / API key, or switch mode to auto/mock.`,
        );
      }
      modeUsed = "local-studio";
    } else if (settings.generationMode === "comfyui") {
      if (!comfyUp) {
        throw new Error(
          `ComfyUI not reachable at ${settings.comfyUrl}. Start it on your model machine or switch mode to auto/mock.`,
        );
      }
      modeUsed = "comfyui";
    } else if (settings.generationMode === "auto") {
      if (studioUp) modeUsed = "local-studio";
      else if (comfyUp) modeUsed = "comfyui";
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
    } else {
      packCount = Number(current.inputs.beats || 6);
    }

    // A health probe only says a machine answered, not that it can finish the
    // job. In auto mode keep walking down the chain when one actually fails.
    const chain: ModeUsed[] =
      settings.generationMode === "auto"
        ? (["local-studio", "comfyui", "mock"] as const).filter(
            (m) =>
              m === "mock" ||
              (m === "local-studio" && studioUp) ||
              (m === "comfyui" && comfyUp),
          )
        : [modeUsed];

    const runWith = (mode: ModeUsed) =>
      mode === "local-studio"
        ? runLocalStudioAdapter(ctx, packCount)
        : mode === "comfyui"
          ? runComfyAdapter(ctx)
          : runMockAdapter(ctx, packCount);

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

    // Image-2: if remote adapter produced raw frames, wrap them in marketing chrome via SVG compositor
    if (
      current.tool === "image2" &&
      (modeUsed === "comfyui" || modeUsed === "local-studio")
    ) {
      const wrapper = getImage2Wrapper(current.workflowSlug);
      if (wrapper) {
        // Embed the true generated image into the chrome (data URI keeps the SVG self-contained)
        let subjectImageDataUri: string | undefined;
        const firstImage = result.outputs.find(
          (o) => o.kind === "image" && o.url,
        );
        if (firstImage?.url) {
          try {
            const name = firstImage.url.split("/").pop()!;
            const file = path.join(process.cwd(), ".data", "outputs", name);
            const buf = await fs.readFile(file);
            if (buf.byteLength < 8 * 1024 * 1024) {
              const mime = name.endsWith(".webp")
                ? "image/webp"
                : name.endsWith(".jpg") || name.endsWith(".jpeg")
                  ? "image/jpeg"
                  : "image/png";
              subjectImageDataUri = `data:${mime};base64,${buf.toString("base64")}`;
            }
          } catch {
            // keep chrome-only output if the frame cannot be read
          }
        }
        const composed = await composeWrapperSvg({
          wrapper,
          values: current.inputs,
          presetLabel: current.presetLabel,
          aspect: current.aspect,
          jobId: current.id,
          subjectHint: current.inputs.productDescription || current.prompt,
          subjectImageDataUri,
        });
        result = {
          ...result,
          outputs: [
            ...result.outputs,
            {
              id: nanoid(8),
              kind: "image",
              label: `${wrapper.name} layout`,
              url: composed.url,
            },
          ],
        };
      }
    }

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

      let video;
      if (settings.ffmpegEnabled) {
        video = await assembleExplainerVideo({
          jobId,
          imageUrls,
          audioUrl: audio?.url,
          secondsPerBeat: 3.5,
        });
      }

      const extras = [audio, video].filter(
        (o): o is NonNullable<typeof o> => Boolean(o),
      );
      result = {
        ...result,
        outputs: [...result.outputs, ...extras],
      };
    }

    if (modeUsed === "mock") await new Promise((r) => setTimeout(r, 400));

    await updateJob(jobId, {
      status: "completed",
      progress: 100,
      outputs: result.outputs,
      remotePromptId: result.remotePromptId,
      modeUsed,
      script,
    });
  } catch (error) {
    await updateJob(jobId, {
      status: "failed",
      progress: 100,
      error: error instanceof Error ? error.message : "Generation failed",
    });
  }
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
