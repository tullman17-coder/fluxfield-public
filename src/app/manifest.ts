import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fieldbench",
    short_name: "Fieldbench",
    description:
      "Make key art, campaign layouts, music and short films from a single brief, on the machines you run yourself.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0b0910",
    theme_color: "#0b0910",
    categories: ["graphics", "productivity", "photo"],
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Make an image", url: "/create" },
      { name: "Layouts", url: "/" },
      { name: "Music", url: "/music" },
    ],
  };
}
