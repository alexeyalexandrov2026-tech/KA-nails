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
            Meticulous craft.
            <br />
            Uncompromised hygiene.
          </h2>
          <p className="lead">
            Every appointment is an unhurried, private experience centered on
            the integrity of your natural nails.
          </p>
        </div>

        <div className="pillars-grid">
          <article className="pillar-card">
            <span className="pillar-num" aria-hidden="true">
              01
            </span>
            <h3 className="pillar-title">Russian &amp; Japanese Precision</h3>
            <p className="pillar-text">
              Dry hardware cuticle detailing clears micro-dead skin gently
              without soaking, allowing the gel base to seal seamlessly beneath
              the proximal nail fold for up to 4+ weeks of clean regrowth.
            </p>
          </article>

          <article className="pillar-card">
            <span className="pillar-num" aria-hidden="true">
              02
            </span>
            <h3 className="pillar-title">Structured BIAB Reinforcement</h3>
            <p className="pillar-text">
              We engineer an anatomical apex using premium Japanese soak-off
              builder gels (BIAB). Weak, brittle, or peeling natural nails grow
              out strong and protected without harsh MMA or heavy acrylics.
            </p>
          </article>

          <article className="pillar-card">
            <span className="pillar-num" aria-hidden="true">
              03
            </span>
            <h3 className="pillar-title">Hospital-Grade Sterilization</h3>
            <p className="pillar-text">
              Every metal drill bit and implement undergoes medical-grade
              ultrasonic bathing and class-B autoclave sterilization, sealed in
              sterile indicator pouches opened exclusively in front of you.
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
            <p className="eyebrow">04 / Signature Care</p>
            <h2 className="section-title">Services &amp; Rituals</h2>
          </div>
          <Link href="/services/" className="button-secondary">
            View full menu <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="services-preview-grid">
          <div className="service-preview-card">
            <div className="service-card-meta">
              <span className="service-tag">Foundation</span>
              <span className="service-duration">75 min</span>
            </div>
            <h3 className="service-name">Structured BIAB Manicure</h3>
            <p className="service-desc">
              Precision dry e-file cuticle detailing, natural apex
              reinforcement, and single or dual sheer nude coats sealed with
              glass topcoat.
            </p>
            <Link href="/book/" className="service-book-link">
              Book this service <span aria-hidden="true">↗</span>
            </Link>
          </div>

          <div className="service-preview-card featured">
            <div className="service-card-meta">
              <span className="service-tag highlight">Signature Set</span>
              <span className="service-duration">90 min</span>
            </div>
            <h3 className="service-name">Glazed Chrome &amp; Micro-French</h3>
            <p className="service-desc">
              Structured gel foundation paired with our iconic micro-fine French
              smile lines, liquid metallic pigments, or pearl glazed donut
              finish.
            </p>
            <Link href="/book/" className="service-book-link">
              Book this service <span aria-hidden="true">↗</span>
            </Link>
          </div>

          <div className="service-preview-card">
            <div className="service-card-meta">
              <span className="service-tag">Artistry</span>
              <span className="service-duration">105 min</span>
            </div>
            <h3 className="service-name">Bespoke Tier Nail Art</h3>
            <p className="service-desc">
              Full custom set including hand-painted botanicals, organic
              tortoiseshell, gemstone marble veining, or 3D sculpted dew drop
              accents.
            </p>
            <Link href="/book/" className="service-book-link">
              Book this service <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Final Booking Callout */}
      <section
        className="final-booking-band"
        aria-label="Appointment Reservation"
      >
        <div className="final-booking-inner">
          <p className="eyebrow">Online Reservations</p>
          <h2 className="final-title">
            Reserve your chair.
            <br />
            Experience the difference.
          </h2>
          <p className="final-desc">
            Appointments are scheduled in advance to ensure dedicated,
            uninterrupted attention. Choose your service, find an available
            time, and receive instant confirmation.
          </p>
          <div className="final-actions">
            <Link href="/book/" className="button final-btn">
              Book an appointment <span aria-hidden="true">↗</span>
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
