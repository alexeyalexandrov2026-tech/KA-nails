import type { Metadata } from "next";
import { BookContent } from "../../../components/book-content";

export const metadata: Metadata = {
  title: "Book an appointment",
  description:
    "Explore services and check appointment availability for KA Nails Nail Studio.",
  alternates: {
    canonical: "https://ka-nails.pages.dev/book/",
    languages: {
      en: "https://ka-nails.pages.dev/book/",
      ru: "https://ka-nails.pages.dev/ru/book/",
    },
  },
};

export default function EnglishBookPage() {
  return <BookContent locale="en" />;
}
