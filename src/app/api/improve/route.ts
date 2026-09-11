import { NextResponse } from "next/server";
import { readSettings } from "@/lib/settings";

const SYSTEM_PROMPT = [
  "You are a prompt engineer for a local Flux image generator.",
  "Rewrite the user's idea into one vivid, specific image prompt.",
  "Cover subject, environment, lighting, composition, and style cues.",
  "One paragraph, under 120 words. No lists, no preamble, no quotes.",
].join(" ");

function cleanImproved(raw: string): string {
  return raw
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .replace(/^(improved prompt|prompt|rewrite)\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function improveWithOllama(
  baseUrl: string,
  model: string,
  prompt: string,
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: `${SYSTEM_PROMPT}\n\nIdea: ${prompt}\n\nImproved prompt:`,
        stream: false,
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    throw new Error(
      `Ollama not reachable at ${baseUrl}. Start it on your model machine, or switch the provider to API key.`,
    );
  }
  if (!res.ok) {
    throw new Error(`Ollama answered ${res.status} at ${baseUrl}`);
  }
  const data = (await res.json()) as { response?: string };
  const improved = cleanImproved(data.response || "");
  if (!improved) throw new Error("Ollama returned an empty improvement");
  return improved;
}

async function improveWithApi(
  base: string,
  key: string,
  model: string,
  prompt: string,
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
        { role: "system", content: SYSTEM_PROMPT },
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
      `Improvement API answered ${res.status}: ${body.slice(0, 160)}`,
    );
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const improved = cleanImproved(data.choices?.[0]?.message?.content || "");
  if (!improved) throw new Error("Improvement API returned an empty message");
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
      { error: "Describe the image first, then ask for an improvement." },
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
              "No API key set. Add one under Adapters → Prompt improvement, or pick Local.",
          },
          { status: 400 },
        );
      }
      const improved = await improveWithApi(
        settings.improveApiBase,
        settings.improveApiKey,
        settings.improveApiModel,
        prompt,
      );
      return NextResponse.json({
        prompt: improved,
        provider: "api",
        model: settings.improveApiModel,
      });
    }

    const improved = await improveWithOllama(
      settings.ollamaUrl,
      settings.ollamaModel,
      prompt,
    );
    return NextResponse.json({
      prompt: improved,
      provider: "local",
      model: settings.ollamaModel,
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
