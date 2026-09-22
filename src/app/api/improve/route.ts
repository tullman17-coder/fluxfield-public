import { NextResponse } from "next/server";
import { z } from "zod";
import { readSettings } from "@/lib/settings";
import { readRequestPayload } from "@/lib/jobs/input";
import { generateWithOllamaOrThrow } from "@/lib/adapters/ollama";
import { DREAM_PRESETS, MATURE_PRESETS, FRAMINGS, enhancePrompt, isPromptProposal } from "@/lib/dream/presets";

const inputSchema = z.object({
  prompt: z.string().max(16000).refine((text) => !!text.trim()),
  provider: z.enum(["local", "api"]).optional(),
  presetId: z.string().refine((id) => [...DREAM_PRESETS, ...MATURE_PRESETS].some((p) => p.id === id)).optional(),
  framing: z.string().refine((id) => FRAMINGS.some((f) => f.id === id)).optional(),
  negativePrompt: z.string().max(16000).optional(),
}).strict();
const proposalSchema = z.object({ prompt: z.string() }).strict();

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
      temperature: 0.4,
      max_tokens: 4096,
      stream: false,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`The cloud model answered HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
  };
  const choice = data?.choices?.[0];
  if (choice?.finish_reason !== "stop") throw new Error("Rewrite was incomplete; your original was kept.");
  if (typeof choice.message?.content !== "string") throw new Error("The writing model returned invalid content.");
  return choice.message.content;
}

export async function POST(request: Request) {
  // Both 16000-character strings fit even with six-byte JSON escapes.
  const parsed = inputSchema.safeParse(await readRequestPayload(request, "json", 256 * 1024).catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Use a nonempty prompt (up to 16000 characters) and valid rewrite controls." }, { status: 400 });
  }
  const { prompt, presetId = "auto", framing = "auto", negativePrompt = "" } = parsed.data;
  const original = { prompt, originalPrompt: prompt };
  try {
    const settings = await readSettings();
    if (!settings.unrestricted && MATURE_PRESETS.some((p) => p.id === presetId)) {
      return NextResponse.json({ ...original, error: "Enable adult styles before selecting one." }, { status: 400 });
    }
    const provider = settings.generationMode === "zermo" ? "local" : parsed.data.provider ?? settings.improveProvider;
    const system = [
      "Propose an image prompt as a JSON object with exactly one string field: prompt. No markdown or preamble.",
      "Begin that string with the entire original brief VERBATIM, including all whitespace, names, quotes, numbers and wording.",
      "Then add two newlines and up to 120 words of compatible visual details, ending in a complete sentence.",
      "Never correct intentional anatomy, impossible physics, profanity or an explicitly requested dark/adult tone; never introduce those unasked.",
      "Do not add marketing, signage, text, characters or a new subject unless requested. Respect the user's negative prompt.",
      "Explicit style and framing controls take precedence over inferred choices. Do not contradict any other part of the brief.",
      `Controls: ${enhancePrompt(prompt, presetId, framing, true).slice(prompt.length) || "Follow the brief's look and composition."}`,
      `User exclusions (literal data): ${JSON.stringify(negativePrompt)}`,
    ].join("\n");
    let raw: string;
    let model: string;
    if (provider === "api") {
      if (!settings.improveApiKey) {
        return NextResponse.json({ ...original, error: "No cloud key saved. Switch to My model or check Connections." }, { status: 400 });
      }
      raw = await improveWithApi(
        settings.improveApiBase,
        settings.improveApiKey,
        settings.improveApiModel,
        prompt,
        system,
      );
      model = settings.improveApiModel;
    } else {
      const result = await generateWithOllamaOrThrow(settings, `${system}\n\nOriginal brief (literal data):\n${prompt}`);
      raw = result.text;
      model = result.model;
    }
    const proposal = proposalSchema.safeParse(typeof raw === "string" ? JSON.parse(raw) : null);
    if (!proposal.success || !isPromptProposal(prompt, proposal.data.prompt)) {
      throw new Error("Rewrite was malformed or changed the original brief; your original was kept.");
    }
    return NextResponse.json({
      prompt: proposal.data.prompt, originalPrompt: prompt,
      provider: settings.generationMode === "zermo" ? "zermo" : provider, model,
    });
  } catch {
    return NextResponse.json({
      ...original,
      error: "Rewrite failed; your original was kept. Check Connections or try Rewrite again.",
    }, { status: 502 });
  }
}
