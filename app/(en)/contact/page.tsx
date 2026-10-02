import type { Metadata } from "next";
import { ContactContent } from "../../../components/contact-content";

export const metadata: Metadata = {
  title: "Studio information",
  description:
    "Studio address, contact details and opening hours for KA Nails Nail Studio.",
  alternates: {
    canonical: "https://ka-nails.pages.dev/contact/",
    languages: {
      en: "https://ka-nails.pages.dev/contact/",
      ru: "https://ka-nails.pages.dev/ru/contact/",
    },
  },
};

export default function EnglishContactPage() {
  return <ContactContent locale="en" />;
}
