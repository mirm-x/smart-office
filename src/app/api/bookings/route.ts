import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createBooking, CreateBookingInput, ResourceType } from "@/server/booking-service";
import { Period } from "@/server/booking-policy";
import { listEmployeeBookings } from "@/server/booking-queries";
import { SESSION_COOKIE, verifySession } from "@/server/identity";

const PERIODS: Period[] = ["morning", "afternoon", "full_day"];
const RESOURCE_TYPES: ResourceType[] = ["desk", "parking"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const session = verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Partial<CreateBookingInput> | null;

  if (
    !body || typeof body !== "object" || Array.isArray(body) ||
    typeof body.workDate !== "string" ||
    !body.period || !PERIODS.includes(body.period) ||
    !Array.isArray(body.resourceTypes) ||
    body.resourceTypes.length < 1 || body.resourceTypes.length > 2 ||
    body.resourceTypes.some((type) => !RESOURCE_TYPES.includes(type)) ||
    new Set(body.resourceTypes).size !== body.resourceTypes.length ||
    (body.resourceIds !== undefined &&
      (!Array.isArray(body.resourceIds) ||
        body.resourceIds.length > body.resourceTypes.length ||
        body.resourceIds.some((id) => typeof id !== "string" || !UUID.test(id)) ||
        new Set(body.resourceIds).size !== body.resourceIds.length))
  ) {
    return NextResponse.json({ error: "invalid_fields" }, { status: 400 });
  }

  const result = await createBooking({
    employeeExternalId: session.employeeExternalId,
    workDate: body.workDate,
    period: body.period,
    resourceTypes: body.resourceTypes,
    resourceIds: body.resourceIds,
  });

  if (!result.ok) {
    const status =
      result.reason === "conflict" ||
      result.reason === "resource_taken" ||
      result.reason === "already_booked" ||
      result.reason === "checkin_window_closed"
        ? 409
        : result.reason === "half_day_not_enabled"
          ? 403
          : 422;
    return NextResponse.json({ error: result.reason }, { status });
  }

  return NextResponse.json(result, { status: 201 });
}
