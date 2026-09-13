import { promises as fs } from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { DATA_ROOT } from "@/lib/data/paths";
import type { BrandKit, BrandKitInput, BrandPalette } from "./types";

const BRAND_KITS_DIR = path.join(DATA_ROOT, "brand-kits");

const DEFAULT_PALETTE: BrandPalette = {
  primary: "#d565d6",
  secondary: "#2c162f",
  accent: "#e77ae6",
  surface: "#1a0f1c",
  text: "#f5eff6",
};

function kitDir(id: string) {
  return path.join(BRAND_KITS_DIR, id);
}

function kitJsonPath(id: string) {
  return path.join(kitDir(id), "kit.json");
}

async function ensureRoot() {
  await fs.mkdir(BRAND_KITS_DIR, { recursive: true });
}

async function readKitFile(id: string): Promise<BrandKit | null> {
  try {
    const raw = await fs.readFile(kitJsonPath(id), "utf8");
    return JSON.parse(raw) as BrandKit;
  } catch {
    return null;
  }
}

export async function listBrandKits(): Promise<BrandKit[]> {
  await ensureRoot();
  let entries: string[];
  try {
    entries = await fs.readdir(BRAND_KITS_DIR);
  } catch {
    return [];
  }
  const kits: BrandKit[] = [];
  for (const id of entries) {
    const kit = await readKitFile(id);
    if (kit) kits.push(kit);
  }
  kits.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return kits;
}

export async function getBrandKit(id: string): Promise<BrandKit | null> {
  if (!id) return null;
  return readKitFile(id);
}

export async function saveBrandKit(
  input: BrandKitInput & { id?: string },
): Promise<BrandKit> {
  await ensureRoot();
  const now = new Date().toISOString();
  const existing = input.id ? await readKitFile(input.id) : null;
  const id = existing?.id ?? input.id ?? nanoid(10);

  const kit: BrandKit = {
    id,
    name: (input.name || existing?.name || "Untitled kit").trim(),
    palette: {
      ...DEFAULT_PALETTE,
      ...existing?.palette,
      ...input.palette,
    },
    fonts: input.fonts ?? existing?.fonts,
    tone: (input.tone ?? existing?.tone ?? "clear and confident").trim(),
    logoPath: input.logoPath ?? existing?.logoPath,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await fs.mkdir(kitDir(id), { recursive: true });
  await fs.writeFile(kitJsonPath(id), JSON.stringify(kit, null, 2));
  return kit;
}

export async function deleteBrandKit(id: string): Promise<boolean> {
  const dir = kitDir(id);
  try {
    await fs.rm(dir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

/** Persist an optional logo next to kit.json and return the relative path. */
export async function saveBrandKitLogo(
  id: string,
  bytes: Buffer,
  ext = ".png",
): Promise<string> {
  await fs.mkdir(kitDir(id), { recursive: true });
  const safeExt = ext.startsWith(".") ? ext : `.${ext}`;
  const filename = `logo${safeExt}`;
  await fs.writeFile(path.join(kitDir(id), filename), bytes);
  const logoPath = path.join("brand-kits", id, filename);
  const kit = await readKitFile(id);
  if (kit) {
    kit.logoPath = logoPath;
    kit.updatedAt = new Date().toISOString();
    await fs.writeFile(kitJsonPath(id), JSON.stringify(kit, null, 2));
  }
  return logoPath;
}
