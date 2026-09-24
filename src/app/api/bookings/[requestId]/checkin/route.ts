import { NextRequest, NextResponse } from "next/server";
import { checkIn, ResourceType } from "@/server/booking-service";

export async function POST(req: NextRequest, { params }: { params: { requestId: string } }) {
  const body = (await req.json()) as { employeeExternalId?: string; resourceType?: ResourceType };

  if (!body.employeeExternalId || !body.resourceType) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const result = await checkIn(params.requestId, body.resourceType, body.employeeExternalId);

  if (!result.ok) {
    const status = result.reason === "not_owner" ? 403 : result.reason === "not_found" ? 404 : 409;
    return NextResponse.json({ error: result.reason }, { status });
  }

  return NextResponse.json(result, { status: 200 });
}
