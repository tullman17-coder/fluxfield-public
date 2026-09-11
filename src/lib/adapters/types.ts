export type GenerationMode = "auto" | "mock" | "comfyui";

export type StudioSettings = {
  comfyUrl: string;
  ollamaUrl: string;
  ollamaModel: string;
  generationMode: GenerationMode;
  comfyCheckpoint: string;
  /** Piper or OpenAI-compatible TTS base URL */
  ttsUrl: string;
  ttsVoice: string;
  ffmpegEnabled: boolean;
};

export type JobStatus = "queued" | "running" | "completed" | "failed";
export type JobTool = "workflow" | "image2" | "explainer";

export type JobOutput = {
  id: string;
  kind: "image" | "text" | "script" | "storyboard" | "audio" | "video";
  label: string;
  url?: string;
  text?: string;
};

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
  modeUsed: "mock" | "comfyui";
  remotePromptId?: string;
  error?: string;
  outputs: JobOutput[];
  script?: string;
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
