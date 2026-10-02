import type { Metadata } from "next";
import { GalleryContent } from "../../../components/gallery-content";

export const metadata: Metadata = {
  title: "Gallery — Curated Studio Works",
  description:
    "Explore authentic salon pedicure artistry, deep bordeaux gloss, royal cobalt, pastel lilac, and attentive care by KA Nails.",
  alternates: {
    canonical: "https://ka-nails.pages.dev/gallery/",
    languages: {
      en: "https://ka-nails.pages.dev/gallery/",
      ru: "https://ka-nails.pages.dev/ru/gallery/",
    },
  },
};

export default function EnglishGalleryPage() {
  return <GalleryContent locale="en" />;
}
