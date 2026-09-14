// Pure UI policy: no server transports or secrets in this import graph.
export type ManagedHealth = {
  configured: boolean;
  ready: boolean;
  apiReachable: boolean;
  workerConfigured: boolean;
  text: { ready: boolean; model: string | null };
  image: { ready: boolean; model: string | null };
  music: { ready: boolean; model: string | null };
  error?: string;
};

export const ZERMO_IMAGE_PROFILES = [
  { steps: "4", label: "Fast · 4 steps" },
  { steps: "8", label: "Detail · 8 steps" },
] as const;

export function jobStatusLabel(job: { status: string; phase?: string } | null): string {
  if (!job) return "Ready for a prompt";
  if (job.status === "queued") return "Queued";
  if (job.status === "completed") return "Completed";
  if (job.status === "failed") return "Failed";
  if (job.status !== "running") return job.status;
  if (job.phase === "finalize") return "Saving";
  if (job.phase === "compose") return "Composing";
  if (job.phase === "intake") return "Preparing";
  return "Generating";
}

export function exactSeed(value: unknown): string {
  if (typeof value === "string" && /^\d+$/.test(value)) return value;
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? String(value) : "";
}

export function musicLengths(mode: string | undefined) {
  return (mode === "zermo" ? [10, 30, 60, 90] : [30, 60, 120, 180, 300])
    .map((seconds) => ({ id: String(seconds), label: `${seconds} sec` }));
}

export function musicSeconds(mode: string | undefined, value: string): string {
  if (mode !== "zermo") return value;
  const n = Number(value);
  return String(Number.isFinite(n) && value.trim() ? Math.max(10, Math.min(90, Math.round(n))) : 60);
}

export function preferredImproveProvider(settings: {
  improveProvider?: "local" | "api";
  hasImproveApiKey?: boolean;
} | null): "local" | "api" {
  return settings?.improveProvider === "api" && settings.hasImproveApiKey
    ? "api"
    : "local";
}

export function supercomputerReady(health: {
  text?: { ready?: boolean };
  image?: { ready?: boolean };
  music?: { ready?: boolean };
} | null): boolean {
  return health?.text?.ready === true && health.image?.ready === true;
}

export function jobRunnerSupportsVisualQa(tool: string): boolean {
  return ["workflow", "image2", "explainer"].includes(tool);
}

type MusicJob = {
  zermoJobs?: Record<
    string,
    { effective?: Record<string, unknown> }
  >;
};

function effectiveLabel(key: string): string {
  if (key === "bpm") return "BPM";
  return key
    .replace(/[_-]+/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function musicEffectiveSettings(
  job: MusicJob | null,
): { label: string; value: string }[] {
  const effective = job?.zermoJobs?.["music:track"]?.effective;
  const settings = effective?.settings;
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return [];
  }
  const values = settings as Record<string, unknown>;
  const ordered = [
    ...["duration", "key", "bpm"].filter((key) => key in values),
    ...Object.keys(values).filter(
      (key) => !["duration", "key", "bpm", "lyrics"].includes(key),
    ),
  ];
  return ordered.flatMap((key) => {
    const value = values[key];
    if (!["string", "number", "boolean"].includes(typeof value)) return [];
    const rendered =
      key === "duration" && (typeof value === "number" || /^\d+(?:\.\d+)?$/.test(String(value)))
        ? `${value} seconds`
        : String(value);
    return [{ label: effectiveLabel(key), value: rendered }];
  });
}

export function visualQaSummary(
  requested: string | undefined,
  modeUsed: string,
  checks: string[],
): string {
  if (requested !== "on") return "Skipped: opt-in is off.";
  if (modeUsed === "mock") {
    return "Skipped: preview mode does not run visual review.";
  }
  return checks.length ? checks.join("\n\n") : "Skipped: no compatible visual review was available.";
}

export function settingsWritePayload(settings: Record<string, unknown>): Record<string, unknown> {
  const payload = { ...settings };
  delete payload.hasStudioApiKey;
  delete payload.hasImproveApiKey;
  for (const key of ["studioApiKey", "improveApiKey"]) {
    if (typeof payload[key] !== "string" || !(payload[key] as string).trim()) delete payload[key];
  }
  return payload;
}
