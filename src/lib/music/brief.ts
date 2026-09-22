/**
 * ACE-Step tags are comma style tokens. A prose brief (artist names, plot)
 * in `tags` is ignored. Split style-of → tags, story → lyrics.
 * Not a voice clone — ACE has no artist embedding.
 */

export type MusicBrief = {
  tags: string;
  topic: string;
  genre: string;
  cadence: string;
};

const HIPHOP =
  "hip hop, rap, male vocal, 808, trap drums, dry vocal, punchy mix, modern radio";

const STYLES: [RegExp, { tags: string; genre: string; cadence: string }][] = [
  [
    /eminem|slim shady|marshall mathers/i,
    {
      tags: `${HIPHOP}, detroit, rapid-fire rap, nasal male rap, storytelling, internal rhyme`,
      genre: "hiphop",
      cadence: "aggressive Detroit rap cadence, stacked internal rhymes, first person, punchlines",
    },
  ],
  [
    /kendrick/i,
    {
      tags: `${HIPHOP}, west coast, dense rhyme, jazz rap`,
      genre: "hiphop",
      cadence: "dense multi-syllable rap, switching flows, first person",
    },
  ],
  [
    /biggie|notorious b\.?i\.?g/i,
    {
      tags: `${HIPHOP}, east coast, laid-back rap, 90s`,
      genre: "hiphop",
      cadence: "laid-back east-coast flow, storytelling, first person",
    },
  ],
  [
    /drake/i,
    {
      tags: "hip hop, rap, r&b, male vocal, melodic rap, atmospheric",
      genre: "rnb",
      cadence: "melodic rap-sung hybrid, conversational, first person",
    },
  ],
];

const GENRE_TAGS: Record<string, string> = {
  hiphop: HIPHOP,
  trap: "trap, hip hop, rap, male vocal, 808, rolling hats, dry mix, dark",
  drill: "UK drill, sliding 808, rap, male vocal, dark, syncopated hats",
  metal: "metal, aggressive male vocal, distorted guitar, double kick",
  pop: "pop, male vocal, catchy hook, punchy 808, 2020s radio",
  rnb: "r&b, male vocal, 808, atmospheric, stacked vocals",
  house: "tech house, four on the floor, punchy kick, vocal chop",
  lofi: "lo-fi, chill, dusty keys, soft drums",
};

function genreFrom(text: string): string {
  if (/trap\b/i.test(text)) return "trap";
  if (/\bdrill\b/i.test(text)) return "drill";
  if (/metal|rock\b/i.test(text)) return "metal";
  if (/\br&?b\b/i.test(text)) return "rnb";
  if (/\bpop\b/i.test(text)) return "pop";
  if (/house|edm/i.test(text)) return "house";
  if (/lo-?fi/i.test(text)) return "lofi";
  if (/rap|hip-?hop|rapper/i.test(text)) return "hiphop";
  return "hiphop";
}

export function interpretMusicBrief(raw: string): MusicBrief {
  const text = raw.trim();
  const style = text.match(
    /(?:rap\s+)?style\s+of\s+(.+?)(?:\s+the\s+artist)?(?=\s+about\b|\s*[.:,]|$)/i,
  ) || text.match(/\b(?:like|as)\s+([^,.]+?)(?:\s+the\s+artist)?(?=\s+about\b|$)/i);
  const about = text.match(/\babout\s+(.+)$/i);
  const topic = (about?.[1] || text.replace(style?.[0] || "", "")).replace(/\s+/g, " ").trim() || text;
  const blob = style?.[1] || text;
  const named = STYLES.find(([re]) => re.test(blob) || re.test(text));
  const genre = named?.[1].genre || genreFrom(text);
  const tags = named?.[1].tags || GENRE_TAGS[genre] || HIPHOP;
  const cadence =
    named?.[1].cadence ||
    (genre === "hiphop" || genre === "trap" || genre === "drill"
      ? "rap cadence, first person, concrete images"
      : "sung vocal, first person");
  return { tags, topic, genre, cadence };
}

/** Chip wins over brief-guess. Auto/empty keeps the parser. */
export function applyMusicChip(chip: string | undefined, parsed: MusicBrief): MusicBrief {
  const id = chip?.trim();
  if (!id || id === "auto") return parsed;
  return { ...parsed, genre: id, tags: GENRE_TAGS[id] || parsed.tags };
}
