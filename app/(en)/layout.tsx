import type { Metadata } from "next";
import { SiteLayout } from "../../components/site-layout";
import "../globals.css";

export const metadata: Metadata = {
  title: { default: "KA Nails — Nail Studio", template: "%s | KA Nails" },
  description:
    "KA Nails Nail Studio. Explore services and reserve an appointment when online booking becomes available.",
  robots: { index: false, follow: false },
  alternates: {
    canonical: "https://ka-nails.pages.dev/",
    languages: {
      en: "https://ka-nails.pages.dev/",
      ru: "https://ka-nails.pages.dev/ru/",
    },
  },
};

export default function EnglishRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SiteLayout locale="en">{children}</SiteLayout>;
}
