import { NextResponse } from "next/server";
import { listLibrary, type LibrarySort } from "@/lib/library/index";
import type { LibraryKind } from "@/lib/library/kinds";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sort = (searchParams.get("sort") as LibrarySort) || "createdAt";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";
  const kindParam = searchParams.get("kind");
  const kind = kindParam ? (kindParam as LibraryKind) : undefined;
  const tool = searchParams.get("tool") || undefined;
  const limit = Number(searchParams.get("limit") || 60);
  const offset = Number(searchParams.get("offset") || 0);

  const { entries, total } = await listLibrary({
    sort,
    order,
    kind,
    tool,
    limit,
    offset,
  });

  return NextResponse.json({
    entries: entries.map((e) => ({
      ...e,
      url: `/api/library/${e.relativePath
        .split(/[/\\]/)
        .map(encodeURIComponent)
        .join("/")}`,
    })),
    total,
  });
}
