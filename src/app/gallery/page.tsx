"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MediaLightbox } from "@/components/studio/media-lightbox";

type LibraryItem = {
  id: string;
  jobId: string;
  tool: string;
  label: string;
  kind: "image" | "audio" | "video" | "other";
  fileName: string;
  url: string;
  createdAt: string;
};

const KIND_CHIPS: { id: string; label: string }[] = [
  { id: "", label: "All" },
  { id: "image", label: "Images" },
  { id: "audio", label: "Audio" },
  { id: "video", label: "Video" },
];

const SORTS: { id: string; label: string }[] = [
  { id: "createdAt", label: "Newest" },
  { id: "name", label: "Name" },
  { id: "tool", label: "Tool" },
  { id: "kind", label: "Kind" },
  { id: "mtime", label: "Updated" },
];

const TOOL_LABEL: Record<string, string> = {
  image2: "Layout",
  dream: "Image",
  explainer: "Video",
  workflow: "Marketing",
  music: "Track",
  director: "Long form",
};

export default function GalleryPage() {
  const [entries, setEntries] = useState<LibraryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [kind, setKind] = useState("");
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMedia, setActiveMedia] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({
      sort,
      order,
      limit: "60",
    });
    if (kind) params.set("kind", kind);
    setLoading(true);
    setError(null);
    fetch(`/api/library?${params}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load the library");
        return r.json();
      })
      .then((d) => {
        setEntries(d.entries || []);
        setTotal(d.total || 0);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load the library");
        setEntries([]);
      })
      .finally(() => setLoading(false));
  }, [kind, sort, order]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-[#f5eff6]">
            Gallery
          </h1>
          <p className="text-[#b8aebb]">
            Finished pieces, sorted how you want them.
            {total ? ` ${total} on disk.` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs uppercase tracking-wider text-[#8d838f]">
            Sort
            <select
              className="ml-2 min-h-11 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-[#f5eff6]"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="min-h-11 rounded-lg border border-white/10 px-3 text-sm text-[#b8aebb]"
            onClick={() => setOrder((o) => (o === "desc" ? "asc" : "desc"))}
          >
            {order === "desc" ? "Descending" : "Ascending"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {KIND_CHIPS.map((chip) => (
          <button
            key={chip.id || "all"}
            type="button"
            onClick={() => setKind(chip.id)}
            className="min-h-11 rounded-full border px-4 text-sm transition-colors"
            style={{
              borderColor:
                kind === chip.id ? "#e77ae6" : "rgba(255,255,255,0.1)",
              background:
                kind === chip.id ? "rgba(231,122,230,0.12)" : "transparent",
              color: kind === chip.id ? "#f5eff6" : "#b8aebb",
            }}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-[#8d838f]">Loading the library…</p>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : !entries.length ? (
        <p className="text-sm text-[#8d838f]">
          Nothing here yet. Start with a{" "}
          <Link href="/" className="text-[#e77ae6]">
            layout
          </Link>{" "}
          or make an{" "}
          <Link href="/create" className="text-[#e77ae6]">
            image
          </Link>
          .
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {entries.map((entry) => (
            <article
              key={entry.id}
              className="overflow-hidden rounded-2xl border border-white/10 glass"
            >
              {entry.kind === "image" ? (
                <button
                  type="button"
                  onClick={() => setActiveMedia(entry.url)}
                  className="block w-full"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={entry.url}
                    alt={entry.label}
                    className="aspect-square w-full object-cover"
                  />
                </button>
              ) : entry.kind === "audio" ? (
                <div className="space-y-3 p-4">
                  <p className="text-sm text-[#f5eff6]">{entry.label}</p>
                  <audio
                    src={entry.url}
                    controls
                    preload="none"
                    className="w-full"
                  />
                </div>
              ) : entry.kind === "video" ? (
                <video
                  src={entry.url}
                  controls
                  playsInline
                  preload="metadata"
                  className="aspect-video w-full bg-black"
                />
              ) : (
                <div className="p-4 text-sm text-[#b8aebb]">{entry.label}</div>
              )}
              <div className="border-t border-white/5 px-3 py-2 text-xs text-[#8d838f]">
                {TOOL_LABEL[entry.tool] ?? entry.tool}
                {" · "}
                {new Date(entry.createdAt).toLocaleString()}
              </div>
            </article>
          ))}
        </div>
      )}
      <MediaLightbox
        items={entries
          .filter((entry) => entry.kind === "image" || entry.kind === "video")
          .map((entry) => ({
            url: entry.url,
            label: entry.label,
            kind: entry.kind === "video" ? "video" : "image",
          }))}
        activeUrl={activeMedia}
        onClose={() => setActiveMedia(null)}
        onActiveUrl={setActiveMedia}
      />
    </div>
  );
}
