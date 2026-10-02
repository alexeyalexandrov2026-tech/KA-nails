import type { Metadata } from "next";
import { GalleryContent } from "../../../components/gallery-content";

export const metadata: Metadata = {
  title: "Галерея — Избранные работы студии",
  description:
    "Подлинное портфолио педикюра и ногтевой эстетики студии KA Nails. Глубокий винный глянец, королевский кобальт, френч и внимательный уход.",
  alternates: {
    canonical: "https://ka-nails.pages.dev/ru/gallery/",
    languages: {
      en: "https://ka-nails.pages.dev/gallery/",
      ru: "https://ka-nails.pages.dev/ru/gallery/",
    },
  },
};

export default function RussianGalleryPage() {
  return <GalleryContent locale="ru" />;
}
