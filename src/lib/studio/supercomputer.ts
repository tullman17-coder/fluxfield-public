import type { StudioJob } from "@/lib/adapters/types";
import { DREAM_PRESETS } from "@/lib/dream/presets";

export type SupercomputerStage =
  | "improve"
  | "generate"
  | "copy";

export type SupercomputerInput = {
  brief: string;
  brand: string;
  provider: "local" | "api";
  style: string;
  ratio: string;
  managed: boolean;
  visualQa: boolean;
};

export type SupercomputerResult = {
  improvedPrompt: string;
  improveProvider: string;
  improveModel?: string;
  artUrl?: string;
  copy?: string;
  script?: string;
  visualQa?: string;
};

type Dependencies = {
  fetch?: typeof fetch;
  wait?: (milliseconds: number) => Promise<void>;
  maxPolls?: number;
  onStage?: (stage: SupercomputerStage) => void;
};

async function jsonObject(response: Response): Promise<Record<string, unknown>> {
  try {
    const value = await response.json();
    return value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function message(data: Record<string, unknown>, fallback: string): string {
  return typeof data.error === "string" && data.error.trim()
    ? data.error
    : fallback;
}

export async function runSupercomputerPipeline(
  input: SupercomputerInput,
  dependencies: Dependencies = {},
): Promise<SupercomputerResult> {
  const request = dependencies.fetch ?? fetch;
  const wait =
    dependencies.wait ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const maxPolls = dependencies.maxPolls ?? 150;

  dependencies.onStage?.("improve");
  let improved = input.brief;
  let usedProvider: string = input.provider;
  let improveModel: string | undefined;
  try {
    const response = await request("/api/improve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: input.brief, provider: input.provider }),
    });
    const data = await jsonObject(response);
    if (!response.ok || typeof data.prompt !== "string" || !data.prompt.trim()) {
      if (input.managed) {
        throw new Error(
          message(data, "Managed prompt rewrite failed; no render was started."),
        );
      }
    } else {
      improved = data.prompt;
      if (typeof data.provider === "string" && data.provider.trim()) {
        usedProvider = data.provider;
      }
      if (typeof data.model === "string" && data.model.trim()) {
        improveModel = data.model;
      }
    }
  } catch (error) {
    if (input.managed) throw error;
  }

  dependencies.onStage?.("generate");
  const createResponse = await request("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tool: "dream",
      workflowSlug: "dream",
      presetId: input.style,
      inputs: {
        prompt: improved,
        negativePrompt:
          "extra limbs, missing limbs, fused fingers, crossed eyes, collapsed face, watermark",
        ratio: input.ratio,
        framing: "auto",
        count: "1",
        assist: "on",
        productName: input.brand.trim() || "Key art",
        visualQa: input.visualQa ? "on" : "off",
      },
    }),
  });
  const created = await jsonObject(createResponse);
  const createdJob = created.job as StudioJob | undefined;
  if (!createResponse.ok || !createdJob?.id) {
    throw new Error(message(created, "Could not start the key art job."));
  }

  let done: StudioJob | null = null;
  for (let poll = 0; poll < maxPolls; poll += 1) {
    await wait(1200);
    const response = await request(`/api/jobs/${createdJob.id}`);
    if (!response.ok) continue;
    const data = await jsonObject(response);
    const candidate = data.job as StudioJob | undefined;
    if (candidate?.status === "completed") {
      done = candidate;
      break;
    }
    if (candidate?.status === "failed") {
      throw new Error(candidate.error || "Could not make the art");
    }
  }
  if (!done) {
    throw new Error("This is taking too long. Check your connections in Settings.");
  }

  dependencies.onStage?.("copy");
  let copy: string | undefined;
  try {
    const response = await request("/api/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandName: input.brand,
        productName: "Key art",
        productDescription: improved,
        wrapperName: "superComputer",
        presetLabel:
          DREAM_PRESETS.find((preset) => preset.id === input.style)?.label ||
          input.style,
      }),
    });
    const data = await jsonObject(response);
    if (!response.ok || typeof data.copy !== "string" || !data.copy.trim()) {
      if (input.managed) {
        throw new Error(
          message(data, "Managed campaign copy failed; the run was not completed."),
        );
      }
    } else {
      copy = data.copy;
    }
  } catch (error) {
    if (input.managed) throw error;
  }

  return {
    improvedPrompt: improved,
    improveProvider: usedProvider,
    improveModel,
    artUrl: done.outputs.find((output) => output.kind === "image" && output.url)
      ?.url,
    copy,
    script: done.script,
    visualQa: done.outputs.find((output) => output.label === "Visual QA")?.text,
  };
}
