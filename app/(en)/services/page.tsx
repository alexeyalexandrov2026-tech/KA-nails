import type { Metadata } from "next";
import { ServicesContent } from "../../../components/services-content";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Published services, prices and durations are shown in the studio's booking portal below.",
  alternates: {
    canonical: "https://ka-nails.pages.dev/services/",
    languages: {
      en: "https://ka-nails.pages.dev/services/",
      ru: "https://ka-nails.pages.dev/ru/services/",
    },
  },
};

export default function EnglishServicesPage() {
  return <ServicesContent locale="en" />;
}
