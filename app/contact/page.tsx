import type { Metadata } from "next";
export const metadata: Metadata = { title: "Studio information" };
export default function Contact() {
  return (
    <div className="page">
      <p className="eyebrow">KA Nails / Studio information</p>
      <h1>Stay close.</h1>
      <section className="notice">
        <h2>Studio details are coming soon.</h2>
        <p>
          The studio’s address, contact information and opening hours will
          appear here once they are confirmed.
        </p>
      </section>
    </div>
  );
}
