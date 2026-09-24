import { createHmac, timingSafeEqual } from "crypto";

// SIMULATED identity adapter for the POC (plan section 4, "Identity"):
// a synthetic sign-in (POST /api/auth/login) establishes a signed session
// cookie, and the check-in route takes the employee identity from that
// session instead of the request body -- a caller can no longer claim to be
// someone else (acceptance criterion: check-in #4). Full delivery replaces
// the simulated sign-in with Microsoft Entra ID behind the same session
// check.
export const SESSION_COOKIE = "smart_office_session";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-only-session-secret";

export interface SessionPayload {
  employeeId: string;
  employeeExternalId: string;
  exp: number;
}

export function signSession(employee: { employeeId: string; employeeExternalId: string }): string {
  const payload: SessionPayload = {
    employeeId: employee.employeeId,
    employeeExternalId: employee.employeeExternalId,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifySession(token: string | undefined): SessionPayload | null {
  if (!token) return null;

  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  const actual = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actual.length !== expectedBuffer.length || !timingSafeEqual(actual, expectedBuffer)) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (typeof session.exp !== "number" || session.exp <= Date.now()) return null;
    if (typeof session.employeeId !== "string" || typeof session.employeeExternalId !== "string") return null;
    return session;
  } catch {
    return null;
  }
}
