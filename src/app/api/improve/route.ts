import { NextResponse } from "next/server";
import { readSettings } from "@/lib/settings";
import { generateWithOllamaOrThrow } from "@/lib/adapters/ollama";

const SYSTEM_PROMPT = [
  "You are a prompt engineer for a local Flux image generator.",
  "Rewrite the user's idea into one vivid, specific image prompt.",
  "Cover subject, environment, lighting, composition, and style cues.",
  "One paragraph, under 120 words. No lists, no preamble, no quotes.",
].join(" ");

/**
 * A rewrite is meant to sharpen the idea, not change it. Openweight models
 * take the subject as given, so say so rather than letting the model quietly
 * swap it for something else.
 */
const KEEP_SUBJECT = [
  "Keep the subject exactly as given.",
  "Do not soften it, substitute it, add commentary, or decline.",
  "Return only the rewritten prompt.",
].join(" ");

function systemPrompt(unrestricted: boolean) {
  return unrestricted ? `${SYSTEM_PROMPT} ${KEEP_SUBJECT}` : SYSTEM_PROMPT;
}

function cleanImproved(raw: string): string {
  return raw
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .replace(/^(improved prompt|prompt|rewrite)\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function improveWithOllama(
  prompt: string,
  system: string,
): Promise<{ text: string; model: string }> {
  const settings = await readSettings();
  const raw = await generateWithOllamaOrThrow(
    settings,
    `${system}\n\nIdea: ${prompt}\n\nImproved prompt:`,
  );
  const improved = cleanImproved(raw.text);
  if (!improved) throw new Error("Ollama sent back nothing to use.");
  return { text: improved, model: raw.model };
}

async function improveWithApi(
  base: string,
  key: string,
  model: string,
  prompt: string,
  system: string,
): Promise<string> {
  const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 260,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `The cloud model answered ${res.status}: ${body.slice(0, 160)}`,
    );
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const improved = cleanImproved(data.choices?.[0]?.message?.content || "");
  if (!improved) throw new Error("The cloud model sent back nothing to use.");
  return improved;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    prompt?: string;
    provider?: "local" | "api";
  };
  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json(
      { error: "Describe the image first, then ask for a rewrite." },
      { status: 400 },
    );
  }

  const settings = await readSettings();
  const provider = body.provider ?? settings.improveProvider;

  try {
    if (provider === "api") {
      if (!settings.improveApiKey) {
        return NextResponse.json(
          {
            error:
              "No cloud key saved yet. Add one in Settings, or switch to My model.",
          },
          { status: 400 },
        );
      }
      const improved = await improveWithApi(
        settings.improveApiBase,
        settings.improveApiKey,
        settings.improveApiModel,
        prompt,
        systemPrompt(settings.unrestricted),
      );
      return NextResponse.json({
        prompt: improved,
        provider: "api",
        model: settings.improveApiModel,
      });
    }

    const improved = await improveWithOllama(
      prompt,
      systemPrompt(settings.unrestricted),
    );
    return NextResponse.json({
      prompt: improved.text,
      provider: "local",
      model: improved.model,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Prompt improvement failed",
      },
      { status: 502 },
    );
  }
}
