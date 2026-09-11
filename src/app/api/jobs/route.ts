import { NextResponse } from "next/server";
import { createAndRunJob } from "@/lib/jobs/runner";
import { listJobs } from "@/lib/jobs/store";
import { promises as fs } from "fs";
import path from "path";
import { nanoid } from "nanoid";
import type { JobTool } from "@/lib/adapters/types";

export async function GET() {
  const jobs = await listJobs();
  return NextResponse.json({ jobs });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  let tool: JobTool = "workflow";
  let workflowSlug = "";
  let presetId = "";
  let inputs: Record<string, string> = {};
  let referenceImagePath: string | undefined;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    tool = (String(form.get("tool") || "workflow") as JobTool) || "workflow";
    workflowSlug = String(form.get("workflowSlug") || "");
    presetId = String(form.get("presetId") || "");
    inputs = JSON.parse(String(form.get("inputs") || "{}")) as Record<
      string,
      string
    >;
    const file = form.get("referenceImage");
    if (file && typeof file !== "string" && file.size > 0) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const ext = path.extname(file.name || "") || ".png";
      const name = `${nanoid(8)}${ext}`;
      const dest = path.join(process.cwd(), ".data", "uploads", name);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, bytes);
      referenceImagePath = dest;
      inputs.referenceImage = name;
    }
  } else {
    const body = (await request.json()) as {
      tool?: JobTool;
      workflowSlug: string;
      presetId: string;
      inputs: Record<string, string>;
    };
    tool = body.tool || "workflow";
    workflowSlug = body.workflowSlug;
    presetId = body.presetId;
    inputs = body.inputs || {};
  }

  if (!workflowSlug || !presetId) {
    return NextResponse.json(
      { error: "workflowSlug and presetId are required" },
      { status: 400 },
    );
  }

  try {
    const job = await createAndRunJob({
      tool,
      workflowSlug,
      presetId,
      inputs,
      referenceImagePath,
    });
    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create job",
      },
      { status: 500 },
    );
  }
}
