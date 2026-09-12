import path from "path";

/** On-disk studio root. Bind-mount this directory when hosting. */
export const DATA_ROOT = path.join(process.cwd(), ".data");

export const LEGACY_JOBS_FILE = path.join(DATA_ROOT, "jobs.json");
export const FLAT_OUTPUTS_DIR = path.join(DATA_ROOT, "outputs");
export const UPLOADS_DIR = path.join(DATA_ROOT, "uploads");
export const TMP_DIR = path.join(DATA_ROOT, "tmp");
export const CARD_BG_DIR = path.join(DATA_ROOT, "card-bg");
export const JOBS_DIR = path.join(DATA_ROOT, "jobs");
export const LIBRARY_DIR = path.join(DATA_ROOT, "library");
export const INDEXES_DIR = path.join(DATA_ROOT, "indexes");
export const JOBS_INDEX_FILE = path.join(INDEXES_DIR, "jobs.json");
export const LIBRARY_INDEX_FILE = path.join(INDEXES_DIR, "library.json");

export function dateFolder(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

export function jobFolder(jobId: string, createdAt: string): string {
  return path.join(JOBS_DIR, dateFolder(createdAt), jobId);
}

export function jobJsonPath(jobId: string, createdAt: string): string {
  return path.join(jobFolder(jobId, createdAt), "job.json");
}

export function jobOutputsDir(jobId: string, createdAt: string): string {
  return path.join(jobFolder(jobId, createdAt), "outputs");
}

export function jobInputsDir(jobId: string, createdAt: string): string {
  return path.join(jobFolder(jobId, createdAt), "inputs");
}

export function libraryKindDir(kind: string, createdAt: string): string {
  const d = new Date(createdAt);
  const y = Number.isNaN(d.getTime())
    ? new Date().getUTCFullYear()
    : d.getUTCFullYear();
  const m = Number.isNaN(d.getTime())
    ? String(new Date().getUTCMonth() + 1).padStart(2, "0")
    : String(d.getUTCMonth() + 1).padStart(2, "0");
  return path.join(LIBRARY_DIR, kind, String(y), m);
}
