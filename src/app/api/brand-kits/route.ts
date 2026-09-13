import { NextResponse } from "next/server";
import { listBrandKits, saveBrandKit } from "@/lib/brand-kits/store";
import type { BrandKitInput } from "@/lib/brand-kits/types";

export async function GET() {
  const kits = await listBrandKits();
  return NextResponse.json({ kits });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BrandKitInput;
    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 },
      );
    }
    const kit = await saveBrandKit(body);
    return NextResponse.json({ kit }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not create brand kit",
      },
      { status: 500 },
    );
  }
}
