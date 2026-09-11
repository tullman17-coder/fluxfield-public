"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { StudioJob } from "@/lib/adapters/types";

export default function GalleryPage() {
  const [jobs, setJobs] = useState<StudioJob[]>([]);

  useEffect(() => {
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((d) => setJobs(d.jobs || []))
      .catch(() => undefined);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-white">
          Gallery
        </h1>
        <p className="text-zinc-400">Recent wrapper + explainer runs.</p>
      </div>

      {!jobs.length ? (
        <p className="text-sm text-zinc-500">
          No jobs yet. Open an{" "}
          <Link href="/" className="text-[#c8f135]">
            Image-2 wrapper
          </Link>{" "}
          or the{" "}
          <Link href="/explainer" className="text-[#c8f135]">
            Explainer
          </Link>
          .
        </p>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <article
              key={job.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div>
                  <span className="text-white">{job.workflowName}</span>
                  <span className="text-zinc-500"> · {job.presetLabel}</span>
                  <span className="ml-2 rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400">
                    {job.tool}
                  </span>
                </div>
                <span className="text-zinc-500">
                  {job.status} · {job.modeUsed}
                </span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3 md:grid-cols-4">
                {job.outputs
                  .filter((o) => o.url && o.kind === "image")
                  .map((o) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={o.id}
                      src={o.url}
                      alt={o.label}
                      className="aspect-square rounded-xl object-cover"
                    />
                  ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
