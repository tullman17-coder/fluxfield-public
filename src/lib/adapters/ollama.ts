import type { StudioSettings } from "@/lib/adapters/types";

export async function checkOllamaHealth(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/tags`, {
      signal: AbortSignal.timeout(2500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function ollamaGenerate(
  settings: StudioSettings,
  prompt: string,
): Promise<string | undefined> {
  if (!(await checkOllamaHealth(settings.ollamaUrl))) return undefined;
  try {
    const res = await fetch(
      `${settings.ollamaUrl.replace(/\/$/, "")}/api/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: settings.ollamaModel,
          prompt,
          stream: false,
        }),
        signal: AbortSignal.timeout(90_000),
      },
    );
    if (!res.ok) return undefined;
    const data = (await res.json()) as { response?: string };
    return data.response?.trim();
  } catch {
    return undefined;
  }
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

export function fallbackMarketingCopy(args: {
  wrapperName: string;
  presetLabel: string;
  brandName: string;
  productName: string;
}) {
  return `HEADLINE: ${args.brandName} — ${args.productName}
SUBHEAD: ${args.presetLabel} treatment for ${args.wrapperName}
CTA: Shop now →
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
