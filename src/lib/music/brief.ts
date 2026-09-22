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

const GENRE_STYLE: Record<string, { tags: string; cadence: string }> = {
  cartoon: { tags: "cartoon score, playful, pizzicato strings, xylophone, comic brass, bouncy rhythm", cadence: "playful sung phrases, bouncy call and response" },
  hiphop: { tags: HIPHOP, cadence: "rap cadence, first person, concrete images" },
  trap: { tags: "trap, hip hop, rap, male vocal, 808, rolling hats, dry mix, dark", cadence: "half-time rap cadence, triplet pockets, tight hooks" },
  drill: { tags: "UK drill, sliding 808, rap, male vocal, dark, syncopated hats", cadence: "rap cadence, syncopated short bars, clipped delivery" },
  metal: { tags: "metal, aggressive male vocal, distorted guitar, double kick", cadence: "forceful shouted phrasing, emphatic downbeats" },
  pop: { tags: "pop, male vocal, catchy hook, punchy 808, 2020s radio", cadence: "sung melody, concise hook, clear repeated phrases" },
  rnb: { tags: "r&b, male vocal, 808, atmospheric, stacked vocals", cadence: "soulful sung phrasing, melisma, space between lines" },
  house: { tags: "tech house, four on the floor, punchy kick, vocal chop", cadence: "rhythmic sung refrain, short repeated phrases" },
  lofi: { tags: "lo-fi, chill, dusty keys, soft drums", cadence: "relaxed sung phrasing, sparse intimate lines" },
  synthwave: { tags: "synthwave, analog synth, arpeggios, gated drums, wide chorus", cadence: "sustained sung melody, spacious nostalgic hook" },
  cinematic: { tags: "cinematic, orchestral strings, slow swells, low brass, wide ambience", cadence: "spacious melodic phrasing, long dramatic lines" },
  ambient: { tags: "ambient, drifting pads, long reverb, no drums", cadence: "unhurried melodic phrases, long pauses" },
  orchestral: { tags: "orchestral, rising strings, brass, timpani, crescendo", cadence: "legato melodic phrasing, rising sustained lines" },
  rock: { tags: "rock, electric guitar, live drums, bass guitar, anthemic chorus", cadence: "sung anthem, strong downbeats, open chorus" },
  country: { tags: "country, acoustic guitar, pedal steel, live drums, storytelling vocal", cadence: "sung storytelling, conversational verses, memorable refrain" },
};

function genreFrom(text: string): string {
  // ponytail: keyword inference, not semantic genre detection; explicit chips win.
  if (/\b(?:cartoon|slapstick)\b/i.test(text)) return "cartoon";
  if (/\bsynthwave\b/i.test(text)) return "synthwave";
  if (/\bcinematic\b/i.test(text)) return "cinematic";
  if (/\bambient\b/i.test(text)) return "ambient";
  if (/\borchestral\b/i.test(text)) return "orchestral";
  if (/\bcountry\b/i.test(text)) return "country";
  if (/\bmetal\b/i.test(text)) return "metal";
  if (/\brock\b/i.test(text)) return "rock";
  if (/\btrap\b/i.test(text)) return "trap";
  if (/\bdrill\b/i.test(text)) return "drill";
  if (/\b(?:r&b|rnb)\b/i.test(text)) return "rnb";
  if (/\bpop\b/i.test(text)) return "pop";
  if (/\b(?:house|edm)\b/i.test(text)) return "house";
  if (/\blo-?fi\b/i.test(text)) return "lofi";
  return "hiphop";
}

export function interpretMusicBrief(raw: string, styleHint = ""): MusicBrief {
  const text = raw.trim();
  const style = text.match(
    /(?:rap\s+)?style\s+of\s+(.+?)(?:\s+the\s+artist)?(?=\s+about\b|\s*[.:,]|$)/i,
  ) || text.match(/\b(?:like|as)\s+([^,.]+?)(?:\s+the\s+artist)?(?=\s+about\b|$)/i);
  const about = text.match(/\babout\s+([\s\S]+)$/i);
  const preamble = about ? text.slice(0, about.index).replace(style?.[0] || "", "").trim() : "";
  // Keep literal qualifiers (including language choices), not just the plot after "about".
  const qualifier = /^(?:(?:write|make)(?: me)?\s+)?(?:a\s+)?(?:song|track|music)$/i.test(preamble) ? "" : preamble;
  const topic = [qualifier, about?.[1] || text.replace(style?.[0] || "", "").trim()].filter(Boolean).join("\n") || text;
  // A Director hint is parsed, never forwarded as prose; it cannot replace the story.
  const blob = `${style?.[1] || text.split(/\babout\b/i)[0]} ${styleHint.split(/\babout\b/i)[0]}`;
  const named = STYLES.find(([re]) => re.test(blob));
  const genre = named?.[1].genre || genreFrom(blob);
  const { tags, cadence } = named?.[1] || GENRE_STYLE[genre];
  return { tags, topic, genre, cadence };
}

/** Chip wins over brief-guess. Auto/empty keeps the parser. */
export function applyMusicChip(chip: string | undefined, parsed: MusicBrief, lyricMode?: string): MusicBrief {
  const id = chip?.trim();
  let selected = parsed;
  if (id && Object.hasOwn(GENRE_STYLE, id) && id !== parsed.genre) {
    const style = GENRE_STYLE[id];
    const rap = ["hiphop", "trap", "drill"];
    // Keep descriptive named-style detail only across compatible rap kits.
    const compatible = rap.includes(id) && (rap.includes(parsed.genre) || (parsed.genre === "rnb" && /\brap\b/.test(parsed.cadence)));
    const baseTags = GENRE_STYLE[parsed.genre]?.tags.split(", ") || [];
    const detail = compatible ? parsed.tags.split(", ").filter(tag => !baseTags.includes(tag)) : [];
    selected = {
      ...parsed,
      genre: id,
      tags: [...new Set([...style.tags.split(", "), ...detail])].join(", "),
      cadence: detail.length ? parsed.cadence : style.cadence,
    };
  }
  if (lyricMode !== "instrumental") return selected;
  const tags = selected.tags.split(", ").filter(tag => !/\b(?:rap|vocals?|sung|singing|shout|rhyme|storytelling)\b/i.test(tag));
  return { ...selected, tags: [...new Set([...tags, "instrumental"])].join(", "), cadence: "instrumental phrasing" };
}
