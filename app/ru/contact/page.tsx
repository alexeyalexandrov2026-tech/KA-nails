import { pageMetadata } from "../../../lib/seo";
import { ContactContent } from "../../../components/contact-content";

export const metadata = pageMetadata("ru", "contact");

export default function RussianContactPage() {
  return <ContactContent locale="ru" />;
}
