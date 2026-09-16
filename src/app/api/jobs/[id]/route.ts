import { NextResponse } from "next/server";
import { getJob, updateJob } from "@/lib/jobs/store";
import { resumeJob } from "@/lib/jobs/runner";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const job = await getJob(id);
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (job.generationMode === "zermo" && (job.status === "queued" || job.status === "running")) void resumeJob(id);
  return NextResponse.json({ job });
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const job = await getJob(id);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (job.generationMode !== "zermo" || job.status === "completed") return NextResponse.json({ error: "Only unfinished Zermo jobs can resume" }, { status: 409 });
  const resumed = await updateJob(id, { status: "queued", error: undefined });
  void resumeJob(id);
  return NextResponse.json({ job: resumed }, { status: 202 });
}
