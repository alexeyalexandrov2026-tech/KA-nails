import { pageMetadata } from "../../../lib/seo";
import { BookContent } from "../../../components/book-content";

export const metadata = pageMetadata("en", "book");

export default function EnglishBookPage() {
  return <BookContent locale="en" />;
}
