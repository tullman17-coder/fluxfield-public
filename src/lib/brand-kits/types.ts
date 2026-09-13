export type BrandPalette = {
  primary: string;
  secondary: string;
  accent: string;
  surface: string;
  text: string;
};

export type BrandFonts = {
  display?: string;
  body?: string;
};

export type BrandKit = {
  id: string;
  name: string;
  palette: BrandPalette;
  fonts?: BrandFonts;
  tone: string;
  logoPath?: string;
  createdAt: string;
  updatedAt: string;
};

export type BrandKitInput = {
  name: string;
  palette?: Partial<BrandPalette>;
  fonts?: BrandFonts;
  tone?: string;
  logoPath?: string;
};
