import type { JobOutput } from "@/lib/adapters/types";

export type LibraryKind = "image" | "audio" | "video" | "other";

export function libraryKindFor(output: Pick<JobOutput, "kind" | "url">): LibraryKind | null {
  if (!output.url) return null;
  if (output.kind === "image") return "image";
  if (output.kind === "audio") return "audio";
  if (output.kind === "video") return "video";
  // Text / script / storyboard stay on the job record, not the media library.
  return null;
}

export function filenameFromOutputUrl(url: string): string | null {
  const marker = "/api/outputs/";
  const at = url.indexOf(marker);
  if (at < 0) return null;
  const name = url.slice(at + marker.length).split("?")[0];
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) {
    return null;
  }
  return name;
}
