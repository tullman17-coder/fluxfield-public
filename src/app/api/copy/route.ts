import { NextResponse } from "next/server";
import { readSettings } from "@/lib/settings";
import {
  fallbackMarketingCopy,
  generateMarketingCopy,
} from "@/lib/adapters/ollama";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    brandName?: string;
    productName?: string;
    productDescription?: string;
    wrapperName?: string;
    presetLabel?: string;
  };

  const brandName = body.brandName?.trim() || "Brand";
  const productName = body.productName?.trim() || "Product";

  const args = {
    wrapperName: body.wrapperName?.trim() || "superComputer",
    presetLabel: body.presetLabel?.trim() || "Key art",
    brandName,
    productName,
    productDescription: body.productDescription?.trim() || "",
  };

  const settings = await readSettings();
  const copy =
    (await generateMarketingCopy(settings, args)) ?? fallbackMarketingCopy(args);

  return NextResponse.json({ copy });
}
