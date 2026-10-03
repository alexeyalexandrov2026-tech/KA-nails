import type { Metadata } from "next";
import { SiteLayout } from "../../components/site-layout";
import { layoutMetadata } from "../../lib/seo";
import "../fonts.css";
import "../globals.css";

export const metadata: Metadata = layoutMetadata("ru");

export default function RussianRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SiteLayout locale="ru">{children}</SiteLayout>;
}
