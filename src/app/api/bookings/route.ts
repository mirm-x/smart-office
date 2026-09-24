import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createBooking, CreateBookingInput } from "@/server/booking-service";
import { listEmployeeBookings } from "@/server/booking-queries";
import { SESSION_COOKIE, verifySession } from "@/server/identity";

// Lists the signed-in employee's bookings (identity from the signed session
// cookie, never from the query string).
export async function GET() {
  const session = verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const bookings = await listEmployeeBookings(session.employeeExternalId);
  return NextResponse.json({ bookings }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<CreateBookingInput>;

  if (!body.employeeExternalId || !body.workDate || !body.period || !body.resourceTypes) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const result = await createBooking({
    employeeExternalId: body.employeeExternalId,
    workDate: body.workDate,
    period: body.period,
    resourceTypes: body.resourceTypes,
  });

  if (!result.ok) {
    const status =
      result.reason === "conflict" || result.reason === "checkin_window_closed"
        ? 409
        : result.reason === "half_day_not_enabled"
          ? 403
          : 422;
    return NextResponse.json({ error: result.reason }, { status });
  }

  return NextResponse.json(result, { status: 201 });
}
