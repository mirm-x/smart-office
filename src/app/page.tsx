import { BookingForm } from "./components/booking-form";

export const dynamic = "force-dynamic";

export default function Home() {
  const halfDayEnabled = process.env.HALF_DAY_BOOKING_ENABLED === "true";
  return <BookingForm halfDayEnabled={halfDayEnabled} />;
}
