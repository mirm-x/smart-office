import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { cancelBooking, ResourceType } from "@/server/booking-service";
import { SESSION_COOKIE, verifySession } from "@/server/identity";

const RESOURCE_TYPES: ResourceType[] = ["desk", "parking"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest, { params }: { params: { requestId: string } }) {
  const session = verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!UUID.test(params.requestId) || !body || !RESOURCE_TYPES.includes(body.resourceType)) {
    return NextResponse.json({ error: "invalid_fields" }, { status: 400 });
  }

  const result = await cancelBooking(params.requestId, body.resourceType, session.employeeExternalId);
  if (!result.ok) {
    const status = result.reason === "not_owner" ? 403 : result.reason === "not_found" ? 404 : 409;
    return NextResponse.json({ error: result.reason }, { status });
  }
  return NextResponse.json(result, { status: 200 });
}
