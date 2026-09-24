import { NextRequest, NextResponse } from "next/server";
import { createBooking, CreateBookingInput } from "@/server/booking-service";

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
    const status = result.reason === "conflict" ? 409 : result.reason === "half_day_not_enabled" ? 403 : 422;
    return NextResponse.json({ error: result.reason }, { status });
  }

  return NextResponse.json(result, { status: 201 });
}
