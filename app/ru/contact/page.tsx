import type { Metadata } from "next";
import { ContactContent } from "../../../components/contact-content";

export const metadata: Metadata = {
  title: "Информация о студии",
  description:
    "Адрес, контактные данные и часы работы студии маникюра и педикюра KA Nails.",
  alternates: {
    canonical: "https://ka-nails.pages.dev/ru/contact/",
    languages: {
      en: "https://ka-nails.pages.dev/contact/",
      ru: "https://ka-nails.pages.dev/ru/contact/",
    },
  },
};

export default function RussianContactPage() {
  return <ContactContent locale="ru" />;
}
