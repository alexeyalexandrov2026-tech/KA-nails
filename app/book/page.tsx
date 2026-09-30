import type { Metadata } from "next";
import { BookingPanel } from "../../components/booking-panel";
export const metadata: Metadata = { title: "Book an appointment" };
export default function Book() {
  return (
    <div className="page">
      <p className="eyebrow">Your studio appointment</p>
      <h1>A time for you.</h1>
      <BookingPanel />
    </div>
  );
}
