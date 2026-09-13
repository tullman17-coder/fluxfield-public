export type VideoWorkflowTool = "ugc" | "ad-multiplier" | "faceless";

export type VideoWorkflowMode = {
  id: string;
  label: string;
  description: string;
};

export type VideoWorkflowDef = {
  id: VideoWorkflowTool;
  name: string;
  tagline: string;
  accent: string;
  modes: VideoWorkflowMode[];
  defaultMode: string;
  /** Keyframes to generate when live/mock art runs. */
  frameCount: number;
  aspectDefault: string;
};

export const VIDEO_WORKFLOWS: VideoWorkflowDef[] = [
  {
    id: "ugc",
    name: "UGC",
    tagline: "Creator-style clips — review, product, try-on, unboxing, tutorial.",
    accent: "#e77ae6",
    defaultMode: "review",
    frameCount: 6,
    aspectDefault: "9:16",
    modes: [
      {
        id: "review",
        label: "Review",
        description: "Honest take with talking beats and product inserts.",
      },
      {
        id: "product",
        label: "Product",
        description: "Hands-on demo with close-ups and benefits.",
      },
      {
        id: "tryon",
        label: "Try-on",
        description: "Fitting-room energy — on, off, and the mirror shot.",
      },
      {
        id: "unboxing",
        label: "Unboxing",
        description: "Box open, reveal, first impression.",
      },
      {
        id: "tutorial",
        label: "Tutorial",
        description: "Step-by-step how-to with clear beats.",
      },
    ],
  },
  {
    id: "ad-multiplier",
    name: "Ad Multiplier",
    tagline: "Several cut variants from one brief — for paid social and A/B.",
    accent: "#d565d6",
    defaultMode: "variants",
    frameCount: 5,
    aspectDefault: "9:16",
    modes: [
      {
        id: "variants",
        label: "Variants",
        description: "Hook, benefit, proof, and CTA cuts from the same brief.",
      },
      {
        id: "hooks",
        label: "Hook pack",
        description: "Opening-second alternatives to test attention.",
      },
      {
        id: "angles",
        label: "Angles",
        description: "Different selling angles with shared product art.",
      },
    ],
  },
  {
    id: "faceless",
    name: "Faceless",
    tagline: "Narrated stories and explainers without an on-camera host.",
    accent: "#c084fc",
    defaultMode: "explainer",
    frameCount: 8,
    aspectDefault: "16:9",
    modes: [
      {
        id: "explainer",
        label: "Explainer",
        description: "Clear beats that teach a topic over key art.",
      },
      {
        id: "story",
        label: "Story",
        description: "Narrative arc with rising tension and a payoff.",
      },
      {
        id: "kids",
        label: "Kids",
        description: "Bright, simple scenes for a younger audience.",
      },
    ],
  },
];

export function getVideoWorkflow(id: string): VideoWorkflowDef | undefined {
  return VIDEO_WORKFLOWS.find((w) => w.id === id);
}

export function getVideoWorkflowMode(def: VideoWorkflowDef, modeId: string) {
  return def.modes.find((m) => m.id === modeId) ?? def.modes[0];
}
