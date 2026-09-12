import {
  type Arrangement,
  chordNotes,
  degreeToMidi,
  getGenre,
  midiToFreq,
  seedFromText,
} from "@/lib/music/theory";

const SAMPLE_RATE = 32000;
/** Rendering is in-memory, so long pieces are planned but bounced in a window. */
export const MAX_RENDER_SEC = 300;

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

function adsr(t: number, dur: number, a: number, d: number, s: number, r: number) {
  if (t < 0 || t > dur + r) return 0;
  if (t < a) return t / a;
  if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
  if (t < dur) return s;
  return s * Math.max(0, 1 - (t - dur) / r);
}

/** One-pole lowpass, used per voice to take the edge off raw saws. */
function makeLowpass(cutoff: number) {
  const x = Math.exp((-2 * Math.PI * cutoff) / SAMPLE_RATE);
  let z = 0;
  return (input: number) => {
    z = input * (1 - x) + z * x;
    return z;
  };
}

type Buf = { l: Float32Array; r: Float32Array };

function add(buf: Buf, i: number, v: number, pan = 0) {
  if (i < 0 || i >= buf.l.length) return;
  const lg = Math.cos(((pan + 1) * Math.PI) / 4);
  const rg = Math.sin(((pan + 1) * Math.PI) / 4);
  buf.l[i] += v * lg;
  buf.r[i] += v * rg;
}

/* ------------------------------------------------------------------ voices */

function pad(buf: Buf, start: number, dur: number, freq: number, gain: number, pan: number) {
  const n = Math.floor(dur * SAMPLE_RATE);
  const rel = 0.6;
  const lp = makeLowpass(1400 + freq * 2);
  const detune = [0.997, 1, 1.004];
  for (let i = 0; i < n + rel * SAMPLE_RATE; i++) {
    const t = i / SAMPLE_RATE;
    const env = adsr(t, dur, 0.45, 0.3, 0.75, rel);
    if (env <= 0) continue;
    let v = 0;
    for (const d of detune) {
      const ph = t * freq * d;
      // Soft saw: sine plus a touch of its own harmonics.
      v += Math.sin(2 * Math.PI * ph) + 0.32 * Math.sin(4 * Math.PI * ph);
    }
    add(buf, start + i, lp(v / detune.length) * env * gain, pan);
  }
}

function bass(buf: Buf, start: number, dur: number, freq: number, gain: number, slide = 0) {
  const n = Math.floor((dur + 0.12) * SAMPLE_RATE);
  const lp = makeLowpass(420);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = adsr(t, dur, 0.008, 0.09, 0.72, 0.1);
    if (env <= 0) continue;
    const f = freq * (slide ? Math.pow(2, (slide * Math.min(1, t / dur)) / 12) : 1);
    phase += f / SAMPLE_RATE;
    const saw = 2 * (phase % 1) - 1;
    const sub = Math.sin(2 * Math.PI * phase);
    add(buf, start + i, lp(saw * 0.35 + sub * 0.85) * env * gain, 0);
  }
}

function pluck(buf: Buf, start: number, dur: number, freq: number, gain: number, pan: number) {
  const n = Math.floor((dur + 0.25) * SAMPLE_RATE);
  const lp = makeLowpass(2600);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = adsr(t, dur * 0.5, 0.004, 0.12, 0.32, 0.22);
    if (env <= 0) continue;
    phase += freq / SAMPLE_RATE;
    const sq = (phase % 1) < 0.5 ? 1 : -1;
    const sine = Math.sin(2 * Math.PI * phase);
    add(buf, start + i, lp(sq * 0.22 + sine * 0.7) * env * gain, pan);
  }
}

function kick(buf: Buf, start: number, gain: number) {
  const n = Math.floor(0.34 * SAMPLE_RATE);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 13);
    const f = 48 + 150 * Math.exp(-t * 42); // pitch drop gives the thump
    phase += f / SAMPLE_RATE;
    const click = i < 40 ? (1 - i / 40) * 0.35 : 0;
    add(buf, start + i, (Math.sin(2 * Math.PI * phase) * env + click) * gain, 0);
  }
}

function snare(buf: Buf, start: number, gain: number, rand: () => number) {
  const n = Math.floor(0.24 * SAMPLE_RATE);
  const lp = makeLowpass(5200);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 19);
    const noise = rand() * 2 - 1;
    const tone = Math.sin(2 * Math.PI * 190 * t) * 0.35;
    add(buf, start + i, (lp(noise) * 0.9 + tone) * env * gain, 0);
  }
}

function hat(buf: Buf, start: number, gain: number, open: boolean, rand: () => number) {
  const n = Math.floor((open ? 0.2 : 0.055) * SAMPLE_RATE);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * (open ? 14 : 58));
    const noise = rand() * 2 - 1;
    const hp = noise - prev; // crude highpass
    prev = noise;
    add(buf, start + i, hp * env * gain, (rand() - 0.5) * 0.5);
  }
}

/* ------------------------------------------------------------------ space */

/** Schroeder-style reverb: a few combs into allpasses. Cheap but convincing. */
function reverb(buf: Buf, amount: number) {
  if (amount <= 0) return;
  const combs = [1237, 1381, 1607, 1789];
  const gains = [0.78, 0.76, 0.74, 0.72];
  const out = { l: new Float32Array(buf.l.length), r: new Float32Array(buf.r.length) };
  for (let c = 0; c < combs.length; c++) {
    const d = combs[c];
    const g = gains[c];
    const bl = new Float32Array(d);
    const br = new Float32Array(d);
    let idx = 0;
    for (let i = 0; i < buf.l.length; i++) {
      const yl = bl[idx];
      const yr = br[idx];
      bl[idx] = buf.l[i] + yl * g;
      br[idx] = buf.r[i] + yr * g;
      out.l[i] += yl * 0.25;
      out.r[i] += yr * 0.25;
      idx = (idx + 1) % d;
    }
  }
  for (let i = 0; i < buf.l.length; i++) {
    buf.l[i] += out.l[i] * amount;
    buf.r[i] += out.r[i] * amount;
  }
}

/* ----------------------------------------------------------------- render */

export function renderArrangement(a: Arrangement, seedText: string): {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  seconds: number;
} {
  const genre = getGenre(a.genre);
  const rand = rng(seedFromText(seedText + a.genre));
  const seconds = Math.min(MAX_RENDER_SEC, a.durationSec) + 2;
  const total = Math.floor(seconds * SAMPLE_RATE);
  const buf: Buf = { l: new Float32Array(total), r: new Float32Array(total) };

  const secPerBeat = 60 / a.bpm;
  const secPerBar = secPerBeat * a.beatsPerBar;
  const at = (sec: number) => Math.floor(sec * SAMPLE_RATE);

  let bar = 0;
  for (const section of a.sections) {
    if (section.startSec > MAX_RENDER_SEC) break;
    const e = section.energy;

    for (let b = 0; b < section.bars; b++, bar++) {
      const barStart = section.startSec + b * secPerBar;
      if (barStart > MAX_RENDER_SEC) break;
      const degree = a.chordPlan[bar % a.chordPlan.length];

      // Pad — the harmonic bed.
      if (genre.pad > 0.05) {
        const notes = chordNotes(a, degree, 4);
        notes.forEach((m, i) => {
          pad(
            buf,
            at(barStart),
            secPerBar * 0.98,
            midiToFreq(m),
            0.1 * genre.pad * (0.55 + e * 0.45),
            (i - 1.5) * 0.4,
          );
        });
      }

      // Bass — root on the downbeat, plus an off-beat push when energy is up.
      if (genre.bass > 0.05) {
        const rootMidi = degreeToMidi(a, degree, 2);
        bass(buf, at(barStart), secPerBeat * 0.9, midiToFreq(rootMidi), 0.34 * genre.bass);
        if (e > 0.5) {
          bass(
            buf,
            at(barStart + secPerBeat * 2.5),
            secPerBeat * 0.6,
            midiToFreq(rootMidi),
            0.26 * genre.bass,
            a.genre === "drill" ? -3 : 0,
          );
        }
      }

      // Arp / lead line across the bar.
      if (genre.arp > 0.05 && e > 0.3) {
        const steps = 8;
        for (let s = 0; s < steps; s++) {
          if (rand() > 0.35 + genre.arp * 0.55) continue;
          const deg = degree + [0, 2, 4, 6, 4, 2][s % 6];
          pluck(
            buf,
            at(barStart + (s * secPerBar) / steps),
            secPerBar / steps,
            midiToFreq(degreeToMidi(a, deg, 5)),
            0.12 * genre.arp * e,
            (rand() - 0.5) * 0.8,
          );
        }
      }
      if (genre.lead > 0.05 && e > 0.75) {
        const deg = degree + [0, 4, 2][bar % 3];
        pluck(
          buf,
          at(barStart),
          secPerBeat * 1.5,
          midiToFreq(degreeToMidi(a, deg, 6)),
          0.1 * genre.lead,
          0.15,
        );
      }

      // Drums.
      if (genre.drums > 0.05 && e > 0.22) {
        const four = a.genre === "house";
        for (let beat = 0; beat < a.beatsPerBar; beat++) {
          const bt = barStart + beat * secPerBeat;
          if (four || beat === 0 || (beat === 2 && e > 0.45)) {
            kick(buf, at(bt), 0.5 * genre.drums);
          }
          if (beat % 2 === 1) snare(buf, at(bt), 0.3 * genre.drums * e, rand);

          const div = e > 0.7 && (a.genre === "trap" || a.genre === "drill") ? 4 : 2;
          for (let s = 0; s < div; s++) {
            const swing = s % 2 === 1 ? genre.swing * secPerBeat * 0.3 : 0;
            hat(
              buf,
              at(bt + (s * secPerBeat) / div + swing),
              0.1 * genre.drums * (0.5 + e * 0.5),
              s === 0 && beat === 2,
              rand,
            );
          }
        }
      }
    }
  }

  reverb(buf, a.genre === "ambient" || a.genre === "cinematic" ? 0.3 : 0.14);

  // Normalise, then soft-clip so peaks round off instead of tearing.
  let peak = 0;
  for (let i = 0; i < total; i++) {
    peak = Math.max(peak, Math.abs(buf.l[i]), Math.abs(buf.r[i]));
  }
  const norm = peak > 0 ? 0.89 / peak : 1;
  for (let i = 0; i < total; i++) {
    buf.l[i] = Math.tanh(buf.l[i] * norm * 1.1);
    buf.r[i] = Math.tanh(buf.r[i] * norm * 1.1);
  }

  // Fade the tail so the file does not end on a click.
  const fade = Math.min(total, SAMPLE_RATE * 1.5);
  for (let i = 0; i < fade; i++) {
    const g = i / fade;
    buf.l[total - 1 - i] *= g;
    buf.r[total - 1 - i] *= g;
  }

  return { left: buf.l, right: buf.r, sampleRate: SAMPLE_RATE, seconds };
}
