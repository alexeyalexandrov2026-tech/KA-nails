import { pageMetadata } from "../../../lib/seo";
import { ServicesContent } from "../../../components/services-content";

export const metadata = pageMetadata("en", "services");

export default function EnglishServicesPage() {
  return <ServicesContent locale="en" />;
}
