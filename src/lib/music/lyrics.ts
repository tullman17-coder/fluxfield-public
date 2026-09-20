import type { Arrangement, SectionName } from "@/lib/music/theory";
import { timecode } from "@/lib/music/theory";

export type LyricLine = {
  /** Seconds into the track where the line lands. */
  at: number;
  text: string;
};

export type LyricSection = {
  name: SectionName;
  startSec: number;
  endSec: number;
  lines: LyricLine[];
};

export type LyricSheet = {
  title: string;
  sections: LyricSection[];
  /** True when a model wrote the words rather than the built-in writer. */
  fromModel: boolean;
};

/** Sections that carry words. The rest are played, not sung. */
const SUNG: SectionName[] = ["Verse", "Pre", "Chorus", "Bridge"];

/** Roughly how many lines fit a section, by how much room it has. */
function lineCount(name: SectionName, seconds: number) {
  const perLine = name === "Chorus" ? 3.4 : 4.2;
  const room = Math.floor(seconds / perLine);
  return Math.max(2, Math.min(name === "Chorus" ? 4 : 6, room));
}

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

function seedFrom(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const STOP = new Set([
  "the", "and", "with", "that", "this", "from", "into", "about", "song",
  "track", "music", "make", "want", "write", "something", "sounds", "like",
  "feel", "feels", "vibe", "for", "a", "an", "of", "to", "it", "is",
]);

/**
 * Words that describe rather than name. "Let the late run" is nonsense; these
 * only earn a place in a line when they are attached to a noun.
 */
const MODIFIERS = new Set([
  "late", "long", "empty", "slow", "fast", "warm", "cold", "dark", "bright",
  "quiet", "loud", "soft", "hard", "deep", "high", "low", "old", "young",
  "new", "big", "small", "heavy", "light", "sweet", "bitter", "wide",
  "narrow", "clean", "dirty", "after", "before", "over", "under", "every",
  "final", "first", "last", "next", "half", "full", "open", "closed",
  "broken", "unhurried", "hurried", "gentle", "sharp", "distant", "close",
]);

/** Grab an adjective and the noun it belongs to, so the pair reads as one image. */
function pairsFrom(words: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    if (!MODIFIERS.has(words[i])) continue;
    const noun = words[i + 1];
    if (noun.length < 3 || MODIFIERS.has(noun) || STOP.has(noun)) continue;
    const pair = `${words[i]} ${noun}`;
    if (!out.includes(pair)) out.push(pair);
  }
  return out;
}

function imagesFrom(brief: string): string[] {
  const words = brief
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const pairs = pairsFrom(words);
  const nouns: string[] = [];
  for (const w of words) {
    if (w.length <= 3 || STOP.has(w) || MODIFIERS.has(w)) continue;
    if (pairs.some((p) => p.endsWith(` ${w}`))) continue;
    if (!nouns.includes(w)) nouns.push(w);
  }
  const merged = [...nouns, ...pairs].slice(0, 10);
  return merged.length ? merged : ["night"];
}

/**
 * Line shapes rather than fixed lines, so two tracks on the same brief do not
 * come out word for word identical.
 */
const SHAPES: Record<"open" | "build" | "hook" | "turn", string[]> = {
  open: [
    "%a in the %b, nothing moving yet",
    "I keep the %a where the %b used to be",
    "Slow light on the %a, slow light on me",
    "Nobody told the %a we were leaving",
    "Counting the %b until the %a comes back",
    "Half a %a, half a reason to stay",
  ],
  build: [
    "And the %a keeps asking what the %b already knows",
    "Every %b I swore I'd let it go",
    "Hold the %a a little longer than I should",
    "Something in the %b turning over",
    "I can feel the %a getting closer",
    "One more %b before the floor gives out",
  ],
  hook: [
    "So let the %a burn, let the %b run",
    "We were never the %a, only ever the %b",
    "Take the %a, I don't need it anymore",
    "Hold on — the %a is not done with us",
    "All of it %a, all of it ours",
    "Say it like the %a means something",
  ],
  turn: [
    "Strip it back down to the %a",
    "There is a %b under all this noise",
    "What if the %a was the whole point",
    "Quiet now — the %b is listening",
  ],
};

function shapeFor(name: SectionName): keyof typeof SHAPES {
  if (name === "Chorus") return "hook";
  if (name === "Pre") return "build";
  if (name === "Bridge") return "turn";
  return "open";
}

function fill(shape: string, a: string, b: string) {
  const line = shape.replaceAll("%a", a).replaceAll("%b", b);
  return line[0].toUpperCase() + line.slice(1);
}

/** Words written here, with no model and no network. */
export function writeLyrics(args: {
  brief: string;
  title: string;
  arrangement: Arrangement;
  seedText: string;
}): LyricSheet {
  const rand = rng(seedFrom(args.seedText));
  const images = imagesFrom(args.brief);
  const sections: LyricSection[] = [];

  // The hook repeats — that is what makes it a hook.
  let hook: LyricLine[] | null = null;
  let cursor = 0;

  for (const section of args.arrangement.sections) {
    if (!SUNG.includes(section.name)) {
      sections.push({
        name: section.name,
        startSec: section.startSec,
        endSec: section.endSec,
        lines: [],
      });
      continue;
    }

    const seconds = section.endSec - section.startSec;
    const count = lineCount(section.name, seconds);
    const step = seconds / count;

    if (section.name === "Chorus" && hook) {
      sections.push({
        name: section.name,
        startSec: section.startSec,
        endSec: section.endSec,
        lines: hook.map((l, i) => ({
          at: section.startSec + i * step,
          text: l.text,
        })),
      });
      continue;
    }

    const bank = SHAPES[shapeFor(section.name)];
    const lines: LyricLine[] = [];
    // No shape twice in the same block — repeats inside one verse read as a bug.
    const pool = [...bank].sort(() => rand() - 0.5);
    for (let i = 0; i < count; i++) {
      const n = images.length;
      const a = images[cursor % n];
      const b = n > 1 ? images[(cursor + 1 + (cursor % (n - 1))) % n] : a;
      cursor++;
      lines.push({
        at: section.startSec + i * step,
        text: fill(pool[i % pool.length], a, b),
      });
    }
    if (section.name === "Chorus") hook = lines;
    sections.push({
      name: section.name,
      startSec: section.startSec,
      endSec: section.endSec,
      lines,
    });
  }

  return { title: args.title, sections, fromModel: false };
}

/**
 * Fit words the writer supplied onto the section map. Blank lines separate
 * blocks; each block goes to the next section that takes words.
 */
export function placeLyrics(args: {
  text: string;
  title: string;
  arrangement: Arrangement;
}): LyricSheet {
  const blocks = args.text
    .split(/\n\s*\n/)
    .map((b) => b.split("\n").map((l) => l.trim()).filter(Boolean))
    .filter((b) => b.length);

  const sections: LyricSection[] = [];
  let next = 0;
  for (const section of args.arrangement.sections) {
    const takesWords = SUNG.includes(section.name);
    const block = takesWords ? blocks[next] : undefined;
    if (takesWords && block) next++;
    const seconds = section.endSec - section.startSec;
    const step = block?.length ? seconds / block.length : 0;
    sections.push({
      name: section.name,
      startSec: section.startSec,
      endSec: section.endSec,
      lines: (block ?? []).map((text, i) => ({
        at: section.startSec + i * step,
        text,
      })),
    });
  }

  // More blocks than places to sing them: share the rest out over the parts
  // that take words instead of dropping them or piling them on the outro.
  const leftover = blocks.slice(next);
  const sung = sections.filter((s) => SUNG.includes(s.name));
  const home = sung.length ? sung : sections;
  leftover.forEach((block, i) => {
    const target = home[i % home.length];
    if (!target) return;
    target.lines.push(...block.map((text) => ({ at: target.startSec, text })));
    const step = (target.endSec - target.startSec) / target.lines.length;
    target.lines = target.lines.map((line, n) => ({
      ...line,
      at: target.startSec + n * step,
    }));
  });

  return { title: args.title, sections, fromModel: false };
}

/** Parse a model's answer, which arrives as [Section] headers and lines. */
export function parseLyricResponse(
  raw: string,
  title: string,
  arrangement: Arrangement,
): LyricSheet | null {
  const cleaned = raw.replace(/```[a-z]*|```/g, "").trim();
  if (!cleaned) return null;
  const hasHeaders = /^\s*\[[^\]]+\]/m.test(cleaned);
  if (!hasHeaders) {
    const sheet = placeLyrics({ text: cleaned, title, arrangement });
    return { ...sheet, fromModel: true };
  }

  const byName = new Map<string, string[]>();
  let current = "";
  for (const line of cleaned.split("\n")) {
    const header = /^\s*\[([^\]]+)\]\s*$/.exec(line);
    if (header) {
      current = header[1].trim().toLowerCase();
      if (!byName.has(current)) byName.set(current, []);
      continue;
    }
    const text = line.trim();
    if (!text || !current) continue;
    byName.get(current)!.push(text);
  }
  if (!byName.size) return null;

  // Sections repeat, so track how many times each name has been used.
  const used = new Map<string, number>();
  const sections: LyricSection[] = arrangement.sections.map((section) => {
    const key = section.name.toLowerCase();
    const pool = byName.get(key) ?? [];
    const seconds = section.endSec - section.startSec;
    if (!pool.length || !SUNG.includes(section.name)) {
      return {
        name: section.name,
        startSec: section.startSec,
        endSec: section.endSec,
        lines: [],
      };
    }
    // A repeated chorus reuses its words; verses walk forward through theirs.
    const count = Math.min(pool.length, lineCount(section.name, seconds));
    const offset =
      section.name === "Chorus" ? 0 : ((used.get(key) ?? 0) * count) % pool.length;
    used.set(key, (used.get(key) ?? 0) + 1);
    const picked = Array.from(
      { length: count },
      (_, i) => pool[(offset + i) % pool.length],
    );
    const step = seconds / count;
    return {
      name: section.name,
      startSec: section.startSec,
      endSec: section.endSec,
      lines: picked.map((text, i) => ({
        at: section.startSec + i * step,
        text,
      })),
    };
  });

  return { title, sections, fromModel: true };
}

export function lyricSheetText(sheet: LyricSheet) {
  const out: string[] = [sheet.title, ""];
  for (const section of sheet.sections) {
    out.push(`[${section.name}]  ${timecode(section.startSec)}`);
    if (!section.lines.length) out.push("  (instrumental)");
    else {
      for (const line of section.lines) {
        out.push(`  ${timecode(line.at).padStart(5)}  ${line.text}`);
      }
    }
    out.push("");
  }
  return out.join("\n").trimEnd();
}

/** Plain words with no timecodes, for handing to a singing model. */
export function lyricPlainText(sheet: LyricSheet) {
  const out: string[] = [];
  for (const section of sheet.sections) {
    if (!section.lines.length) continue;
    out.push(`[${section.name.toLowerCase()}]`);
    for (const line of section.lines) out.push(line.text);
    out.push("");
  }
  return out.join("\n").trim();
}

export type LyricCue = { at: number; until: number; text: string };

export function timedLyricCues(sheet: LyricSheet): LyricCue[] {
  const lines = sheet.sections.flatMap((s) => s.lines).filter((l) => l.text.trim());
  const end = sheet.sections.at(-1)?.endSec;
  return lines.map((l, i) => ({
    at: l.at,
    until: i + 1 < lines.length ? lines[i + 1]!.at : Math.max(l.at + 3, end ?? l.at + 3),
    text: l.text.trim(),
  }));
}

export function lyricCueAt(cues: LyricCue[], t: number) {
  let text = "";
  for (const c of cues) if (t + 1e-6 >= c.at) text = c.text;
  return text;
}

export function wanLyricPrompt(cues: LyricCue[], t: number) {
  const line = lyricCueAt(cues, t);
  if (!line) return "closed mouth, instrumental, no singing";
  return `on-camera vocalist singing these exact words, mouth and jaw moving in time: "${line}"`;
}

function srtStamp(sec: number) {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  const whole = Math.floor(rest);
  const ms = Math.min(999, Math.round((rest - whole) * 1000));
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(whole).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

export function lyricSheetToSrt(sheet: LyricSheet) {
  return timedLyricCues(sheet)
    .map((c, i) => `${i + 1}\n${srtStamp(c.at)} --> ${srtStamp(c.until)}\n${c.text}\n`)
    .join("\n");
}
