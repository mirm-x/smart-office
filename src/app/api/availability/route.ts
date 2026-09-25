import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAvailability } from "@/server/booking-queries";
import { Period, canCheckInSameDay } from "@/server/booking-policy";
import { SESSION_COOKIE, verifySession } from "@/server/identity";

const PERIODS: Period[] = ["morning", "afternoon", "full_day"];

// Read-only availability for the Book screen. Sign-in is required so the map
// can mark spaces held by the caller as `mine`. Allocation still happens on
// booking, where conflicts are checked again.
export async function GET(req: NextRequest) {
  const session = verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const workDate = req.nextUrl.searchParams.get("workDate");
  const period = req.nextUrl.searchParams.get("period") as Period | null;

  if (!workDate || !period || !PERIODS.includes(period)) {
    return NextResponse.json({ error: "missing_or_invalid_params" }, { status: 400 });
  }

  const result = await getAvailability(workDate, period, session.employeeExternalId);
  if (!result) {
    return NextResponse.json({ error: "invalid_date" }, { status: 422 });
  }
  if (!canCheckInSameDay(workDate, period)) {
    return NextResponse.json({ error: "checkin_window_closed" }, { status: 409 });
  }
  return NextResponse.json(result, { status: 200 });
}
