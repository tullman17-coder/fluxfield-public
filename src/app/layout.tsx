import type { Metadata, Viewport } from "next";
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
  title: {
    default: "Fluxfield",
    template: "%s · Fluxfield",
  },
  description:
    "Make key art, campaign layouts, and short explainer videos from a single brief.",
  applicationName: "Fluxfield",
  appleWebApp: {
    capable: true,
    title: "Fluxfield",
    // The rail runs to the top of the screen, so the clock and battery sit
    // over it rather than on a bar of their own.
    statusBarStyle: "black-translucent",
  },
  // Phones try to turn anything that looks like a phone number, date or address
  // into a link, which mangles prompts and generated copy.
  formatDetection: { telephone: false, date: false, address: false, email: false },
  other: {
    // Next writes the standardised `mobile-web-app-capable`, which only iOS 17
    // and up reads. Older iPhones need the original spelling to open the saved
    // app without Safari's address bar on top of it.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Let the page reach into the rounded corners and under the notch; the shell
  // holds its own content back using the insets the device reports.
  viewportFit: "cover",
  themeColor: "#0b0910",
  // Pinch-zoom stays available. Locking it out breaks the app for anyone who
  // needs to magnify, and costs nothing now that fields no longer trigger it.
  maximumScale: 5,
  userScalable: true,
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
