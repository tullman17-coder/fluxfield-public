import type { StudioSettings } from "@/lib/adapters/types";
import {
  pickPreferredModel,
  pickPreferredVisionModel,
  probeOllama,
  type ProbeResult,
} from "@/lib/adapters/probe";

export async function checkOllamaHealth(baseUrl: string): Promise<boolean> {
  return (await probeOllama(baseUrl)).ok;
}

export async function describeOllama(baseUrl: string): Promise<ProbeResult> {
  return probeOllama(baseUrl);
}

function ollamaErrorMessage(status: number, body: string, url: string): string {
  const slice = body.replace(/\s+/g, " ").slice(0, 180);
  if (status === 404) {
    if (/model/i.test(body)) {
      return `Ollama has no such model (${slice || "404"}). Pull it or pick one that is already on the machine.`;
    }
    return `Ollama answered 404 at ${url}. The generate route is missing — this is not an Ollama API.`;
  }
  return `Ollama answered ${status} at ${url}${slice ? `: ${slice}` : "."}`;
}

async function generateOpenAI(
  url: string,
  model: string,
  prompt: string,
): Promise<string | undefined> {
  const res = await fetch(`${url.replace(/\/$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) return undefined;
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content?.trim();
}

export async function resolveOllamaTarget(settings: StudioSettings): Promise<{
  url: string;
  model: string;
  dialect: "ollama" | "openai";
  models: string[];
} | null> {
  const probe = await probeOllama(settings.ollamaUrl);
  if (!probe.reachable) return null;
  const model = pickPreferredModel(probe.models || [], settings.ollamaModel);
  if (!model) return null;
  return {
    url: probe.url || settings.ollamaUrl,
    model,
    dialect: probe.dialect || "ollama",
    models: probe.models || [],
  };
}

async function ollamaGenerate(
  settings: StudioSettings,
  prompt: string,
): Promise<string | undefined> {
  const target = await resolveOllamaTarget(settings);
  if (!target) return undefined;
  try {
    if (target.dialect === "openai") {
      return await generateOpenAI(target.url, target.model, prompt);
    }
    const res = await fetch(`${target.url.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: target.model,
        prompt,
        stream: false,
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (res.status === 404) {
      return await generateOpenAI(target.url, target.model, prompt);
    }
    if (!res.ok) return undefined;
    const data = (await res.json()) as { response?: string };
    return data.response?.trim();
  } catch {
    return undefined;
  }
}

export async function generateWithOllamaOrThrow(
  settings: StudioSettings,
  prompt: string,
): Promise<{ text: string; model: string; url: string }> {
  const probe = await probeOllama(settings.ollamaUrl);
  if (!probe.reachable) {
    throw new Error(
      `Could not reach a local model server at ${settings.ollamaUrl}. Start Ollama or LM Studio, or switch to Cloud.`,
    );
  }
  const model = pickPreferredModel(probe.models || [], settings.ollamaModel);
  if (!model) {
    throw new Error(
      `A model server is running at ${probe.url || settings.ollamaUrl}, but it has no models. Run \`ollama pull llama3.2\` (or load one in LM Studio), then refresh Settings.`,
    );
  }
  const url = probe.url || settings.ollamaUrl;
  if (probe.dialect === "openai") {
    const text = await generateOpenAI(url, model, prompt);
    if (!text) {
      throw new Error(
        `The OpenAI-style server at ${url} accepted the host check but returned nothing for model ${model}.`,
      );
    }
    return { text, model, url };
  }

  let res: Response;
  try {
    res = await fetch(`${url.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    throw new Error(
      `Could not reach Ollama at ${url}. Start it on that machine, or switch to Cloud.`,
    );
  }

  if (res.status === 404) {
    const body = await res.text().catch(() => "");
    const viaOpenAI = await generateOpenAI(url, model, prompt);
    if (viaOpenAI) return { text: viaOpenAI, model, url };
    throw new Error(ollamaErrorMessage(404, body, url));
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(ollamaErrorMessage(res.status, body, url));
  }
  const data = (await res.json()) as { response?: string };
  const text = data.response?.trim();
  if (!text) throw new Error("Ollama sent back nothing to use.");
  return { text, model, url };
}

export async function generateMarketingCopy(
  settings: StudioSettings,
  args: {
    wrapperName: string;
    presetLabel: string;
    brandName: string;
    productName: string;
    productDescription: string;
  },
): Promise<string | undefined> {
  return ollamaGenerate(
    settings,
    `Write short marketing copy for a ${args.wrapperName} wrapper (${args.presetLabel}).
Brand: ${args.brandName}
Product: ${args.productName}
Details: ${args.productDescription}
Keep the brand and product names spelled exactly as given.
Headline and CTA must be complete grammatical phrases — no cut-off words.
Do not add warnings, disclaimers, or safety copy.
Return:
HEADLINE:
SUBHEAD:
CTA:
BEATS:
1)
2)
3)`,
  );
}

export async function generateExplainerScript(
  settings: StudioSettings,
  args: {
    topic: string;
    presetName: string;
    beats: number;
    duration: string;
  },
): Promise<string | undefined> {
  return ollamaGenerate(
    settings,
    `Write an explainer video script in style "${args.presetName}" about: ${args.topic}
Duration target: ${args.duration}
Produce exactly ${args.beats} numbered beats.
Format:
TITLE:
BEAT 1: [visual] | [VO]
BEAT 2: ...
...
END CARD:`,
  );
}

/**
 * Words for a track. The section list comes from the arrangement so the model
 * writes to the shape of the music instead of a generic verse/chorus.
 */
export async function generateLyrics(
  settings: StudioSettings,
  args: {
    brief: string;
    title: string;
    genre: string;
    mood: string;
    sections: string[];
    linesPerSection: number;
  },
): Promise<string | undefined> {
  const wanted = [...new Set(args.sections)].join(", ");
  return ollamaGenerate(
    settings,
    `Write lyrics for a ${args.genre} track called "${args.title}".
Subject: ${args.brief}
Feel: ${args.mood}
Write a block for each of these parts: ${wanted}
Around ${args.linesPerSection} lines per block. The chorus is the hook and repeats.
Write the words only — no commentary, no explanation, no notes about the request.
Format each block as:
[Part name]
line
line`,
  );
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export type ImageReview = {
  ok: boolean;
  anatomy: { ok: boolean; issues: string[] };
  text: { ok: boolean; issues: string[] };
  repair: string;
  model?: string;
};

function reviewFromRecord(raw: Record<string, unknown>): ImageReview {
  const anatomy = raw.anatomy;
  const text = raw.text;
  const anatomyRec =
    anatomy && typeof anatomy === "object"
      ? (anatomy as Record<string, unknown>)
      : {};
  const textRec =
    text && typeof text === "object" ? (text as Record<string, unknown>) : {};
  const anatomyOk = anatomyRec.ok !== false;
  const textOk = textRec.ok !== false;
  const ok = raw.ok !== false && anatomyOk && textOk;
  return {
    ok,
    anatomy: { ok: anatomyOk, issues: asStringList(anatomyRec.issues) },
    text: { ok: textOk, issues: asStringList(textRec.issues) },
    repair: typeof raw.repair === "string" ? raw.repair.trim() : "",
  };
}

function stripDataUri(image: string): string {
  const comma = image.indexOf(",");
  if (image.startsWith("data:") && comma > 0) return image.slice(comma + 1);
  return image;
}

/**
 * Ask a pulled VL model to check anatomy and readable copy.
 * Returns null when no vision model is available.
 */
export async function reviewImageWithVision(
  settings: StudioSettings,
  args: { imageDataUri: string; prompt: string },
): Promise<ImageReview | null> {
  const probe = await probeOllama(settings.ollamaUrl);
  const model = pickPreferredVisionModel(probe.models || []);
  if (!probe.reachable || !model) return null;
  const url = (probe.url || settings.ollamaUrl).replace(/\/$/, "");
  const image = stripDataUri(args.imageDataUri);
  if (!image) return null;

  try {
    const res = await fetch(`${url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        messages: [
          {
            role: "user",
            content: args.prompt,
            images: [image],
          },
        ],
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      message?: { content?: string };
    };
    const raw = extractJsonObject(data.message?.content || "");
    if (!raw) return null;
    return { ...reviewFromRecord(raw), model };
  } catch {
    return null;
  }
}

export function fallbackMarketingCopy(args: {
  wrapperName: string;
  presetLabel: string;
  brandName: string;
  productName: string;
}) {
  return `HEADLINE: ${args.brandName} — ${args.productName}
SUBHEAD: ${args.presetLabel} treatment for ${args.wrapperName}
CTA: Shop now
BEATS:
1) Hook with product hero
2) Benefit close-up
3) Pack shot + CTA`;
}

export function fallbackExplainerScript(args: {
  topic: string;
  presetName: string;
  beats: number;
}) {
  const lines = Array.from({ length: args.beats }, (_, i) => {
    const n = i + 1;
    if (n === 1) return `BEAT ${n}: [cold open visual] | [VO: ${args.topic} — here's the idea.]`;
    if (n === args.beats)
      return `BEAT ${n}: [end card] | [VO: That's ${args.topic}, explained.]`;
    return `BEAT ${n}: [supporting visual ${n}] | [VO: Key point ${n - 1}.]`;
  });
  return `TITLE: ${args.topic}
STYLE: ${args.presetName}
${lines.join("\n")}
END CARD: Learn more`;
}
