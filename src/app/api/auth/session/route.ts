import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/server/identity";

// Returns the currently signed-in synthetic employee (from the signed session
// cookie), so the client can rehydrate identity after a reload. Simulated
// sign-in only -- full delivery replaces this with Microsoft Entra ID.
export async function GET() {
  const session = verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ signedIn: false }, { status: 200 });
  }
  const employee = await db.query<{ display_name: string }>(
    "select display_name from employees where external_id = $1 and active = true",
    [session.employeeExternalId]
  );
  if (employee.rowCount === 0) {
    return NextResponse.json({ signedIn: false }, { status: 200 });
  }
  return NextResponse.json(
    {
      signedIn: true,
      employeeExternalId: session.employeeExternalId,
      displayName: employee.rows[0]!.display_name,
      simulated: true,
    },
    { status: 200 }
  );
}
