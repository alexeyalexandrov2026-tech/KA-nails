import { pageMetadata } from "../../../lib/seo";
import { PrivacyContent } from "../../../components/privacy-content";

export const metadata = pageMetadata("ru", "privacy");

export default function RussianPrivacyPage() {
  return <PrivacyContent locale="ru" />;
}
