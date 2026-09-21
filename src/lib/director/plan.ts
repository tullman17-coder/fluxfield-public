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

export type DirectorMode = "music-video" | "tiktok";

export function normalizeDirectorMode(raw?: string): DirectorMode {
  return raw === "music-video" ? "music-video" : "tiktok";
}

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

export const TIKTOK_RUNTIMES = [
  { id: "15", label: "15s" },
  { id: "30", label: "30s" },
  { id: "60", label: "60s" },
];

export const TIKTOK_TEMPLATES = [
  {
    id: "hook-payoff",
    label: "Hook → payoff",
    blurb: "Stop the scroll, then land it.",
    beats: ["Hook", "Hold", "Turn", "Payoff"],
  },
  {
    id: "before-after",
    label: "Before / after",
    blurb: "Split the clip on the change.",
    beats: ["Before", "The work", "After", "Stinger"],
  },
  {
    id: "pov",
    label: "POV",
    blurb: "Camera is the person.",
    beats: ["Cold open", "Walk-in", "Beat", "Look to cam"],
  },
  {
    id: "list",
    label: "List",
    blurb: "Three items, one punch.",
    beats: ["Title card", "One", "Two", "Three", "CTA"],
  },
  {
    id: "greenscreen",
    label: "Green screen",
    blurb: "Talking head over the clip.",
    beats: ["Setup", "React", "Punchline"],
  },
] as const;

/** Maestro Cut Speed. Maps onto shot hold length. WAN 5B clip length stays 3s. */
export const CUT_SPEEDS = [
  { id: "-2", label: "Fewest", blurb: "Longest holds. 5B still ~3s per WAN clip." },
  { id: "-1", label: "Open", blurb: "Fewer cuts, stay in the section." },
  { id: "0", label: "Music", blurb: "Cuts on sections and phrases." },
  { id: "1", label: "Tight", blurb: "Shorter clips inside a section." },
  { id: "2", label: "Rapid", blurb: "Max cuts the 3s GPU clip allows." },
] as const;

export function pacingFromCutSpeed(raw?: string): Pacing {
  const n = Number(raw);
  if (n <= -2) return "slow";
  if (n === -1) return "steady";
  if (n >= 2) return "frantic";
  if (n === 1) return "fast";
  return "steady";
}

export const LOOKS = [
  { id: "auto", label: "From prompt", blurb: "Read the brief.", suffix: "" },
  { id: "concert", label: "Concert", blurb: "Stage, lights, crowd.", suffix: "live concert music video, stage lights, performer, crowd" },
  { id: "street", label: "Street", blurb: "Block, night, handheld.", suffix: "street music video, night, handheld, city block" },
  { id: "club", label: "Club", blurb: "Strobe, bodies, bass.", suffix: "nightclub music video, strobe, dancing" },
  { id: "bedroom", label: "Bedroom", blurb: "Close, phone-in-hand.", suffix: "bedroom music video, close, practical lamps" },
  { id: "car", label: "Car", blurb: "Night drive.", suffix: "car music video, night drive, window light" },
  { id: "phone", label: "Phone", blurb: "Vertical selfie cam.", suffix: "phone video, vertical, handheld selfie" },
  { id: "animated", label: "Animated", blurb: "Toon / motion graphic.", suffix: "animated music video, bold shapes, motion graphics" },
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
  /** Direction note, set on the shot that opens a section or act. */
  note?: string;
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

/**
 * Articles and prepositions almost always sit in front of the thing being
 * described, so the words after them are the ones worth putting on screen.
 */
const NOUN_CUES = new Set([
  "a", "an", "the", "in", "on", "at", "of", "across", "through", "into",
  "over", "under", "inside", "outside", "beside", "toward", "towards",
  "against", "around", "behind", "between", "near", "with",
]);

const CUE_STOP = new Set([
  "and", "but", "who", "she", "her", "his", "him", "its", "it", "they",
  "them", "that", "this", "very", "only", "just", "some", "same",
]);

/** Take the one or two content words after each cue as a subject phrase. */
function phrasesFrom(brief: string): string[] {
  const words = brief
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    if (!NOUN_CUES.has(words[i])) continue;
    const parts: string[] = [];
    for (let j = i + 1; j < Math.min(words.length, i + 3); j++) {
      const w = words[j];
      if (w.length < 3 || CUE_STOP.has(w) || NOUN_CUES.has(w)) break;
      parts.push(w);
    }
    if (!parts.length) continue;
    const phrase = parts.join(" ");
    if (!out.includes(phrase)) out.push(phrase);
  }
  return out;
}

/** Pull recurring nouns out of the brief so shots stay about the same subject. */
function looseSubjectsFrom(brief: string): string[] {
  const stop = new Set([
    "the", "and", "with", "that", "this", "from", "into", "onto", "over",
    "then", "they", "them", "their", "there", "here", "about", "while",
    "where", "when", "which", "what", "your", "mine", "ours", "been", "have",
    "has", "had", "does", "done", "goes", "gone", "works", "working", "makes",
    "made", "take", "takes", "taken", "come", "comes", "keep", "keeps",
    "through", "until", "after", "before", "during", "between", "against",
    "video", "film", "music", "shot", "shots", "scene", "scenes", "clip",
    "make", "want", "wants", "something", "anything", "really", "very",
    "just", "like", "much", "more", "most", "some", "only", "also", "still",
    "finished", "final", "ending", "starts", "start", "ends",
  ]);
  const words = brief
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stop.has(w) && !w.endsWith("ly"));
  const seen: string[] = [];
  for (const w of words) if (!seen.includes(w)) seen.push(w);
  return seen;
}

function subjectsFrom(brief: string): string[] {
  const phrases = phrasesFrom(brief);
  if (phrases.length >= 3) return phrases.slice(0, 8);
  const loose = looseSubjectsFrom(brief).filter(
    (w) => !phrases.some((p) => p.includes(w)),
  );
  const merged = [...phrases, ...loose].slice(0, 8);
  return merged.length ? merged : ["the subject"];
}

/**
 * Shot descriptions by energy band. Repeating one sentence across forty shots
 * reads like a template, so each band carries several phrasings.
 */
const ACTIONS = {
  calm: [
    "%s held still, %o soft behind it",
    "%s barely moving, light falling across %o",
    "%s at rest, %o drifting at the edge of frame",
    "quiet on %s, %o just out of focus",
    "%s alone in the frame, %o implied off-screen",
  ],
  build: [
    "%s moving through the space, %o passing behind",
    "%s turning into the light, %o catching the edge",
    "%s crossing frame, %o holding the far side",
    "%s in motion, %o sliding past",
    "the camera finds %s, %o opening up around it",
  ],
  peak: [
    "%s at full tilt, %o breaking the frame",
    "%s driving hard, %o smearing past",
    "%s slammed against %o",
    "%s filling the frame, %o torn away behind",
    "everything on %s, %o gone to blur",
  ],
} as const;

function actionFor(energy: number, subject: string, other: string, pick: number) {
  const band = energy > 0.78 ? ACTIONS.peak : energy > 0.48 ? ACTIONS.build : ACTIONS.calm;
  return band[pick % band.length].replace("%s", subject).replace("%o", other);
}

function titleFrom(brief: string, mode: DirectorMode) {
  const subs = subjectsFrom(brief);
  const pick = subs.join(" ").split(" ").slice(0, 3).join(" ");
  const title = pick.replace(/\b\w/g, (c) => c.toUpperCase());
  return title || (mode === "tiktok" ? "Untitled TikTok" : "Untitled Video");
}

/** One line of intent at the top of every section, so the list reads as a plan. */
function sectionNote(section: string, energy: number) {
  if (section.startsWith("Act")) {
    return energy > 0.8
      ? "Everything pays off here — hold nothing back."
      : energy > 0.55
        ? "Raise the pressure. Cut sooner than feels comfortable."
        : "Establish the world before anything happens to it.";
  }
  switch (section) {
    case "Intro":
      return "Set the place. Let the first image sit longer than the rest.";
    case "Verse":
      return "Carry the story. Keep the camera patient.";
    case "Pre":
      return "Tighten. Every cut should feel closer than the last.";
    case "Chorus":
      return "The hook. Widest range of framing, hardest cuts.";
    case "Break":
      return "Pull the floor out. One held image, almost nothing moving.";
    case "Bridge":
      return "Change the light. This should not look like the rest.";
    case "Outro":
      return "Let it go. Open the frame back up and leave.";
    default:
      return "Keep it on the subject.";
  }
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
  template?: string;
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
    const n = subjects.length;
    const subject = subjects[i % n];
    // Offset never lands back on the subject, however few subjects there are.
    const other = n > 1 ? subjects[(i + 1 + (i % (n - 1))) % n] : subject;
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
      action: actionFor(energy, subject, other, i + Math.floor(rand() * 3)),
      note:
        shots.length === 0 || shots[shots.length - 1].section !== section
          ? sectionNote(section, energy)
          : undefined,
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
    const template =
      TIKTOK_TEMPLATES.find((t) => t.id === args.template) ?? TIKTOK_TEMPLATES[0];
    const beats = template.beats;
    const perBeat = runtimeSec / beats.length;
    for (let a = 0; a < beats.length; a++) {
      const actStart = a * perBeat;
      const actEnd = actStart + perBeat;
      const energy = Math.min(1, 0.45 + (a / Math.max(1, beats.length - 1)) * 0.5);
      let t = actStart;
      while (t < actEnd - 0.01) {
        const hold = Math.max(
          0.8,
          pace.base + (rand() - 0.5) * 2 * pace.spread - energy * 1.2,
        );
        const end = Math.min(actEnd, t + hold);
        pushShot(t, end, beats[a], energy);
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
    `${p.mode === "tiktok" ? "TikTok" : "Music video"} · ${timecode(p.runtimeSec)} · ${p.shots.length} shots · ${p.windows.length} windows`,
    p.arrangement
      ? `${p.arrangement.bpm} BPM — cuts land on the beat`
      : `${p.pacing} pacing`,
    "",
  ];
  const rows: string[] = [];
  for (const s of p.shots) {
    if (s.note) {
      rows.push("", `— ${s.section.toUpperCase()} — ${s.note}`);
    }
    rows.push(
      `${s.timecode.padStart(6)}  ${String(s.index + 1).padStart(3)}. ${s.size.padEnd(13)} ${s.move.padEnd(14)} ${s.action}`,
    );
  }
  return [...head, ...rows].join("\n");
}
