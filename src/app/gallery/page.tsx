"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { StudioJob } from "@/lib/adapters/types";

const KIND_LABEL: Record<string, string> = {
  image2: "Layout",
  dream: "Image",
  explainer: "Video",
  workflow: "Marketing",
  music: "Track",
  director: "Long form",
};

const STATUS_LABEL: Record<string, string> = {
  queued: "Starting",
  running: "Making",
  completed: "Done",
  failed: "Stopped",
};

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
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[#f5eff6]">
          Gallery
        </h1>
        <p className="text-[#b8aebb]">Everything you have made, newest first.</p>
      </div>

      {!jobs.length ? (
        <p className="text-sm text-[#8d838f]">
          Nothing here yet. Start with a{" "}
          <Link href="/" className="text-[#e77ae6]">
            layout
          </Link>{" "}
          or make an{" "}
          <Link href="/explainer" className="text-[#e77ae6]">
            explainer
          </Link>
          .
        </p>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <article
              key={job.id}
              className="rounded-2xl border border-white/10 glass p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div>
                  <span className="text-[#f5eff6]">{job.workflowName}</span>
                  <span className="text-[#8d838f]"> · {job.presetLabel}</span>
                  <span className="ml-2 rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#b8aebb]">
                    {KIND_LABEL[job.tool] ?? job.tool}
                  </span>
                </div>
                <span className="text-[#8d838f]">
                  {STATUS_LABEL[job.status] ?? job.status}
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
              {job.outputs
                .filter((o) => o.url && o.kind === "audio")
                .map((o) => (
                  <div key={o.id} className="mt-3">
                    <p className="mb-2 text-sm text-[#b8aebb]">{o.label}</p>
                    {/* Tracks are uncompressed and can run to tens of
                        megabytes, so nothing loads until it is played. */}
                    <audio
                      src={o.url}
                      controls
                      preload="none"
                      className="w-full"
                    />
                  </div>
                ))}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
