import assert from "node:assert/strict";
import {
  lyricCueAt,
  lyricSheetToSrt,
  timedLyricCues,
  wanLyricPrompt,
  type LyricSheet,
} from "../src/lib/music/lyrics";

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
console.log("PASS: lyric cues, WAN prompt, SRT stamps");
