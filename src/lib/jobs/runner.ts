import path from "path";
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
import { runMockAdapter } from "@/lib/adapters/mock";
import {
  fallbackExplainerScript,
  fallbackMarketingCopy,
  generateExplainerScript,
  generateMarketingCopy,
} from "@/lib/adapters/ollama";
import { synthesizeSpeech } from "@/lib/adapters/tts";
import { assembleExplainerVideo } from "@/lib/adapters/ffmpeg";
import { composeWrapperSvg } from "@/lib/compose/wrapper-svg";
import type { JobTool, StudioJob } from "@/lib/adapters/types";
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

  if (input.tool === "image2") {
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

    const comfyUp =
      settings.generationMode !== "mock" &&
      (await checkComfyHealth(settings.comfyUrl));
    const useComfy =
      settings.generationMode === "comfyui" ||
      (settings.generationMode === "auto" && comfyUp);

    if (settings.generationMode === "comfyui" && !comfyUp) {
      throw new Error(
        `ComfyUI not reachable at ${settings.comfyUrl}. Start it on your model machine or switch mode to auto/mock.`,
      );
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
      modeUsed: useComfy ? "comfyui" : "mock",
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
    } else {
      packCount = Number(current.inputs.beats || 6);
    }

    let result = useComfy
      ? await runComfyAdapter(ctx)
      : await runMockAdapter(ctx, packCount);

    // Image-2: if Comfy produced raw frames, wrap them in marketing chrome via SVG compositor (mock chrome overlay note in script)
    if (current.tool === "image2" && useComfy) {
      const wrapper = getImage2Wrapper(current.workflowSlug);
      if (wrapper) {
        const composed = await composeWrapperSvg({
          wrapper,
          values: current.inputs,
          presetLabel: current.presetLabel,
          aspect: current.aspect,
          jobId: current.id,
          subjectHint: "ComfyUI subject — chrome composited locally",
        });
        result = {
          ...result,
          outputs: [
            ...result.outputs,
            {
              id: nanoid(8),
              kind: "image",
              label: `${wrapper.name} wrapper chrome`,
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
        label: `VO · ${current.inputs.voice || "default"}`,
      });

      const imageUrls = result.outputs
        .filter((o) => o.kind === "image" && o.url)
        .map((o) => o.url!) ;

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

    if (!useComfy) await new Promise((r) => setTimeout(r, 400));

    await updateJob(jobId, {
      status: "completed",
      progress: 100,
      outputs: result.outputs,
      remotePromptId: result.remotePromptId,
      modeUsed: useComfy ? "comfyui" : "mock",
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
