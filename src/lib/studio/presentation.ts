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

export function settingsWritePayload(settings: Record<string, unknown>): Record<string, unknown> {
  const payload = { ...settings };
  delete payload.hasStudioApiKey;
  delete payload.hasImproveApiKey;
  for (const key of ["studioApiKey", "improveApiKey"]) {
    if (typeof payload[key] !== "string" || !(payload[key] as string).trim()) delete payload[key];
  }
  return payload;
}
