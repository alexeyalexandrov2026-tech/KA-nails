import type { Metadata } from "next";
import { ServicesContent } from "../../../components/services-content";

export const metadata: Metadata = {
  title: "Услуги",
  description:
    "Список услуг, стоимость и длительность процедур будут опубликованы в модуле онлайн-записи студии KA Nails.",
  alternates: {
    canonical: "https://ka-nails.pages.dev/ru/services/",
    languages: {
      en: "https://ka-nails.pages.dev/services/",
      ru: "https://ka-nails.pages.dev/ru/services/",
    },
  },
};

export default function RussianServicesPage() {
  return <ServicesContent locale="ru" />;
}
