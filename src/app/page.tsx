import { BookingForm } from "./components/booking-form";

export default function Home() {
  const halfDayEnabled = process.env.HALF_DAY_BOOKING_ENABLED !== "false";
  return <BookingForm halfDayEnabled={halfDayEnabled} />;
}
