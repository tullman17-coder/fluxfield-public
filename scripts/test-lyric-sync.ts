import assert from "node:assert/strict";
import {
  lyricCueAt,
  lyricSheetToSrt,
  timedLyricCues,
  wanLyricPrompt,
  type LyricSheet,
} from "../src/lib/music/lyrics";
import { applyMusicChip, interpretMusicBrief } from "../src/lib/music/brief";
import { GENRES, midiToFreq, planArrangement } from "../src/lib/music/theory";

const sheet: LyricSheet = {
  title: "Looby",
  fromModel: true,
  sections: [
    {
      name: "Verse",
      startSec: 0,
      endSec: 12,
      lines: [
        { at: 0, text: "here we go looby loo" },
        { at: 6, text: "here we go looby light" },
      ],
    },
  ],
};

const cues = timedLyricCues(sheet);
assert.equal(cues.length, 2);
assert.equal(lyricCueAt(cues, 0), "here we go looby loo");
assert.equal(lyricCueAt(cues, 5.9), "here we go looby loo");
assert.equal(lyricCueAt(cues, 6), "here we go looby light");
assert.match(wanLyricPrompt(cues, 6), /looby light/);
assert.match(wanLyricPrompt([], 0), /instrumental/);
const srt = lyricSheetToSrt(sheet);
assert.match(srt, /00:00:00,000 --> 00:00:06,000/);
assert.match(srt, /here we go looby loo/);

const eminem = interpretMusicBrief(
  'Rap style of Eminem the artist about calling out of work to play Grand Theft Auto VI will launch on Thursday, November 19',
);
assert.equal(eminem.genre, "hiphop");
assert.match(eminem.tags, /detroit/);
assert.match(eminem.tags, /rapid-fire/);
assert.doesNotMatch(eminem.tags, /eminem/i);
assert.match(eminem.topic, /Grand Theft Auto/i);
assert.doesNotMatch(eminem.topic, /style of/i);
assert.equal(midiToFreq(69), 432);
assert.equal(planArrangement({ genre: "pop", bpm: 30, key: "D", targetSec: 30, seedText: "minimum-bpm" }).bpm, 30, "the API-accepted minimum BPM must not silently become auto");
assert.ok(planArrangement({ genre: "country", bpm: 96, targetSec: 30, seedText: "short" }).sections.some(s => s.name === "Chorus"), "short scores must leave a place for requested words");
const rain = interpretMusicBrief("song about rain");
assert.equal(applyMusicChip("trap", rain).genre, "trap");
assert.match(applyMusicChip("trap", rain).tags, /808/);
assert.equal(applyMusicChip("auto", rain).genre, rain.genre);

const expected: Record<string, [RegExp, RegExp]> = {
  lofi: [/lo-fi/, /relaxed/],
  synthwave: [/synthwave.*gated drums/, /sustained/],
  cinematic: [/cinematic.*strings/, /spacious/],
  trap: [/trap.*808.*rolling hats/, /rap.*triplet/],
  house: [/house.*four on the floor/, /rhythmic.*refrain/],
  ambient: [/ambient.*no drums/, /unhurried/],
  drill: [/drill.*sliding 808/i, /rap.*syncopated/],
  orchestral: [/orchestral.*timpani/, /legato/],
  hiphop: [/hip hop.*808.*modern radio/, /rap/],
  metal: [/metal.*distorted guitar.*double kick/, /forceful/],
  pop: [/pop.*2020s radio/, /sung.*hook/],
  rnb: [/r&b.*stacked vocals/, /soulful/],
  rock: [/rock.*electric guitar.*live drums/, /sung.*anthem/],
  country: [/country.*acoustic guitar.*pedal steel/, /storytelling/],
  cartoon: [/cartoon.*pizzicato.*xylophone.*comic brass/, /playful.*bouncy/],
};
assert.deepEqual(GENRES.map(g => g.id).sort(), Object.keys(expected).sort());
const failures: string[] = [];
for (const genre of GENRES) {
  try {
    const selected = applyMusicChip(genre.id, rain);
    assert.equal(interpretMusicBrief(`${genre.label} song about rain`).genre, genre.id, "genre words in an auto brief use the same catalog");
    assert.equal(selected.genre, genre.id);
    assert.match(selected.tags, expected[genre.id][0]);
    assert.match(selected.cadence, expected[genre.id][1]);
    assert.equal(selected.topic, rain.topic);
    assert.deepEqual(applyMusicChip(genre.id, selected), selected, "normalization is idempotent");
    if (!["hiphop", "trap", "drill"].includes(genre.id)) {
      assert.doesNotMatch(selected.tags, /\brap\b|hip hop/);
      assert.doesNotMatch(selected.cadence, /\brap\b/);
      assert.doesNotMatch(applyMusicChip(genre.id, eminem).cadence, /\brap\b/);
    }
    console.log(`PASS chip ${genre.id}: ${selected.tags} | ${selected.cadence}`);
  } catch (error) {
    failures.push(genre.id);
    console.error(`FAIL chip ${genre.id}: ${(error as Error).message}`);
  }
}
assert.deepEqual(failures, [], `All ${GENRES.length} genre chips must replace stale tags AND cadence`);
assert.deepEqual(applyMusicChip("hiphop", eminem), eminem, "compatible named detail survives the default chip");
assert.match(applyMusicChip("trap", eminem).tags, /rapid-fire rap/);
assert.match(applyMusicChip("trap", eminem).cadence, /internal rhymes/);
assert.equal(applyMusicChip("country", eminem).topic, eminem.topic);
assert.deepEqual(applyMusicChip("", eminem), eminem);
assert.deepEqual(applyMusicChip("unknown", eminem), eminem);
for (const [name, genre, detail] of [
  ["Eminem", "hiphop", /detroit/],
  ["Kendrick", "hiphop", /west coast/],
  ["Biggie", "hiphop", /east coast/],
  ["Drake", "rnb", /melodic rap/],
] as const) {
  const named = interpretMusicBrief(`style of ${name} about a literal story`);
  assert.deepEqual(applyMusicChip(genre, named), named);
  assert.match(named.tags, detail);
  const instrumental = applyMusicChip(genre, named, "instrumental");
  assert.doesNotMatch(instrumental.tags, /\b(?:rap|vocals?|rhyme|storytelling)\b/);
  assert.equal(instrumental.cadence, "instrumental phrasing");
  assert.deepEqual(applyMusicChip(genre, instrumental, "instrumental"), instrumental);
}
assert.match(applyMusicChip("hiphop", interpretMusicBrief("style of Drake about rain")).tags, /melodic rap/);

console.log(`PASS: ${GENRES.length}/${GENRES.length} chips, compatible styles, literal topic, lyric cues, WAN prompt, SRT stamps, A=432`);
