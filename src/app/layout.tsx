import type { Metadata } from "next";
import { Syne, Manrope } from "next/font/google";
import { StudioShell } from "@/components/studio/shell";
import "./globals.css";

const display = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const sans = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fieldbench — local Image-2 wrappers + Explainer",
  description:
    "Higgsfield-style marketing wrappers and explainer studio for offline ComfyUI / Ollama / TTS machines.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} h-full dark`}
    >
      <body className="min-h-full font-sans antialiased">
        <StudioShell>{children}</StudioShell>
      </body>
    </html>
  );
}
