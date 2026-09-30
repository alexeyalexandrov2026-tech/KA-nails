import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">KA Nails · Nail Studio</p>
          <h1>
            A little care.
            <br />A moment for you.
          </h1>
          <p className="lead">Your next appointment begins here.</p>
          <Link href="/services/" className="button">
            Explore services <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <div className="logo-field">
          <Image
            src="/assets/ka-nails-logo.png"
            alt="KA Nails Nail Studio"
            width={1254}
            height={1254}
            priority
            unoptimized
            sizes="(max-width: 767px) 86vw, 44vw"
          />
        </div>
      </section>
      <section className="editorial">
        <p className="eyebrow">01 / Your appointment</p>
        <div>
          <h2>
            Choose your care.
            <br />
            Find your time.
          </h2>
          <p>
            Explore the studio’s published services, choose an available time
            and review your appointment before confirming.
          </p>
          <Link href="/book/" className="text-link">
            Start your appointment <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
    </>
  );
}
