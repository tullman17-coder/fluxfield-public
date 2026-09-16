// Pure geometry shared by the workbench, job snapshot and server adapter.
export function fitZermoSize(width: number, height: number) {
  if (![width, height].every((n) => Number.isFinite(n) && n > 0)) throw new Error('Invalid Zermo aspect ratio');
  const ratio = width / height;
  const fitted = { width: Math.round((ratio >= 1 ? 1024 : 1024 * ratio) / 8) * 8, height: Math.round((ratio >= 1 ? 1024 / ratio : 1024) / 8) * 8 };
  if (Math.min(fitted.width, fitted.height) < 256) throw new Error('Zermo aspect ratio exceeds image limits');
  return fitted;
}
