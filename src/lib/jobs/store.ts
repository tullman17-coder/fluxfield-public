import { promises as fs } from "fs";
import path from "path";
import { nanoid } from "nanoid";
import type { StudioJob } from "@/lib/adapters/types";

const JOBS_PATH = path.join(process.cwd(), ".data", "jobs.json");

async function ensure() {
  await fs.mkdir(path.dirname(JOBS_PATH), { recursive: true });
  try {
    await fs.access(JOBS_PATH);
  } catch {
    await fs.writeFile(JOBS_PATH, "[]");
  }
}

export async function listJobs(): Promise<StudioJob[]> {
  await ensure();
  const raw = await fs.readFile(JOBS_PATH, "utf8");
  const jobs = JSON.parse(raw) as StudioJob[];
  return jobs.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function getJob(id: string): Promise<StudioJob | undefined> {
  const jobs = await listJobs();
  return jobs.find((j) => j.id === id);
}

export async function saveJob(job: StudioJob): Promise<StudioJob> {
  await ensure();
  const jobs = await listJobs();
  const idx = jobs.findIndex((j) => j.id === job.id);
  if (idx >= 0) jobs[idx] = job;
  else jobs.unshift(job);
  await fs.writeFile(JOBS_PATH, JSON.stringify(jobs.slice(0, 200), null, 2));
  return job;
}

export async function updateJob(
  id: string,
  patch: Partial<StudioJob>,
): Promise<StudioJob | undefined> {
  const job = await getJob(id);
  if (!job) return undefined;
  const next = {
    ...job,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await saveJob(next);
  return next;
}

export function newJobId() {
  return nanoid(10);
}
