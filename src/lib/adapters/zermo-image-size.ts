// Pure geometry shared by the workbench, job snapshot and server adapter.
export function fitZermoSize(width: number, height: number) {
  if (![width, height].every((n) => Number.isFinite(n) && n > 0)) throw new Error('Invalid Zermo aspect ratio');
  const ratio = width / height;
  if (ratio < 0.25 || ratio > 4) throw new Error('Zermo aspect ratio exceeds image limits');
  // Closest native /16 canvas; on ties use more pixels. Also handles display's 1.91:1.
  let fitted = { width: 1024, height: 1024 }, best = Infinity;
  for (let w = 256; w <= 1024; w += 16) {
    for (const h of [Math.floor(w / ratio / 16) * 16, Math.ceil(w / ratio / 16) * 16]) {
      if (h < 256 || h > 1024) continue;
      const error = Math.abs(w / h - ratio);
      if (error < best - 1e-10 || (Math.abs(error - best) <= 1e-10 && w * h > fitted.width * fitted.height)) {
        best = error; fitted = { width: w, height: h };
      }
    }
  }
  return fitted;
}
