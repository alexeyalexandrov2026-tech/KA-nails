import { pageMetadata } from "../../lib/seo";
import { HomePageContent } from "../../components/home-page-content";

export const metadata = pageMetadata("en", "home");

export default function EnglishHomePage() {
  return <HomePageContent locale="en" />;
}
