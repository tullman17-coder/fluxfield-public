import { promises as fs } from "fs";
import path from "path";
import { nanoid } from "nanoid";
import type { StudioJob } from "@/lib/adapters/types";

const JOBS_PATH = path.join(process.cwd(), ".data", "jobs.json");
const MAX_JOBS = 200;

// Every mutation is a read-modify-write of one file, and the home page starts a
// job per card at once. Without a queue those writes interleave and shred the file.
let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function ensure() {
  await fs.mkdir(path.dirname(JOBS_PATH), { recursive: true });
  try {
    await fs.access(JOBS_PATH);
  } catch {
    await fs.writeFile(JOBS_PATH, "[]");
  }
}

function parseJobs(raw: string): StudioJob[] | null {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StudioJob[]) : null;
  } catch (err) {
    // A torn write leaves a complete array with trailing bytes from the longer
    // document it replaced. The prefix is still good, so keep the history.
    const at = /position (\d+)/.exec(
      err instanceof Error ? err.message : "",
    )?.[1];
    if (!at) return null;
    try {
      const salvaged = JSON.parse(raw.slice(0, Number(at)));
      return Array.isArray(salvaged) ? (salvaged as StudioJob[]) : null;
    } catch {
      return null;
    }
  }
}

async function readJobs(): Promise<StudioJob[]> {
  await ensure();
  const raw = await fs.readFile(JOBS_PATH, "utf8");
  const jobs = parseJobs(raw);
  if (jobs) return jobs;
  await fs
    .rename(JOBS_PATH, `${JOBS_PATH}.damaged-${Date.now()}`)
    .catch(() => undefined);
  await fs.writeFile(JOBS_PATH, "[]");
  return [];
}

async function writeJobs(jobs: StudioJob[]) {
  const tmp = `${JOBS_PATH}.${nanoid(8)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(jobs.slice(0, MAX_JOBS), null, 2));
  await fs.rename(tmp, JOBS_PATH);
}

function newestFirst(jobs: StudioJob[]) {
  return [...jobs].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function listJobs(): Promise<StudioJob[]> {
  return newestFirst(await readJobs());
}

export async function getJob(id: string): Promise<StudioJob | undefined> {
  const jobs = await readJobs();
  return jobs.find((j) => j.id === id);
}

export async function saveJob(job: StudioJob): Promise<StudioJob> {
  return serialize(async () => {
    const jobs = await readJobs();
    const idx = jobs.findIndex((j) => j.id === job.id);
    if (idx >= 0) jobs[idx] = job;
    else jobs.unshift(job);
    await writeJobs(jobs);
    return job;
  });
}

export async function updateJob(
  id: string,
  patch: Partial<StudioJob>,
): Promise<StudioJob | undefined> {
  return serialize(async () => {
    const jobs = await readJobs();
    const idx = jobs.findIndex((j) => j.id === id);
    if (idx < 0) return undefined;
    const next: StudioJob = {
      ...jobs[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    jobs[idx] = next;
    await writeJobs(jobs);
    return next;
  });
}

export function newJobId() {
  return nanoid(10);
}
