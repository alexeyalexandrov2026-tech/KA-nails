import { pageMetadata } from "../../../lib/seo";
import { BookContent } from "../../../components/book-content";

export const metadata = pageMetadata("ru", "book");

export default function RussianBookPage() {
  return <BookContent locale="ru" />;
}
