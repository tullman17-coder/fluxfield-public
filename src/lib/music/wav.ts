/** 16-bit PCM stereo WAV. */
export function encodeWav(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
): Buffer {
  const frames = Math.min(left.length, right.length);
  const dataBytes = frames * 4;
  const buf = Buffer.alloc(44 + dataBytes);

  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(2, 22); // stereo
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 4, 28); // byte rate
  buf.writeUInt16LE(4, 32); // block align
  buf.writeUInt16LE(16, 34); // bits
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataBytes, 40);

  let o = 44;
  for (let i = 0; i < frames; i++) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    buf.writeInt16LE((l < 0 ? l * 0x8000 : l * 0x7fff) | 0, o);
    buf.writeInt16LE((r < 0 ? r * 0x8000 : r * 0x7fff) | 0, o + 2);
    o += 4;
  }
  return buf;
}
