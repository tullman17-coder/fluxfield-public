export type GenerationMode = "auto" | "mock" | "comfyui" | "local-studio" | "zermo";

export type StudioSettings = {
  hasStudioApiKey?: boolean;
  hasImproveApiKey?: boolean;
  comfyUrl: string;
  ollamaUrl: string;
  ollamaModel: string;
  generationMode: GenerationMode;
  comfyCheckpoint: string;
  /** Piper or OpenAI-compatible TTS base URL */
  ttsUrl: string;
  ttsVoice: string;
  /** Local music server (ACE-Step / MusicGen style). Blank uses the built-in composer. */
  musicUrl: string;
  musicModel: string;
  ffmpegEnabled: boolean;
  /**
   * Local Dream Studio / Local Studio controller.
   * Prefer Netbird peer DNS — avoid leftover Tailscale 100.x hosts.
   */
  studioUrl: string;
  /** Bearer token for /v1/images/generations (never logged). */
  studioApiKey: string;
  /**
   * AI prompt improvement provider.
   * "local" uses the Ollama server above; "api" uses the OpenAI-compatible
   * endpoint + key below.
   */
  improveProvider: "local" | "api";
  improveApiBase: string;
  improveApiKey: string;
  improveApiModel: string;
  /**
   * Openweight models take the prompt as written. With this on, Fluxfield
   * stops adding content filters of its own and tells the controller to leave
   * its own checker off.
   */
  unrestricted: boolean;
};

export type JobStatus = "queued" | "running" | "completed" | "failed";
export type JobTool =
  | "workflow"
  | "image2"
  | "explainer"
  | "dream"
  | "music"
  | "director"
  | "ugc"
  | "ad-multiplier"
  | "faceless";

export type JobOutput = {
  id: string;
  kind: "image" | "text" | "script" | "storyboard" | "audio" | "video";
  label: string;
  url?: string;
  text?: string;
};

export type ModeUsed = "mock" | "comfyui" | "local-studio" | "zermo";

export type StudioJob = {
  id: string;
  tool: JobTool;
  workflowSlug: string;
  workflowName: string;
  presetId: string;
  presetLabel: string;
  status: JobStatus;
  progress: number;
  prompt: string;
  negativePrompt: string;
  aspect: string;
  inputs: Record<string, string>;
  modeUsed: ModeUsed;
  remotePromptId?: string;
  generationMode?: GenerationMode;
  referenceImagePath?: string;
  zermoJobs?: Record<string, import("./zermo").ZermoIntent>;
  error?: string;
  outputs: JobOutput[];
  script?: string;
  /** Multi-step studio jobs (intake → subject → compose → finalize). */
  phase?: "intake" | "subject" | "compose" | "finalize";
  brandKitId?: string;
  primaryOutputId?: string;
  createdAt: string;
  updatedAt: string;
};

export type AdapterContext = {
  settings: StudioSettings;
  job: StudioJob;
  referenceImagePath?: string;
};

export type AdapterResult = {
  outputs: JobOutput[];
  remotePromptId?: string;
};
