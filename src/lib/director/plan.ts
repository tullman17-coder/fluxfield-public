import {
  type Arrangement,
  planArrangement,
  timecode,
} from "@/lib/music/theory";

/**
 * Long-form planning. A shot list is built to fill a runtime measured in
 * minutes rather than a handful of clips, then handed to the frame generator
 * one shot at a time.
 */

export type DirectorMode = "music-video" | "film";

/** Durations offered in the UI, up to an hour. */
export const RUNTIMES = [
  { id: "60", label: "1 min" },
  { id: "180", label: "3 min" },
  { id: "300", label: "5 min" },
  { id: "600", label: "10 min" },
  { id: "900", label: "15 min" },
  { id: "1800", label: "30 min" },
  { id: "3600", label: "60 min" },
];

export const LOOKS = [
  { id: "cinematic", label: "Cinematic", blurb: "Anamorphic haze, deep contrast." },
  { id: "documentary", label: "Documentary", blurb: "Available light, handheld honesty." },
  { id: "noir", label: "Noir", blurb: "Hard shadow, smoke, low key." },
  { id: "vaporwave", label: "Neon", blurb: "Saturated night, chrome and glow." },
  { id: "fantasy", label: "Painterly", blurb: "Storybook light, heavy atmosphere." },
  { id: "concept", label: "Concept", blurb: "Production-art scale and grandeur." },
];

/** How long a single shot holds, by pacing. Shorter cuts = more shots. */
const PACING = {
  slow: { base: 9, spread: 5 },
  steady: { base: 6, spread: 3 },
  fast: { base: 3.2, spread: 1.6 },
  frantic: { base: 1.8, spread: 0.9 },
} as const;

export type Pacing = keyof typeof PACING;

export type Shot = {
  id: string;
  index: number;
  startSec: number;
  endSec: number;
  timecode: string;
  /** Section name for a music video, act/scene label for a film. */
  section: string;
  /** Shot size, e.g. "Wide". */
  size: string;
  /** Camera instruction. */
  move: string;
  /** What is in frame — this becomes the image prompt. */
  action: string;
  /** Spoken line or lyric cue, when there is one. */
  line?: string;
  energy: number;
};

export type Production = {
  mode: DirectorMode;
  title: string;
  logline: string;
  runtimeSec: number;
  look: string;
  pacing: Pacing;
  shots: Shot[];
  /** Present for music videos — the track the cuts are aligned to. */
  arrangement?: Arrangement;
  /** Long runs are generated in windows rather than one pass. */
  windows: { index: number; startSec: number; endSec: number; shots: number }[];
};

const SIZES = [
  "Extreme wide",
  "Wide",
  "Medium wide",
  "Medium",
  "Medium close",
  "Close",
  "Extreme close",
  "Insert",
];

const MOVES = [
  "locked off",
  "slow push in",
  "slow pull back",
  "handheld drift",
  "lateral track",
  "crane down",
  "whip pan",
  "rack focus",
  "orbit",
];

const FILM_ACTS = [
  "Act I — Setup",
  "Act I — Disruption",
  "Act II — Pursuit",
  "Act II — Reversal",
  "Act III — Confrontation",
  "Act III — Resolve",
];

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Pull recurring nouns out of the brief so shots stay about the same subject. */
function subjectsFrom(brief: string): string[] {
  const stop = new Set([
    "the", "and", "with", "that", "this", "from", "into", "over", "then",
    "they", "them", "their", "about", "while", "where", "when", "which",
    "video", "film", "music", "shot", "scene", "make", "want", "something",
  ]);
  const words = brief
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stop.has(w));
  const seen: string[] = [];
  for (const w of words) if (!seen.includes(w)) seen.push(w);
  return seen.length ? seen.slice(0, 8) : ["the subject"];
}

function titleFrom(brief: string, mode: DirectorMode) {
  const subs = subjectsFrom(brief);
  const pick = subs.slice(0, 2).join(" ");
  const title = pick.replace(/\b\w/g, (c) => c.toUpperCase());
  return title || (mode === "film" ? "Untitled Film" : "Untitled Video");
}

export function planProduction(args: {
  mode: DirectorMode;
  brief: string;
  runtimeSec: number;
  look: string;
  pacing: Pacing;
  genre?: string;
  mood?: string;
  seedText?: string;
}): Production {
  const rand = rng(hash(args.seedText || args.brief));
  const subjects = subjectsFrom(args.brief);
  const pace = PACING[args.pacing] ?? PACING.steady;

  // Music videos cut to the track, so plan the track first and inherit its map.
  const arrangement =
    args.mode === "music-video"
      ? planArrangement({
          genre: args.genre || "synthwave",
          mood: args.mood || "neutral",
          targetSec: args.runtimeSec,
          seedText: args.seedText || args.brief,
        })
      : undefined;

  const runtimeSec = arrangement?.durationSec ?? args.runtimeSec;
  const shots: Shot[] = [];

  const pushShot = (
    start: number,
    end: number,
    section: string,
    energy: number,
  ) => {
    const i = shots.length;
    const subject = subjects[i % subjects.length];
    const other = subjects[(i + 3) % subjects.length];
    // Higher energy favours tighter framing and more aggressive camera.
    const sizeIdx = Math.min(
      SIZES.length - 1,
      Math.floor(rand() * 4 + energy * 4),
    );
    const moveIdx = Math.floor(rand() * MOVES.length * (0.5 + energy * 0.5));
    shots.push({
      id: `sh${i}`,
      index: i,
      startSec: start,
      endSec: end,
      timecode: timecode(start),
      section,
      size: SIZES[sizeIdx],
      move: MOVES[Math.min(MOVES.length - 1, moveIdx)],
      action:
        energy > 0.8
          ? `${subject} at full tilt, ${other} breaking the frame`
          : energy > 0.5
            ? `${subject} moving through the space, ${other} in the background`
            : `${subject} still, held on ${other}`,
      energy,
    });
  };

  if (arrangement) {
    // One shot per cut, with cuts landing on beats inside each section.
    const secPerBeat = 60 / arrangement.bpm;
    for (const section of arrangement.sections) {
      const hold = pace.base * (1.25 - section.energy * 0.5);
      // Round the hold to a whole number of beats so cuts land on the grid.
      const beats = Math.max(2, Math.round(hold / secPerBeat));
      const step = beats * secPerBeat;
      for (let t = section.startSec; t < section.endSec - 0.01; t += step) {
        pushShot(
          t,
          Math.min(section.endSec, t + step),
          section.name,
          section.energy,
        );
      }
    }
  } else {
    // Film: walk the acts, varying hold length around the pacing base.
    const actCount = FILM_ACTS.length;
    const perAct = runtimeSec / actCount;
    for (let a = 0; a < actCount; a++) {
      const actStart = a * perAct;
      const actEnd = actStart + perAct;
      // Tension rises through the acts, peaking in the confrontation.
      const energy = Math.min(1, 0.3 + (a / (actCount - 1)) * 0.8);
      let t = actStart;
      while (t < actEnd - 0.01) {
        const hold = Math.max(
          1.2,
          pace.base + (rand() - 0.5) * 2 * pace.spread - energy * 1.5,
        );
        const end = Math.min(actEnd, t + hold);
        pushShot(t, end, FILM_ACTS[a], energy);
        t = end;
      }
    }
  }

  // Long productions are rendered in windows so a 60 minute plan is not one job.
  const WINDOW_SEC = 120;
  const windows: Production["windows"] = [];
  for (let w = 0; w * WINDOW_SEC < runtimeSec; w++) {
    const startSec = w * WINDOW_SEC;
    const endSec = Math.min(runtimeSec, startSec + WINDOW_SEC);
    windows.push({
      index: w,
      startSec,
      endSec,
      shots: shots.filter((s) => s.startSec >= startSec && s.startSec < endSec)
        .length,
    });
  }

  return {
    mode: args.mode,
    title: titleFrom(args.brief, args.mode),
    logline: args.brief.trim().slice(0, 220),
    runtimeSec,
    look: args.look,
    pacing: args.pacing,
    shots,
    arrangement,
    windows,
  };
}

export function shotListText(p: Production) {
  const head = [
    p.title,
    p.logline,
    "",
    `${p.mode === "film" ? "Short film" : "Music video"} · ${timecode(p.runtimeSec)} · ${p.shots.length} shots · ${p.windows.length} windows`,
    p.arrangement
      ? `${p.arrangement.bpm} BPM — cuts land on the beat`
      : `${p.pacing} pacing`,
    "",
  ];
  const rows = p.shots.map(
    (s) =>
      `${s.timecode.padStart(6)}  ${String(s.index + 1).padStart(3)}. ${s.section.padEnd(18)} ${s.size.padEnd(13)} ${s.move.padEnd(14)} ${s.action}`,
  );
  return [...head, ...rows].join("\n");
}
