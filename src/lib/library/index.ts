import { promises as fs } from "fs";
import path from "path";
import type { StudioJob } from "@/lib/adapters/types";
import {
  INDEXES_DIR,
  LIBRARY_DIR,
  LIBRARY_INDEX_FILE,
  libraryKindDir,
} from "@/lib/data/paths";
import {
  filenameFromOutputUrl,
  libraryKindFor,
  type LibraryKind,
} from "@/lib/library/kinds";

export type LibraryEntry = {
  id: string;
  jobId: string;
  tool: string;
  label: string;
  kind: LibraryKind;
  fileName: string;
  /** Path relative to `.data/` */
  relativePath: string;
  createdAt: string;
  mtimeMs: number;
};

export type LibrarySort = "createdAt" | "mtime" | "name" | "tool" | "kind";

export type ListLibraryOpts = {
  sort?: LibrarySort;
  order?: "asc" | "desc";
  kind?: LibraryKind;
  tool?: string;
  limit?: number;
  offset?: number;
};

async function ensureLibraryDirs() {
  await fs.mkdir(LIBRARY_DIR, { recursive: true });
  await fs.mkdir(INDEXES_DIR, { recursive: true });
}

async function linkOrCopy(from: string, to: string) {
  await fs.mkdir(path.dirname(to), { recursive: true });
  try {
    await fs.access(to);
    return;
  } catch {
    // continue
  }
  try {
    await fs.link(from, to);
  } catch {
    await fs.copyFile(from, to);
  }
}

export async function readLibraryIndex(): Promise<LibraryEntry[]> {
  await ensureLibraryDirs();
  try {
    const raw = await fs.readFile(LIBRARY_INDEX_FILE, "utf8");
    const parsed = JSON.parse(raw) as LibraryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeLibraryIndex(entries: LibraryEntry[]) {
  await ensureLibraryDirs();
  const tmp = `${LIBRARY_INDEX_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(entries, null, 2));
  await fs.rename(tmp, LIBRARY_INDEX_FILE);
}

/** Place a finished output into the browsable library tree and index. */
export async function publishToLibrary(
  job: StudioJob,
  absoluteSource: string,
  fileName: string,
  label: string,
  outputKind: Parameters<typeof libraryKindFor>[0]["kind"],
): Promise<LibraryEntry | null> {
  const kind = libraryKindFor({ kind: outputKind, url: `/api/outputs/${fileName}` });
  if (!kind) return null;

  const destDir = libraryKindDir(kind, job.createdAt);
  const dest = path.join(destDir, fileName);
  await linkOrCopy(absoluteSource, dest);

  let mtimeMs = Date.now();
  try {
    mtimeMs = (await fs.stat(dest)).mtimeMs;
  } catch {
    // keep now
  }

  const entry: LibraryEntry = {
    id: `${job.id}:${fileName}`,
    jobId: job.id,
    tool: job.tool,
    label,
    kind,
    fileName,
    relativePath: path.relative(LIBRARY_DIR, dest),
    createdAt: job.createdAt,
    mtimeMs,
  };

  const entries = await readLibraryIndex();
  const next = entries.filter((e) => e.id !== entry.id);
  next.push(entry);
  await writeLibraryIndex(next);
  return entry;
}

export async function syncJobToLibrary(
  job: StudioJob,
  resolveFile: (fileName: string) => Promise<string | null>,
) {
  for (const output of job.outputs) {
    if (!output.url) continue;
    const fileName = filenameFromOutputUrl(output.url);
    if (!fileName) continue;
    const kind = libraryKindFor(output);
    if (!kind) continue;
    const abs = await resolveFile(fileName);
    if (!abs) continue;
    await publishToLibrary(job, abs, fileName, output.label, output.kind);
  }
}

function compareLibrary(
  a: LibraryEntry,
  b: LibraryEntry,
  sort: LibrarySort,
  order: "asc" | "desc",
) {
  const dir = order === "asc" ? 1 : -1;
  let cmp = 0;
  switch (sort) {
    case "name":
      cmp = a.label.localeCompare(b.label) || a.fileName.localeCompare(b.fileName);
      break;
    case "tool":
      cmp = a.tool.localeCompare(b.tool);
      break;
    case "kind":
      cmp = a.kind.localeCompare(b.kind);
      break;
    case "mtime":
      cmp = a.mtimeMs - b.mtimeMs;
      break;
    case "createdAt":
    default:
      cmp =
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      break;
  }
  return cmp * dir;
}

export async function listLibrary(
  opts: ListLibraryOpts = {},
): Promise<{ entries: LibraryEntry[]; total: number }> {
  const sort = opts.sort ?? "createdAt";
  const order = opts.order ?? "desc";
  let entries = await readLibraryIndex();
  if (opts.kind) entries = entries.filter((e) => e.kind === opts.kind);
  if (opts.tool) entries = entries.filter((e) => e.tool === opts.tool);
  entries = [...entries].sort((a, b) => compareLibrary(a, b, sort, order));
  const total = entries.length;
  const offset = Math.max(0, opts.offset ?? 0);
  const limit = Math.min(200, Math.max(1, opts.limit ?? 60));
  return { entries: entries.slice(offset, offset + limit), total };
}

/** Rebuild the catalog by walking job folders (source of truth). */
export async function rebuildLibraryIndex(
  jobs: StudioJob[],
  resolveFile: (fileName: string) => Promise<string | null>,
): Promise<number> {
  await writeLibraryIndex([]);
  let n = 0;
  for (const job of jobs) {
    const before = (await readLibraryIndex()).length;
    await syncJobToLibrary(job, resolveFile);
    n += (await readLibraryIndex()).length - before;
  }
  return n;
}
