import type { AdapterContext, AdapterResult, JobOutput } from "./types";

const HIGGSFIELD_API = "https://api.higgsfield.ai";

export async function checkHiggsfieldHealth(apiKey: string) {
  if (!apiKey) return false;
  try {
    const res = await fetch(`${HIGGSFIELD_API}/account/balance`, {
      headers: { Authorization: `Key ${apiKey}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function runHiggsfieldAdapter(ctx: AdapterContext): Promise<AdapterResult> {
  const { settings, job } = ctx;

  if (!settings.higgsfieldApiKey) {
    throw new Error("Higgsfield API key not configured in Settings → Connections");
  }

  // Determine the appropriate Higgsfield model based on the job type
  const model = resolveHiggsfieldModel(job);

  // Build the request body
  const body: any = {
    prompt: job.prompt,
    negative_prompt: job.negativePrompt || undefined,
  };
  if (!body.params || typeof body.params === "undefined") {
    body.aspect_ratio = job.aspect || "16:9";
  }
  Object.assign(body, model.params);

  // Submit to Higgsfield API
  const submitRes = await fetch(`${HIGGSFIELD_API}/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${settings.higgsfieldApiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!submitRes.ok) {
    const err = await submitRes.text();
    throw new Error(`Higgsfield generation failed: ${err}`);
  }

  const submitData = await submitRes.json();
  const requestId = submitData.request_id;

  // Poll for completion
  const result = await pollHiggsfield(settings.higgsfieldApiKey, requestId);

  if (!result) {
    throw new Error("Higgsfield generation timed out");
  }

  // Parse the result into outputs
  const outputs = parseHiggsfieldResult(result, job);

  return {
    outputs,
    remotePromptId: requestId,
  };
}

async function pollHiggsfield(
  apiKey: string,
  requestId: string,
  maxAttempts = 120,
): Promise<any | null> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const res = await fetch(`${HIGGSFIELD_API}/requests/${requestId}/status`, {
      headers: {
        Authorization: `Key ${apiKey}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Higgsfield status check failed: ${await res.text()}`);
    }

    const data = await res.json();

    if (data.status === "completed") {
      return data;
    }

    if (data.status === "failed") {
      throw new Error(`Higgsfield generation failed: ${data.error}`);
    }
  }

  return null;
}

function resolveHiggsfieldModel(job: any) {
  // Map Fluxfield job types to Higgsfield models
  if (job.tool === "explainer") {
    return {
      endpoint: "explainer_video",
      params: {
        duration: job.inputs.duration || 5,
        resolution: "720p",
        aspect_ratio: job.aspect || "16:9",
      },
    };
  }

  if (job.tool === "ugc" || job.tool === "faceless") {
    return {
      endpoint: "seedance-2.5",
      params: {
        duration: job.inputs.duration || 5,
        resolution: "720p",
        aspect_ratio: job.aspect || "9:16",
        generate_audio: true,
      },
    };
  }

  // Default to Seedance 2.5 for video workflows
  return {
    endpoint: "seedance-2.5",
    params: {
      duration: job.inputs.duration || 5,
      resolution: "720p",
      aspect_ratio: job.aspect || "16:9",
      generate_audio: true,
    },
  };
}

function parseHiggsfieldResult(result: any, job: any) {
  const outputs: JobOutput[] = [];

  if (result.result_url) {
    const isVideo = job.tool === "explainer" || job.tool === "ugc" || job.tool === "faceless";
    outputs.push({
      id: `higgsfield-${Date.now()}`,
      kind: isVideo ? "video" : "image",
      label: "Generated Media",
      url: result.result_url,
    });
  }

  return outputs;
}