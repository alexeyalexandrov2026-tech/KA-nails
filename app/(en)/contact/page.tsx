import { pageMetadata } from "../../../lib/seo";
import { ContactContent } from "../../../components/contact-content";

export const metadata = pageMetadata("en", "contact");

export default function EnglishContactPage() {
  return <ContactContent locale="en" />;
}
