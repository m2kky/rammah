import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ahmed Rammah",
    short_name: "Rammah",
    start_url: "/",
    display: "standalone",
    background_color: "#02040A",
    theme_color: "#0F3B46",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
