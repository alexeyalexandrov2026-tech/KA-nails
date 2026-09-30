import { approvedBookingUrl } from "../lib/booking-url";

export function BookingPanel() {
  const url = approvedBookingUrl(process.env.NEXT_PUBLIC_GORGONA_BOOKING_URL);
  if (!url)
    return (
      <section className="notice" aria-labelledby="booking-state">
        <p className="eyebrow">Online appointments</p>
        <h2 id="booking-state">Online booking is not available yet.</h2>
        <p>
          Services, prices and available appointments will appear here when the
          studio opens online booking.
        </p>
      </section>
    );
  return (
    <section aria-label="Studio booking" className="booking-panel">
      <p className="booking-help">
        Choose your service and appointment below. You can also{" "}
        <a href={url} target="_blank" rel="noopener noreferrer">
          open booking in a full page
        </a>
        .
      </p>
      <iframe
        src={url}
        title="KA Nails appointment booking"
        sandbox="allow-scripts allow-forms allow-same-origin"
        referrerPolicy="no-referrer"
        className="booking-frame"
      />
    </section>
  );
}
