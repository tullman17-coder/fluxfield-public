import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { StudioShell } from "@/components/studio/shell";
import "./globals.css";

const sans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fieldbench — local dream workbench + Image-2 wrappers",
  description:
    "Dream Studio workbench, marketing wrappers, and explainer studio for offline Local Studio / ComfyUI / Ollama / TTS machines.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} h-full dark`}
    >
      <body className="min-h-full font-sans antialiased">
        <StudioShell>{children}</StudioShell>
      </body>
    </html>
  );
}
