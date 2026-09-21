/**
 * Arrangement planning. Kept separate from synthesis because Director reuses
 * the section map to align shots to downbeats.
 */

export const NOTE_NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
] as const;

export const SCALES: Record<string, number[]> = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
};

export type SectionName =
  | "Intro"
  | "Verse"
  | "Pre"
  | "Chorus"
  | "Bridge"
  | "Break"
  | "Outro";

export type Section = {
  id: string;
  name: SectionName;
  index: number;
  bars: number;
  startSec: number;
  endSec: number;
  /** 0..1 — drives instrument density here and shot pacing in Director. */
  energy: number;
};

export type Arrangement = {
  bpm: number;
  /** Root pitch class, 0 = C. */
  root: number;
  scale: string;
  beatsPerBar: number;
  sections: Section[];
  /** Chord per bar, as scale degrees. */
  chordPlan: number[];
  durationSec: number;
  genre: string;
};

export type Genre = {
  id: string;
  label: string;
  blurb: string;
  bpm: [number, number];
  scale: string;
  progression: number[];
  /** Instrument weights 0..1. */
  drums: number;
  bass: number;
  pad: number;
  lead: number;
  arp: number;
  swing: number;
  accent: string;
};

export const GENRES: Genre[] = [
  { id: "lofi", label: "Lo-fi", blurb: "Dusty keys, soft kit, late-night calm.", bpm: [72, 88], scale: "dorian", progression: [0, 5, 3, 4], drums: 0.6, bass: 0.7, pad: 0.9, lead: 0.4, arp: 0.2, swing: 0.18, accent: "#c58bff" },
  { id: "synthwave", label: "Synthwave", blurb: "Neon arps, gated drums, wide chorus.", bpm: [96, 112], scale: "minor", progression: [0, 5, 2, 4], drums: 0.85, bass: 0.9, pad: 0.8, lead: 0.7, arp: 0.9, swing: 0, accent: "#ff5fc8" },
  { id: "cinematic", label: "Cinematic", blurb: "Slow swells, low strings, wide air.", bpm: [60, 76], scale: "harmonicMinor", progression: [0, 3, 4, 0], drums: 0.25, bass: 0.6, pad: 1.0, lead: 0.5, arp: 0.1, swing: 0, accent: "#7fb2ff" },
  { id: "trap", label: "Trap", blurb: "Sparse keys, rolling hats, deep sub.", bpm: [130, 150], scale: "phrygian", progression: [0, 0, 5, 4], drums: 0.95, bass: 1.0, pad: 0.5, lead: 0.45, arp: 0.15, swing: 0, accent: "#ff8a3d" },
  { id: "house", label: "House", blurb: "Four-on-the-floor, warm stabs, drive.", bpm: [120, 128], scale: "minor", progression: [0, 3, 4, 5], drums: 0.9, bass: 0.85, pad: 0.7, lead: 0.6, arp: 0.5, swing: 0.06, accent: "#59e0c5" },
  { id: "ambient", label: "Ambient", blurb: "No pulse, long tails, drifting air.", bpm: [56, 68], scale: "major", progression: [0, 4, 5, 3], drums: 0.0, bass: 0.4, pad: 1.0, lead: 0.35, arp: 0.1, swing: 0, accent: "#9ad6ff" },
  { id: "drill", label: "Drill", blurb: "Sliding bass, skittering hats, dark keys.", bpm: [138, 146], scale: "phrygian", progression: [0, 1, 5, 4], drums: 0.9, bass: 1.0, pad: 0.45, lead: 0.5, arp: 0.2, swing: 0, accent: "#ff4d6d" },
  { id: "orchestral", label: "Orchestral", blurb: "Rising strings, timpani, big finish.", bpm: [84, 100], scale: "minor", progression: [0, 5, 3, 4], drums: 0.4, bass: 0.7, pad: 1.0, lead: 0.65, arp: 0.3, swing: 0, accent: "#ffd479" },
  { id: "hiphop", label: "Hip-hop", blurb: "Rap vocal, boom-bap or trap kit.", bpm: [82, 96], scale: "minor", progression: [0, 5, 3, 4], drums: 0.9, bass: 0.95, pad: 0.45, lead: 0.4, arp: 0.1, swing: 0.08, accent: "#ff8a3d" },
  { id: "metal", label: "Metal", blurb: "Downtuned guitars, double-kick, shout.", bpm: [95, 140], scale: "phrygian", progression: [0, 1, 5, 4], drums: 1.0, bass: 0.95, pad: 0.3, lead: 0.7, arp: 0.05, swing: 0, accent: "#c0c0c0" },
  { id: "pop", label: "Pop", blurb: "Hook-first, bright chorus.", bpm: [100, 120], scale: "major", progression: [0, 4, 5, 3], drums: 0.8, bass: 0.75, pad: 0.7, lead: 0.7, arp: 0.4, swing: 0, accent: "#ff5fc8" },
  { id: "rnb", label: "R&B", blurb: "Warm keys, stacked vocals.", bpm: [70, 90], scale: "dorian", progression: [0, 5, 3, 4], drums: 0.7, bass: 0.8, pad: 0.8, lead: 0.55, arp: 0.2, swing: 0.12, accent: "#c58bff" },
  { id: "rock", label: "Rock", blurb: "Live kit, guitar, chorus shout.", bpm: [110, 140], scale: "minor", progression: [0, 5, 3, 4], drums: 0.9, bass: 0.85, pad: 0.4, lead: 0.75, arp: 0.1, swing: 0, accent: "#ff4d6d" },
  { id: "country", label: "Country", blurb: "Story vocal, acoustic drive.", bpm: [88, 120], scale: "major", progression: [0, 4, 5, 3], drums: 0.7, bass: 0.7, pad: 0.5, lead: 0.6, arp: 0.15, swing: 0.05, accent: "#ffd479" },
];

const GENRE_ALIASES: Record<string, string> = {
  auto: "hiphop",
  "hip-hop": "hiphop",
  rap: "hiphop",
  "r&b": "rnb",
  "nu-metal": "metal",
  "heavy-metal": "metal",
};

export function getGenre(id: string): Genre {
  const mapped = GENRE_ALIASES[id] || id;
  return (
    GENRES.find((g) => g.id === mapped) ??
    GENRES.find((g) => g.id === "hiphop") ??
    GENRES[0]
  );
}

export const DIRECTOR_GENRES = [
  { id: "auto", label: "From prompt" },
  { id: "hiphop", label: "Hip-hop" },
  { id: "metal", label: "Metal" },
  { id: "pop", label: "Pop" },
  { id: "rnb", label: "R&B" },
  { id: "rock", label: "Rock" },
  { id: "country", label: "Country" },
  { id: "drill", label: "Drill" },
  { id: "house", label: "House / EDM" },
];

export const MOODS: Record<string, { scale?: string; energy: number; bpmShift: number }> = {
  calm: { scale: "major", energy: -0.2, bpmShift: -8 },
  warm: { energy: -0.05, bpmShift: -2 },
  neutral: { energy: 0, bpmShift: 0 },
  driving: { energy: 0.18, bpmShift: 6 },
  dark: { scale: "phrygian", energy: 0.1, bpmShift: 2 },
  euphoric: { scale: "major", energy: 0.28, bpmShift: 8 },
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function seedFromText(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Fills a bar budget rather than a fixed list, so the piece actually lands on
 * the requested length at any tempo.
 */
function sectionPlan(barBudget: number, hasDrums: boolean): SectionName[] {
  const intro: SectionName = "Intro";
  const outro: SectionName = "Outro";
  const reserved = SECTION_BARS[intro] + SECTION_BARS[outro];
  let remaining = Math.max(0, barBudget - reserved);

  const cycle: SectionName[] = hasDrums
    ? ["Verse", "Pre", "Chorus", "Break"]
    : ["Verse", "Bridge", "Chorus"];

  const middle: SectionName[] = [];
  let i = 0;
  // Long-form pieces need hundreds of sections, so the ceiling is a guard
  // against a runaway loop rather than a musical limit.
  while (remaining >= 4 && middle.length < 512) {
    const next = cycle[i % cycle.length];
    if (SECTION_BARS[next] > remaining) {
      // Not enough room for the next block; a Chorus close beats padding.
      if (remaining >= 4) middle.push(remaining >= 8 ? "Chorus" : "Break");
      break;
    }
    middle.push(next);
    remaining -= SECTION_BARS[next];
    i++;
  }
  if (!middle.length) middle.push("Chorus");
  // Land on the hook before the outro.
  if (middle[middle.length - 1] !== "Chorus" && middle.length > 1) {
    middle[middle.length - 1] = "Chorus";
  }
  return [intro, ...middle, outro];
}

const SECTION_BARS: Record<SectionName, number> = {
  Intro: 4,
  Verse: 8,
  Pre: 4,
  Chorus: 8,
  Bridge: 8,
  Break: 4,
  Outro: 4,
};

const SECTION_ENERGY: Record<SectionName, number> = {
  Intro: 0.25,
  Verse: 0.5,
  Pre: 0.65,
  Chorus: 1.0,
  Bridge: 0.55,
  Break: 0.3,
  Outro: 0.2,
};

export function planArrangement(args: {
  genre: string;
  mood?: string;
  targetSec: number;
  key?: string;
  bpm?: number;
  seedText: string;
}): Arrangement {
  const genre = getGenre(args.genre);
  const mood = MOODS[args.mood || "neutral"] ?? MOODS.neutral;
  const rand = rng(seedFromText(args.seedText));

  const bpm =
    args.bpm && args.bpm > 30
      ? args.bpm
      : Math.round(
          genre.bpm[0] + rand() * (genre.bpm[1] - genre.bpm[0]) + mood.bpmShift,
        );

  const root =
    args.key && NOTE_NAMES.includes(args.key as (typeof NOTE_NAMES)[number])
      ? NOTE_NAMES.indexOf(args.key as (typeof NOTE_NAMES)[number])
      : Math.floor(rand() * 12);

  const scale = mood.scale && rand() > 0.45 ? mood.scale : genre.scale;
  const beatsPerBar = 4;
  const secPerBar = (60 / bpm) * beatsPerBar;

  const barBudget = Math.max(8, Math.round(args.targetSec / secPerBar));
  const names = sectionPlan(barBudget, genre.drums > 0.2);
  const sections: Section[] = [];
  let t = 0;
  let i = 0;
  for (const name of names) {
    const bars = SECTION_BARS[name];
    const dur = bars * secPerBar;
    sections.push({
      id: `s${i}`,
      name,
      index: i,
      bars,
      startSec: t,
      endSec: t + dur,
      energy: Math.min(
        1,
        Math.max(0.1, SECTION_ENERGY[name] + mood.energy * 0.5),
      ),
    });
    t += dur;
    i++;
  }

  const totalBars = sections.reduce((n, s) => n + s.bars, 0);
  const chordPlan: number[] = [];
  for (let b = 0; b < totalBars; b++) {
    chordPlan.push(genre.progression[b % genre.progression.length]);
  }

  return {
    bpm,
    root,
    scale,
    beatsPerBar,
    sections,
    chordPlan,
    durationSec: t,
    genre: genre.id,
  };
}

export function keyLabel(a: Arrangement) {
  const quality = a.scale === "major" ? "major" : "minor";
  return `${NOTE_NAMES[a.root]} ${quality}`;
}

export function timecode(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** MIDI note for a scale degree, octave-aware. */
export function degreeToMidi(
  a: Arrangement,
  degree: number,
  octave: number,
): number {
  const steps = SCALES[a.scale] ?? SCALES.minor;
  const oct = Math.floor(degree / steps.length);
  const idx = ((degree % steps.length) + steps.length) % steps.length;
  return 12 * (octave + oct) + a.root + steps[idx];
}

export function midiToFreq(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Triad (plus seventh) built on a scale degree. */
export function chordNotes(a: Arrangement, degree: number, octave: number) {
  return [0, 2, 4, 6].map((step) => degreeToMidi(a, degree + step, octave));
}
