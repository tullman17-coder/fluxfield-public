/**
 * One sentence in, the fields ACE / Qwen / WAN actually eat.
 * Keyword map, not an extra LLM. Unknown names stay in the ACE prompt verbatim.
 */

export type DirectorBrief = {
  genre: string;
  look: string;
  mood: string;
  topic: string;
  acePrompt: string;
  visualPrompt: string;
};

const GENRE_NAMES: [RegExp, string][] = [
  [/slipknot|metallica|korn|deftones|nu[- ]?metal|heavy metal|\bmetal\b|\bpunk\b/i, "metal"],
  [/biggie|notorious| rap\b|rapper|hip[- ]?hop|kendrick|drake|nicki|travis/i, "hiphop"],
  [/\br&b\b|rnb|sza|usher|mary j/i, "rnb"],
  [/\bpop\b|taylor swift|ariana|olivia/i, "pop"],
  [/\bcountry\b|morgan wallen|nashville/i, "country"],
  [/\brock\b|foo fighters|nirvana/i, "rock"],
  [/\bdrill\b/i, "drill"],
  [/\bhouse\b|edm|techno|trance/i, "house"],
  [/lo-?fi|lofi/i, "lofi"],
];

const LOOK_NAMES: [RegExp, string][] = [
  [/concert|stage|festival|crowd|mosh/i, "concert"],
  [/club|strobe|rave/i, "club"],
  [/car |night drive|highway/i, "car"],
  [/bedroom|apartment|mirror/i, "bedroom"],
  [/tiktok|phone|selfie|vertical/i, "phone"],
  [/animated|cartoon|anime/i, "animated"],
  [/street|block|corner|hood|nyc/i, "street"],
];

function genreFromBlob(blob: string): string | undefined {
  for (const [re, id] of GENRE_NAMES) if (re.test(blob)) return id;
  return undefined;
}

export function interpretDirectorBrief(raw: string): DirectorBrief {
  const text = raw.trim();
  const beat = text.match(
    /(?:beat|genre|instrumental|drums?)\s+(?:and genre\s+)?(?:as|of|like)\s+([^,.]+)/i,
  );
  const genre =
    (beat && genreFromBlob(beat[1])) ||
    genreFromBlob(text) ||
    "hiphop";
  const look = LOOK_NAMES.find(([re]) => re.test(text))?.[1] || "street";
  const about = text.match(/\b(?:song |video )?about\s+(.+?)(?:\.|$)/i);
  const topic = (about?.[1] || text).trim();
  const mood = /call(?:ing)? out|angry|rage|dark/i.test(text)
    ? "dark"
    : /friday|party|club/i.test(text)
      ? "driving"
      : "neutral";
  const acePrompt = [
    text,
    genre === "metal" ? "nu-metal drums, downtuned guitars, aggressive kit" : "",
    genre === "hiphop" ? "808 trap drums, dry vocal, punchy mix" : "",
  ]
    .filter(Boolean)
    .join(". ");
  const visualPrompt = [
    topic,
    look === "concert" ? "live concert, stage lights, performer" : "",
    look === "street" ? "street music video, night, handheld" : "",
  ]
    .filter(Boolean)
    .join(", ");
  return { genre, look, mood, topic, acePrompt, visualPrompt };
}
