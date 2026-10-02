import type { Metadata } from "next";
import { GalleryArchive } from "../../components/gallery-archive";

export const metadata: Metadata = {
  title: "Gallery — Curated Studio Works",
  description:
    "Explore authentic salon pedicure artistry, deep bordeaux gloss, royal cobalt, pastel lilac, and attentive care by KA Nails.",
};

export default function GalleryPage() {
  return (
    <div className="gallery-page-container">
      <header className="gallery-page-header">
        <p className="eyebrow">KA Nails / Studio Exhibition</p>
        <h1 className="gallery-page-title">
          Curated Nail Artistry &amp; Pedicure Portfolio
        </h1>
        <p className="gallery-page-lead">
          Explore our archive of authentic studio works. From refined French
          lines and deep bordeaux gloss to restorative aesthetic care and
          attentive salon detailing.
        </p>
      </header>

      <GalleryArchive />
    </div>
  );
}
