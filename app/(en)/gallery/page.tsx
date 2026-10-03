import { pageMetadata } from "../../../lib/seo";
import { GalleryContent } from "../../../components/gallery-content";

export const metadata = pageMetadata("en", "gallery");

export default function EnglishGalleryPage() {
  return <GalleryContent locale="en" />;
}
