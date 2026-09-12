"use client";

import { useCallback, useEffect, useState } from "react";
import type { StudioJob } from "@/lib/adapters/types";

/**
 * A phone will happily throw a background tab away to reclaim memory, and it
 * stops running timers the moment the screen locks. The work itself keeps going
 * on the machine doing the rendering, so all that is ever lost is the page's
 * hold on it. This remembers which piece is in progress and picks it back up.
 */

/** How long a remembered piece is still worth reopening. */
const STILL_INTERESTING_MS = 6 * 60 * 60 * 1000;

function inProgress(job: StudioJob | null): boolean {
  return !!job && (job.status === "queued" || job.status === "running");
}

export function useJobWatch(scope: string, intervalMs = 1200) {
  const [job, setJobState] = useState<StudioJob | null>(null);
  const [onScreen, setOnScreen] = useState(true);
  const memory = `fluxfield:job:${scope}`;

  const setJob = useCallback(
    (next: StudioJob | null) => {
      setJobState(next);
      try {
        if (next) window.sessionStorage.setItem(memory, next.id);
        else window.sessionStorage.removeItem(memory);
      } catch {
        // Private browsing refuses the write. Everything still works for as
        // long as the page survives, which is the common case anyway.
      }
    },
    [memory],
  );

  useEffect(() => {
    let id: string | null = null;
    try {
      id = window.sessionStorage.getItem(memory);
    } catch {
      return;
    }
    if (!id) return;

    let dropped = false;
    fetch(`/api/jobs/${id}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { job: StudioJob } | null) => {
        if (dropped || !data?.job) return;
        const age = Date.now() - new Date(data.job.updatedAt).getTime();
        if (age > STILL_INTERESTING_MS) {
          try {
            window.sessionStorage.removeItem(memory);
          } catch {}
          return;
        }
        // Never step on something started while this was in flight.
        setJobState((current) => current ?? data.job);
      })
      .catch(() => undefined);

    return () => {
      dropped = true;
    };
  }, [memory]);

  useEffect(() => {
    const read = () => setOnScreen(document.visibilityState === "visible");
    read();
    document.addEventListener("visibilitychange", read);
    return () => document.removeEventListener("visibilitychange", read);
  }, []);

  const id = job?.id;
  const open = inProgress(job);

  useEffect(() => {
    if (!id || !open || !onScreen) return;
    let dropped = false;

    const read = async () => {
      try {
        const res = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
        if (!res.ok || dropped) return;
        const data = (await res.json()) as { job: StudioJob };
        if (!dropped) setJobState(data.job);
      } catch {
        // A dropped signal is normal on a phone. The next tick tries again.
      }
    };

    // Catch up straight away, so coming back to the tab shows where things
    // actually stand rather than the state from before the screen locked.
    read();
    const timer = setInterval(read, intervalMs);
    return () => {
      dropped = true;
      clearInterval(timer);
    };
  }, [id, open, onScreen, intervalMs]);

  return { job, setJob };
}
