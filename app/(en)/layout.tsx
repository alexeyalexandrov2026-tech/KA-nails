import type { Metadata } from "next";
import { SiteLayout } from "../../components/site-layout";
import { layoutMetadata } from "../../lib/seo";
import "../fonts.css";
import "../globals.css";

export const metadata: Metadata = layoutMetadata("en");

export default function EnglishRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SiteLayout locale="en">{children}</SiteLayout>;
}
