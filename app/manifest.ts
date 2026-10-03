import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KA Nails",
    short_name: "KA Nails",
    description: "Pedicure studio KA Nails — portfolio, services and booking.",
    start_url: "/",
    display: "browser",
    background_color: "#fdf8f2",
    theme_color: "#fdf8f2",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
