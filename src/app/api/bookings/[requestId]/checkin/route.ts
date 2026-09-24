import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { checkIn, ResourceType } from "@/server/booking-service";
import { SESSION_COOKIE, verifySession } from "@/server/identity";

export async function POST(req: NextRequest, { params }: { params: { requestId: string } }) {
  // The employee identity comes from the signed session set by the simulated
  // sign-in route, never from the request body (acceptance criterion: check-in #4).
  const session = verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { resourceType?: ResourceType };

  if (!body.resourceType) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const result = await checkIn(params.requestId, body.resourceType, session.employeeExternalId);

  if (!result.ok) {
    const status = result.reason === "not_owner" ? 403 : result.reason === "not_found" ? 404 : 409;
    return NextResponse.json({ error: result.reason }, { status });
  }

  return NextResponse.json(result, { status: 200 });
}
