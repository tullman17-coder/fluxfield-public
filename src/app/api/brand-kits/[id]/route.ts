import { NextResponse } from "next/server";
import {
  deleteBrandKit,
  getBrandKit,
  saveBrandKit,
} from "@/lib/brand-kits/store";
import type { BrandKitInput } from "@/lib/brand-kits/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const kit = await getBrandKit(id);
  if (!kit) {
    return NextResponse.json({ error: "Brand kit not found" }, { status: 404 });
  }
  return NextResponse.json({ kit });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const existing = await getBrandKit(id);
  if (!existing) {
    return NextResponse.json({ error: "Brand kit not found" }, { status: 404 });
  }
  try {
    const body = (await request.json()) as Partial<BrandKitInput>;
    const kit = await saveBrandKit({
      id,
      name: body.name ?? existing.name,
      palette: body.palette,
      fonts: body.fonts,
      tone: body.tone,
      logoPath: body.logoPath,
    });
    return NextResponse.json({ kit });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not update brand kit",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const existing = await getBrandKit(id);
  if (!existing) {
    return NextResponse.json({ error: "Brand kit not found" }, { status: 404 });
  }
  await deleteBrandKit(id);
  return NextResponse.json({ ok: true });
}
