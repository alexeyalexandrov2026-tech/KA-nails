import { pageMetadata } from "../../../lib/seo";
import { ServicesContent } from "../../../components/services-content";

export const metadata = pageMetadata("ru", "services");

export default function RussianServicesPage() {
  return <ServicesContent locale="ru" />;
}
