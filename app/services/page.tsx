import type { Metadata } from "next";
import { BookingPanel } from "../../components/booking-panel";
export const metadata: Metadata = { title: "Services" };
export default function Services() {
  return (
    <div className="page">
      <p className="eyebrow">The studio / Services</p>
      <h1>Choose your care.</h1>
      <p className="lead">
        Published services, prices and durations are shown in the studio’s
        booking below.
      </p>
      <BookingPanel />
    </div>
  );
}
