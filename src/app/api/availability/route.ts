import { NextRequest, NextResponse } from "next/server";
import { getAvailability } from "@/server/booking-queries";
import { Period, canCheckInSameDay } from "@/server/booking-policy";

const PERIODS: Period[] = ["morning", "afternoon", "full_day"];

// Read-only availability hint for the Book screen (free desk/parking counts for
// a date + period). Authoritative allocation still happens on booking.
export async function GET(req: NextRequest) {
  const workDate = req.nextUrl.searchParams.get("workDate");
  const period = req.nextUrl.searchParams.get("period") as Period | null;

  if (!workDate || !period || !PERIODS.includes(period)) {
    return NextResponse.json({ error: "missing_or_invalid_params" }, { status: 400 });
  }

  const result = await getAvailability(workDate, period);
  if (!result) {
    return NextResponse.json({ error: "invalid_date" }, { status: 422 });
  }
  if (!canCheckInSameDay(workDate, period)) {
    return NextResponse.json({ error: "checkin_window_closed" }, { status: 409 });
  }
  return NextResponse.json(result, { status: 200 });
}
