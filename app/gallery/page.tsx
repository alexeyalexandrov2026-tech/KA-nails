import type { Metadata } from "next";
import { GalleryArchive } from "../../components/gallery-archive";

export const metadata: Metadata = {
  title: "Gallery — 36 Curated Nail Art Works",
  description:
    "Explore 36 bespoke nail art designs, micro-French manicures, glazed chrome finishes, and structured gel architecture by KA Nails.",
};

export default function GalleryPage() {
  return (
    <div className="gallery-page-container">
      <header className="gallery-page-header">
        <p className="eyebrow">KA Nails / Studio Exhibition</p>
        <h1 className="gallery-page-title">
          Curated Nail Artistry &amp; Architectural Gel
        </h1>
        <p className="gallery-page-lead">
          Explore our permanent archive of 36 handcrafted studio designs. From
          refined micro-French lines and glazed chrome powders to dimensional 3D
          gel droplets and flawless Russian e-file cuticle care.
        </p>
      </header>

      <GalleryArchive />
    </div>
  );
}
