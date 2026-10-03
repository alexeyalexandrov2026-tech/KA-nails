import type { Metadata } from "next";
import { SiteLayout } from "../../components/site-layout";
import "../fonts.css";
import "../globals.css";

export const metadata: Metadata = {
  title: {
    default: "KA Nails",
    template: "%s | KA Nails",
  },
  description:
    "Педикюр в студии KA Nails. Познакомьтесь с услугами студии и запишитесь на процедуру после открытия онлайн-записи.",
  robots: { index: false, follow: false },
  alternates: {
    canonical: "https://ka-nails.pages.dev/ru/",
    languages: {
      en: "https://ka-nails.pages.dev/",
      ru: "https://ka-nails.pages.dev/ru/",
    },
  },
};

export default function RussianRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SiteLayout locale="ru">{children}</SiteLayout>;
}
