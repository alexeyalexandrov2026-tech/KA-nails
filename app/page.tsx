import Link from "next/link";
import { HeroCollage } from "../components/hero-collage";
import { HomeMovingWall } from "../components/home-moving-wall";

export default function Home() {
  return (
    <>
      {/* Asymmetric Studio Hero */}
      <HeroCollage />

      {/* Moving Wall Showcase of Curated Nail Art */}
      <HomeMovingWall />

      {/* Editorial Studio Standards Section */}
      <section
        className="editorial-pillars"
        aria-label="Studio Standards and Philosophy"
      >
        <div className="pillars-intro">
          <p className="eyebrow">03 / The Studio Standard</p>
          <h2 className="section-title">
            Attentive care.
            <br />
            Curated presentation.
          </h2>
          <p className="lead">
            Every set in our portfolio reflects thoughtful craftsmanship, clean
            application, and respect for natural nail health.
          </p>
        </div>

        <div className="pillars-grid">
          <article className="pillar-card">
            <span className="pillar-num" aria-hidden="true">
              01
            </span>
            <h3 className="pillar-title">Curated Color &amp; Finish</h3>
            <p className="pillar-text">
              Rich pigments, high-gloss lacquers, and refined finishes selected
              to complement your skin tone and personal aesthetic.
            </p>
          </article>

          <article className="pillar-card">
            <span className="pillar-num" aria-hidden="true">
              02
            </span>
            <h3 className="pillar-title">Clean Application</h3>
            <p className="pillar-text">
              Precise edging and seamless coats designed for elegant wear and
              lasting aesthetic appeal.
            </p>
          </article>

          <article className="pillar-card">
            <span className="pillar-num" aria-hidden="true">
              03
            </span>
            <h3 className="pillar-title">Professional Cleanliness</h3>
            <p className="pillar-text">
              Carefully sanitized implements and dedicated station care prepared
              for every client visit.
            </p>
          </article>
        </div>
      </section>

      {/* Signature Services Showcase */}
      <section
        className="services-showcase"
        aria-label="Signature Studio Services"
      >
        <div className="services-showcase-header">
          <div>
            <p className="eyebrow">04 / Studio Portfolio</p>
            <h2 className="section-title">Styles &amp; Treatments</h2>
          </div>
          <Link href="/services/" className="button-secondary">
            View service information <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="services-preview-grid">
          <div className="service-preview-card">
            <div className="service-card-meta">
              <span className="service-tag">Classic</span>
              <span className="service-duration">Curated</span>
            </div>
            <h3 className="service-name">Classic Pedicure Artistry</h3>
            <p className="service-desc">
              Timeless deep bordeaux, neutral porcelain tones, and clean
              contours captured in our studio portfolio.
            </p>
            <Link href="/gallery/" className="service-book-link">
              Explore in gallery <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="service-preview-card featured">
            <div className="service-card-meta">
              <span className="service-tag highlight">Featured</span>
              <span className="service-duration">Curated</span>
            </div>
            <h3 className="service-name">French &amp; Accent Detailing</h3>
            <p className="service-desc">
              Refined smile lines, delicate bow motifs, and accent rings
              showcased in authentic salon photography.
            </p>
            <Link href="/gallery/" className="service-book-link">
              Explore in gallery <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="service-preview-card">
            <div className="service-card-meta">
              <span className="service-tag">Color</span>
              <span className="service-duration">Curated</span>
            </div>
            <h3 className="service-name">Vibrant Color &amp; Shimmer</h3>
            <p className="service-desc">
              Royal cobalt gloss, cornflower drape, pastel lilac bliss, and rose
              shimmer lacquer finishes.
            </p>
            <Link href="/gallery/" className="service-book-link">
              Explore in gallery <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Final Booking Callout */}
      <section
        className="final-booking-band"
        aria-label="Studio Portfolio & Appointments"
      >
        <div className="final-booking-inner">
          <p className="eyebrow">Studio Appointments</p>
          <h2 className="final-title">
            Crafted with care.
            <br />
            Captured in detail.
          </h2>
          <p className="final-desc">
            Explore our curated gallery of 19 verified salon works. Online
            booking will open once scheduling details are finalized with the
            studio.
          </p>
          <div className="final-actions">
            <Link href="/services/" className="button final-btn">
              View booking status <span aria-hidden="true">↗</span>
            </Link>
            <Link
              href="/gallery/"
              className="button-secondary final-btn-secondary"
            >
              Explore the curated gallery <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
