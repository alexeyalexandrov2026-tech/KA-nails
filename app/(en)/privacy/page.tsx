import { pageMetadata } from "../../../lib/seo";
import { PrivacyContent } from "../../../components/privacy-content";

export const metadata = pageMetadata("en", "privacy");

export default function EnglishPrivacyPage() {
  return <PrivacyContent locale="en" />;
}
