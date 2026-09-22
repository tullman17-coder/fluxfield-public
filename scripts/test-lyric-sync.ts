import assert from "node:assert/strict";
import {
  lyricCueAt,
  lyricSheetToSrt,
  timedLyricCues,
  wanLyricPrompt,
  type LyricSheet,
} from "../src/lib/music/lyrics";
import { applyMusicChip, interpretMusicBrief } from "../src/lib/music/brief";
import { midiToFreq } from "../src/lib/music/theory";

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
const rain = interpretMusicBrief("song about rain");
assert.equal(applyMusicChip("trap", rain).genre, "trap");
assert.match(applyMusicChip("trap", rain).tags, /808/);
assert.equal(applyMusicChip("auto", rain).genre, rain.genre);

console.log("PASS: lyric cues, WAN prompt, SRT stamps");
