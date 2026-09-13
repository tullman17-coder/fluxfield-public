"use client";

import { useState } from "react";
import type { StudioJob } from "@/lib/adapters/types";

export function ZermoJobStatus({ job, onResume }: { job: StudioJob | null; onResume: (job: StudioJob) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (job?.generationMode !== "zermo") return null;
  async function resume() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/jobs/${job!.id}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not reconnect");
      onResume(data.job);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not reconnect"); }
    finally { setBusy(false); }
  }
  return <div className="my-3 break-all text-xs text-[#b8aebb]" role="status">
    <p>Zermo API · no preview fallback</p>
    {Object.entries(job.zermoJobs || {}).map(([purpose, remote]) => <p key={purpose}>{purpose}: {remote.state || "submission pending"} · {remote.remoteId || "intent saved"}</p>)}
    {job.status === "failed" ? <button type="button" disabled={busy} onClick={() => void resume()} className="my-2 min-h-11 rounded border border-white/20 px-3">{busy ? "Reconnecting…" : "Resume same job (no new render)"}</button> : null}
    {error ? <p role="alert">{error}</p> : null}
  </div>;
}
