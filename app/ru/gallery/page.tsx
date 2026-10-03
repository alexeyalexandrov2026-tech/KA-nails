import { pageMetadata } from "../../../lib/seo";
import { GalleryContent } from "../../../components/gallery-content";

export const metadata = pageMetadata("ru", "gallery");

export default function RussianGalleryPage() {
  return <GalleryContent locale="ru" />;
}
