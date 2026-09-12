import { promises as fs } from "fs";
import path from "path";
import { nanoid } from "nanoid";
import type { StudioJob } from "@/lib/adapters/types";
import {
  DATA_ROOT,
  FLAT_OUTPUTS_DIR,
  INDEXES_DIR,
  JOBS_DIR,
  JOBS_INDEX_FILE,
  LEGACY_JOBS_FILE,
  jobFolder,
  jobInputsDir,
  jobJsonPath,
  jobOutputsDir,
} from "@/lib/data/paths";
import { filenameFromOutputUrl } from "@/lib/library/kinds";
import { syncJobToLibrary } from "@/lib/library/index";

export type JobSort = "createdAt" | "updatedAt" | "name" | "tool" | "status";

export type ListJobsOpts = {
  sort?: JobSort;
  order?: "asc" | "desc";
  tool?: string;
  status?: string;
  limit?: number;
  offset?: number;
};

type JobIndexEntry = {
  id: string;
  createdAt: string;
  updatedAt: string;
  tool: string;
  status: string;
  workflowName: string;
  presetLabel: string;
  path: string;
};

let queue: Promise<unknown> = Promise.resolve();
let migrated = false;

function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function ensureRoots() {
  await fs.mkdir(DATA_ROOT, { recursive: true });
  await fs.mkdir(JOBS_DIR, { recursive: true });
  await fs.mkdir(FLAT_OUTPUTS_DIR, { recursive: true });
  await fs.mkdir(INDEXES_DIR, { recursive: true });
}

async function linkOrCopy(from: string, to: string) {
  await fs.mkdir(path.dirname(to), { recursive: true });
  try {
    await fs.access(to);
    return;
  } catch {
    // create
  }
  try {
    await fs.link(from, to);
  } catch {
    await fs.copyFile(from, to);
  }
}

async function pathExists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Find an output file in the job folder or the legacy flat outputs dir. */
export async function resolveOutputFile(
  fileName: string,
  job?: Pick<StudioJob, "id" | "createdAt">,
): Promise<string | null> {
  if (job) {
    const inJob = path.join(jobOutputsDir(job.id, job.createdAt), fileName);
    if (await pathExists(inJob)) return inJob;
  }
  const flat = path.join(FLAT_OUTPUTS_DIR, fileName);
  if (await pathExists(flat)) return flat;

  // Slow path: walk recent job trees when the flat link is missing.
  if (!(await pathExists(JOBS_DIR))) return null;
  const days = await fs.readdir(JOBS_DIR).catch(() => [] as string[]);
  for (const day of days.sort().reverse()) {
    const dayDir = path.join(JOBS_DIR, day);
    const ids = await fs.readdir(dayDir).catch(() => [] as string[]);
    for (const id of ids) {
      const candidate = path.join(dayDir, id, "outputs", fileName);
      if (await pathExists(candidate)) return candidate;
    }
  }
  return null;
}

async function readJobFile(filePath: string): Promise<StudioJob | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as StudioJob;
  } catch {
    return null;
  }
}

async function writeJobFile(job: StudioJob) {
  const dir = jobFolder(job.id, job.createdAt);
  await fs.mkdir(jobOutputsDir(job.id, job.createdAt), { recursive: true });
  await fs.mkdir(jobInputsDir(job.id, job.createdAt), { recursive: true });
  const file = jobJsonPath(job.id, job.createdAt);
  const tmp = `${file}.${nanoid(6)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(job, null, 2));
  await fs.rename(tmp, file);
}

async function gatherJobFiles(): Promise<string[]> {
  if (!(await pathExists(JOBS_DIR))) return [];
  const files: string[] = [];
  const days = await fs.readdir(JOBS_DIR);
  for (const day of days) {
    const dayDir = path.join(JOBS_DIR, day);
    const stat = await fs.stat(dayDir).catch(() => null);
    if (!stat?.isDirectory()) continue;
    const ids = await fs.readdir(dayDir);
    for (const id of ids) {
      const file = path.join(dayDir, id, "job.json");
      if (await pathExists(file)) files.push(file);
    }
  }
  return files;
}

async function rebuildJobsIndex(jobs: StudioJob[]): Promise<JobIndexEntry[]> {
  const entries: JobIndexEntry[] = jobs.map((j) => ({
    id: j.id,
    createdAt: j.createdAt,
    updatedAt: j.updatedAt,
    tool: j.tool,
    status: j.status,
    workflowName: j.workflowName,
    presetLabel: j.presetLabel,
    path: path.relative(DATA_ROOT, jobJsonPath(j.id, j.createdAt)),
  }));
  const tmp = `${JOBS_INDEX_FILE}.${nanoid(6)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(entries, null, 2));
  await fs.rename(tmp, JOBS_INDEX_FILE);
  return entries;
}

async function loadAllJobsFromDisk(): Promise<StudioJob[]> {
  const files = await gatherJobFiles();
  const jobs: StudioJob[] = [];
  for (const file of files) {
    const job = await readJobFile(file);
    if (job) jobs.push(job);
  }
  return jobs;
}

async function placeJobOutputs(job: StudioJob) {
  for (const output of job.outputs) {
    if (!output.url) continue;
    const fileName = filenameFromOutputUrl(output.url);
    if (!fileName) continue;
    const flat = path.join(FLAT_OUTPUTS_DIR, fileName);
    const inJob = path.join(jobOutputsDir(job.id, job.createdAt), fileName);
    if (await pathExists(flat)) {
      await linkOrCopy(flat, inJob);
    } else if (await pathExists(inJob)) {
      await linkOrCopy(inJob, flat);
    }
  }
  await syncJobToLibrary(job, async (name) => resolveOutputFile(name, job));
}

/**
 * One-time import of the legacy single-file ledger into per-job folders.
 * Safe to call repeatedly — no-ops once folders exist for every ledger id.
 */
export async function migrateLegacyJobs(): Promise<{
  migrated: number;
  skipped: number;
}> {
  await ensureRoots();
  let migratedCount = 0;
  let skipped = 0;

  if (!(await pathExists(LEGACY_JOBS_FILE))) {
    return { migrated: 0, skipped: 0 };
  }

  const raw = await fs.readFile(LEGACY_JOBS_FILE, "utf8");
  let legacy: StudioJob[] = [];
  try {
    const parsed = JSON.parse(raw);
    legacy = Array.isArray(parsed) ? (parsed as StudioJob[]) : [];
  } catch {
    const damaged = `${LEGACY_JOBS_FILE}.damaged-${Date.now()}`;
    await fs.rename(LEGACY_JOBS_FILE, damaged).catch(() => undefined);
    return { migrated: 0, skipped: 0 };
  }

  for (const job of legacy) {
    const dest = jobJsonPath(job.id, job.createdAt);
    if (await pathExists(dest)) {
      skipped += 1;
      continue;
    }
    await writeJobFile(job);
    await placeJobOutputs(job);
    migratedCount += 1;
  }

  if (migratedCount > 0) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await fs.rename(LEGACY_JOBS_FILE, `${LEGACY_JOBS_FILE}.migrated-${stamp}`);
  }

  const all = await loadAllJobsFromDisk();
  await rebuildJobsIndex(all);
  return { migrated: migratedCount, skipped };
}

async function ensureMigrated() {
  if (migrated) return;
  await ensureRoots();
  if (await pathExists(LEGACY_JOBS_FILE)) {
    await migrateLegacyJobs();
  } else if (!(await pathExists(JOBS_INDEX_FILE))) {
    const all = await loadAllJobsFromDisk();
    await rebuildJobsIndex(all);
  }
  migrated = true;
}

function compareJobs(
  a: StudioJob,
  b: StudioJob,
  sort: JobSort,
  order: "asc" | "desc",
) {
  const dir = order === "asc" ? 1 : -1;
  let cmp = 0;
  switch (sort) {
    case "name":
      cmp = (a.workflowName || "").localeCompare(b.workflowName || "");
      break;
    case "tool":
      cmp = a.tool.localeCompare(b.tool);
      break;
    case "status":
      cmp = a.status.localeCompare(b.status);
      break;
    case "updatedAt":
      cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      break;
    case "createdAt":
    default:
      cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      break;
  }
  return cmp * dir;
}

export async function listJobs(opts: ListJobsOpts = {}): Promise<StudioJob[]> {
  return serialize(async () => {
    await ensureMigrated();
    let jobs = await loadAllJobsFromDisk();
    if (opts.tool) jobs = jobs.filter((j) => j.tool === opts.tool);
    if (opts.status) jobs = jobs.filter((j) => j.status === opts.status);
    const sort = opts.sort ?? "createdAt";
    const order = opts.order ?? "desc";
    jobs = [...jobs].sort((a, b) => compareJobs(a, b, sort, order));
    const offset = Math.max(0, opts.offset ?? 0);
    const limit = opts.limit ? Math.min(500, Math.max(1, opts.limit)) : undefined;
    if (limit != null) return jobs.slice(offset, offset + limit);
    if (offset) return jobs.slice(offset);
    return jobs;
  });
}

export async function getJob(id: string): Promise<StudioJob | undefined> {
  return serialize(async () => {
    await ensureMigrated();
    // Prefer index path when present
    try {
      const index = JSON.parse(
        await fs.readFile(JOBS_INDEX_FILE, "utf8"),
      ) as JobIndexEntry[];
      const hit = index.find((e) => e.id === id);
      if (hit) {
        const job = await readJobFile(path.join(DATA_ROOT, hit.path));
        if (job) return job;
      }
    } catch {
      // fall through
    }
    const all = await loadAllJobsFromDisk();
    return all.find((j) => j.id === id);
  });
}

export async function saveJob(job: StudioJob): Promise<StudioJob> {
  return serialize(async () => {
    await ensureMigrated();
    await writeJobFile(job);
    await placeJobOutputs(job);
    const all = await loadAllJobsFromDisk();
    await rebuildJobsIndex(all);
    return job;
  });
}

export async function updateJob(
  id: string,
  patch: Partial<StudioJob>,
): Promise<StudioJob | undefined> {
  return serialize(async () => {
    await ensureMigrated();
    const current = await getJobUnlocked(id);
    if (!current) return undefined;
    const next: StudioJob = {
      ...current,
      ...patch,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    };
    await writeJobFile(next);
    await placeJobOutputs(next);
    const all = await loadAllJobsFromDisk();
    await rebuildJobsIndex(all);
    return next;
  });
}

/** Internal get without taking the queue (caller already holds it). */
async function getJobUnlocked(id: string): Promise<StudioJob | undefined> {
  try {
    const index = JSON.parse(
      await fs.readFile(JOBS_INDEX_FILE, "utf8"),
    ) as JobIndexEntry[];
    const hit = index.find((e) => e.id === id);
    if (hit) {
      const job = await readJobFile(path.join(DATA_ROOT, hit.path));
      if (job) return job;
    }
  } catch {
    // fall through
  }
  const all = await loadAllJobsFromDisk();
  return all.find((j) => j.id === id);
}

export function newJobId() {
  return nanoid(10);
}
