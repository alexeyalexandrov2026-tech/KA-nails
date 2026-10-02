import type { Metadata } from "next";
import { BookContent } from "../../../components/book-content";

export const metadata: Metadata = {
  title: "Запись на процедуру",
  description:
    "Запись на услуги маникюра и педикюра в студию KA Nails после запуска онлайн-бронирования.",
  alternates: {
    canonical: "https://ka-nails.pages.dev/ru/book/",
    languages: {
      en: "https://ka-nails.pages.dev/book/",
      ru: "https://ka-nails.pages.dev/ru/book/",
    },
  },
};

export default function RussianBookPage() {
  return <BookContent locale="ru" />;
}
