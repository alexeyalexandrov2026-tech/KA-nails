import { pageMetadata } from "../../lib/seo";
import { HomePageContent } from "../../components/home-page-content";

export const metadata = pageMetadata("ru", "home");

export default function RussianHomePage() {
  return <HomePageContent locale="ru" />;
}
