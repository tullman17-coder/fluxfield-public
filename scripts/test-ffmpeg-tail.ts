import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { extractLastFrame } from "../src/lib/adapters/ffmpeg";

const execFileAsync = promisify(execFile);

async function main() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fftail-"));
  const mp4 = path.join(dir, "clip.mp4");
  const png = path.join(dir, "tail.png");
  await execFileAsync("ffmpeg", ["-y", "-f", "lavfi", "-i", "color=c=red:s=640x352:r=16:d=3.0625", "-frames:v", "49", "-c:v", "libx264", "-pix_fmt", "yuv420p", mp4], { timeout: 30_000 });
  await extractLastFrame(mp4, png);
  const st = await fs.stat(png);
  assert(st.size > 100, "tail png empty");
  console.log("PASS: last-frame extract wrote", st.size, "bytes");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
