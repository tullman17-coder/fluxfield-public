import { NextResponse } from "next/server";
import { createAndRunJob } from "@/lib/jobs/runner";
import { listJobs, getJob } from "@/lib/jobs/store";
import { promises as fs } from "node:fs";
import { fetchReferenceImage, saveUpload, validateUpload, reuseReferenceImage, ReferenceInputError } from "@/lib/jobs/reference";
import { validateJobInput, readRequestPayload, JobInputError, type UploadField } from "@/lib/jobs/input";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sort = (searchParams.get("sort") as
    | "createdAt"
    | "updatedAt"
    | "name"
    | "tool"
    | "status") || "createdAt";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";
  const tool = searchParams.get("tool") || undefined;
  const status = searchParams.get("status") || undefined;
  const limit = searchParams.get("limit")
    ? Number(searchParams.get("limit"))
    : undefined;
  const offset = searchParams.get("offset")
    ? Number(searchParams.get("offset"))
    : undefined;

  const jobs = await listJobs({ sort, order, tool, status, limit, offset });
  return NextResponse.json({ jobs });
}

export async function POST(request: Request) {
  const created: string[] = [];
  try {
    let body: unknown;
    const files: Partial<Record<UploadField, File>> = {};
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await readRequestPayload(request, "form", 81 * 1024 * 1024);
      const fields = new Set(["tool", "workflowSlug", "presetId", "inputs", "referenceImageUrl", "referenceJobId", "referenceImage", "soundtrack", "voiceSample"]);
      for (const key of form.keys()) {
        if (!fields.has(key) || form.getAll(key).length !== 1) throw new JobInputError("Unknown or duplicate form field");
      }
      const text = (key: string) => {
        const value = form.get(key);
        if (value !== null && typeof value !== "string") throw new JobInputError(`Expected text for ${key}`);
        return value ?? undefined;
      };
      const inputs: unknown = JSON.parse(text("inputs") ?? "{}");
      for (const key of ["referenceImageUrl", "referenceJobId"]) {
        if (text(key) === undefined) continue;
        if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) throw new JobInputError("inputs must be an object");
        const record = inputs as Record<string, unknown>;
        if (record[key] !== undefined && record[key] !== text(key)) throw new JobInputError("Conflicting reference sources");
        record[key] = text(key);
      }
      body = { tool: text("tool"), workflowSlug: text("workflowSlug"), presetId: text("presetId"), inputs };
      for (const key of ["referenceImage", "soundtrack", "voiceSample"] as const) {
        const file = form.get(key);
        if (file !== null) {
          if (typeof file === "string") throw new JobInputError(`Expected a file for ${key}`);
          files[key] = file;
        }
      }
    } else {
      body = await readRequestPayload(request, "json", 1024 * 1024);
    }
    const input = validateJobInput(body, { uploads: Object.keys(files) as UploadField[] });
    // Validate every file before buffering any file or contacting a URL/provider.
    for (const key of Object.keys(files) as UploadField[]) validateUpload(files[key]!, key);
    for (const key of Object.keys(files) as UploadField[]) {
      const saved = await saveUpload(files[key]!, key);
      created.push(saved.dest);
      input.inputs[key] = saved.name;
      if (key === "referenceImage") input.referenceImagePath = saved.dest;
      if (key === "soundtrack" && !input.inputs.scoreSource) input.inputs.scoreSource = "upload";
    }
    if (!input.referenceImagePath && input.inputs.referenceImageUrl) {
      const saved = await fetchReferenceImage(input.inputs.referenceImageUrl);
      created.push(saved.dest);
      input.referenceImagePath = saved.dest;
      input.inputs.referenceImage = saved.name;
    }
    if (input.inputs.referenceJobId) {
      const source = await getJob(input.inputs.referenceJobId);
      if (source?.id !== input.inputs.referenceJobId) throw new JobInputError("Reference source is unavailable");
      const saved = await reuseReferenceImage(source);
      created.push(saved.dest);
      input.referenceImagePath = saved.dest;
      input.inputs.referenceImage = saved.name;
    }
    const job = await createAndRunJob(input);
    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    await Promise.all(created.map((file) => fs.unlink(file).catch(() => undefined)));
    const invalid = error instanceof JobInputError || error instanceof ReferenceInputError || error instanceof SyntaxError;
    return NextResponse.json({ error: invalid ? (error instanceof SyntaxError ? "Invalid request JSON" : error.message) : "Failed to create job" }, { status: invalid ? 400 : 500 });
  }
}
