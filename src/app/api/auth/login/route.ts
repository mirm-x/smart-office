import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SESSION_COOKIE, signSession } from "@/server/identity";

// Simulated sign-in for seeded employees. This sets a signed cookie for the
// demo; it does not verify a corporate identity.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { employeeExternalId?: string };

  if (!body.employeeExternalId) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const employee = await db.query<{ id: string }>(
    "select id from employees where external_id = $1 and active = true",
    [body.employeeExternalId]
  );
  if (employee.rowCount === 0) {
    return NextResponse.json({ error: "unknown_employee" }, { status: 401 });
  }

  const token = signSession({
    employeeId: employee.rows[0]!.id,
    employeeExternalId: body.employeeExternalId,
  });
  const response = NextResponse.json({ ok: true, employeeExternalId: body.employeeExternalId });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return response;
}
