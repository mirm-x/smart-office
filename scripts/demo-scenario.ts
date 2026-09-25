import "dotenv/config";
import { DateTime } from "luxon";
import { db } from "../src/lib/db";
import { createBooking } from "../src/server/booking-service";
import { OFFICE_TIME_ZONE, Period, claimsForPeriod, isWorkingDate } from "../src/server/booking-policy";

const DEMO_EMPLOYEE = "emp-alice";
const DEMO_WINDOW_SECONDS = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface DemoClaim {
  id: string;
  external_id: string;
  work_date: string;
  request_period: Period;
  period: string;
  resource_type: "desk" | "parking";
  label: string;
  status: string;
  checkin_window_opens_at: Date;
  checkin_deadline: Date;
}

function assertLocalDemoDatabase() {
  const connection = process.env.DATABASE_URL;
  if (!connection) throw new Error("DATABASE_URL is missing. Set up the local demo database first.");
  const host = new URL(connection).hostname;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(host) || process.env.NODE_ENV === "production") {
    throw new Error("This demo helper only runs against a loopback PostgreSQL host outside production.");
  }
}

function officeTime(date: Date): string {
  return DateTime.fromJSDate(date).setZone(OFFICE_TIME_ZONE).toFormat("ccc dd LLL HH:mm:ss ZZZZ");
}

async function bobHasParking(workDate: string, period: Period): Promise<boolean> {
  const result = await db.query<{ occupied: boolean }>(
    `select exists (
       select 1 from booking_claims bc
       join employees e on e.id = bc.employee_id
       where e.external_id = 'emp-bob'
         and bc.work_date = $1::date
         and bc.period = any($2::text[])
         and bc.resource_type = 'parking'
         and bc.status in ('reserved', 'checked_in')
     ) as occupied`,
    [workDate, claimsForPeriod(period)]
  );
  return result.rows[0]?.occupied ?? false;
}

async function readClaims(requestId: string): Promise<DemoClaim[]> {
  const result = await db.query<DemoClaim>(
    `select bc.id, e.external_id, to_char(bc.work_date, 'YYYY-MM-DD') as work_date,
            br.period as request_period, bc.period, bc.resource_type, r.label,
            bc.status, bc.checkin_window_opens_at, bc.checkin_deadline
       from booking_claims bc
       join booking_requests br on br.id = bc.request_id
       join employees e on e.id = bc.employee_id
       join resources r on r.id = bc.resource_id
      where bc.request_id = $1
      order by bc.resource_type, bc.period`,
    [requestId]
  );
  return result.rows;
}

async function arm(requestId: string) {
  const client = await db.connect();
  try {
    await client.query("begin");
    const result = await client.query<DemoClaim>(
      `select bc.id, e.external_id, to_char(bc.work_date, 'YYYY-MM-DD') as work_date,
              br.period as request_period, bc.period, bc.resource_type, r.label,
              bc.status, bc.checkin_window_opens_at, bc.checkin_deadline
         from booking_claims bc
         join booking_requests br on br.id = bc.request_id
         join employees e on e.id = bc.employee_id
         join resources r on r.id = bc.resource_id
        where bc.request_id = $1
        order by bc.resource_type, bc.period
        for update of bc`,
      [requestId]
    );
    const claims = result.rows;
    const first = claims[0];
    const today = DateTime.now().setZone(OFFICE_TIME_ZONE).toISODate();
    if (!first || first.external_id !== DEMO_EMPLOYEE || !today || first.work_date <= today) {
      throw new Error("Choose a future desk + parking booking owned by synthetic emp-alice.");
    }
    const expectedClaims = claimsForPeriod(first.request_period).length * 2;
    const types = new Set(claims.map((claim) => claim.resource_type));
    if (claims.length !== expectedClaims || !types.has("desk") || !types.has("parking") || claims.some((claim) => claim.status !== "reserved")) {
      throw new Error("The booking must have one reserved desk and one reserved parking space, with no check-in or release yet.");
    }
    if (claims.some((claim) => claim.checkin_window_opens_at.getTime() <= Date.now())) {
      throw new Error("This booking's check-in window has already opened or was accelerated before.");
    }
    if (await bobHasParking(first.work_date, first.request_period)) {
      throw new Error("Bob already has parking in this slot. Choose a different future date for the rebooking scene.");
    }

    const now = Date.now();
    const opensAt = new Date(now - 60_000);
    const deadline = new Date(now + DEMO_WINDOW_SECONDS * 1000);
    await client.query(
      `update booking_claims
          set checkin_window_opens_at = $2, checkin_deadline = $3
        where request_id = $1`,
      [requestId, opensAt, deadline]
    );
    for (const claim of claims) {
      await client.query(
        `insert into audit_log (claim_id, event, actor, details)
         values ($1, 'demo_window_shortened', 'demo-scenario', $2::jsonb)`,
        [claim.id, JSON.stringify({ simulation: true, originalDeadline: claim.checkin_deadline.toISOString(), demoDeadline: deadline.toISOString() })]
      );
    }
    await client.query("commit");

    const resources = [...new Map(claims.map((claim) => [claim.resource_type, claim.label])).entries()];
    console.log("ACCELERATED LOCAL DEMO — synthetic booking, not the real office schedule");
    console.log(`Request: ${requestId}`);
    console.log(`Alice's booking: ${first.work_date} / ${first.request_period} / ${resources.map(([type, label]) => `${type}: ${label}`).join(" / ")}`);
    console.log(`Demo check-in window: open now; closes ${officeTime(deadline)} (${DEMO_WINDOW_SECONDS} seconds after preparation).`);
    console.log("Sign in as emp-alice, check in the desk, and leave parking unchecked.");
    console.log("Keep npm run worker running. After the deadline, refresh My bookings: desk stays Checked in; parking becomes Released.");
    console.log(`Inspect evidence: npm run demo:scenario -- status ${requestId}`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function prepare() {
  const now = DateTime.now().setZone(OFFICE_TIME_ZONE);
  const period: Period = process.env.HALF_DAY_BOOKING_ENABLED === "true" ? "morning" : "full_day";
  for (let daysAhead = 1; daysAhead <= 14; daysAhead++) {
    const workDate = now.plus({ days: daysAhead }).toISODate();
    if (!workDate || !isWorkingDate(workDate)) continue;
    if (await bobHasParking(workDate, period)) continue;
    const result = await createBooking({
      employeeExternalId: DEMO_EMPLOYEE,
      workDate,
      period,
      resourceTypes: ["desk", "parking"],
    });
    if (result.ok) {
      try {
        await arm(result.requestId);
      } catch (error) {
        console.error(`Booking ${result.requestId} was created but could not be accelerated. Cancel its desk and parking in My bookings.`);
        throw error;
      }
      return;
    }
    if (!["already_booked", "no_resource_available", "conflict"].includes(result.reason)) {
      throw new Error(`Could not prepare a demo booking: ${result.reason}`);
    }
  }
  throw new Error("No free future weekday within the 14-day booking horizon for Alice's combined demo booking.");
}

async function armLatest() {
  const today = DateTime.now().setZone(OFFICE_TIME_ZONE).toISODate();
  const result = await db.query<{ id: string }>(
    `select br.id
       from booking_requests br
       join employees e on e.id = br.employee_id
      where e.external_id = $1
        and br.work_date > $2::date
        and br.created_at >= now() - interval '10 minutes'
        and (select count(distinct bc.resource_type)
               from booking_claims bc
              where bc.request_id = br.id and bc.status = 'reserved') = 2
        and not exists (
          select 1 from audit_log al
          join booking_claims bc on bc.id = al.claim_id
          where bc.request_id = br.id and al.event = 'demo_window_shortened'
        )
      order by br.created_at desc`,
    [DEMO_EMPLOYEE, today]
  );
  if (result.rows.length !== 1) {
    throw new Error(`Expected exactly one new combined Alice booking from the last 10 minutes; found ${result.rows.length}. Use arm <request-id> instead.`);
  }
  await arm(result.rows[0]!.id);
}

async function status(requestId: string) {
  const claims = await readClaims(requestId);
  if (claims.length === 0 || claims.some((claim) => claim.external_id !== DEMO_EMPLOYEE)) {
    throw new Error("No synthetic Alice booking found for that request ID.");
  }
  console.log(`Request ${requestId} — ${claims[0]!.work_date} / ${claims[0]!.request_period}`);
  for (const claim of claims) {
    console.log(`${claim.label} (${claim.period}): ${claim.status}; check-in deadline ${officeTime(claim.checkin_deadline)}`);
  }
  const events = await db.query<{ event: string; actor: string; count: number }>(
    `select al.event, al.actor, count(*)::int as count
       from audit_log al
       join booking_claims bc on bc.id = al.claim_id
      where bc.request_id = $1
      group by al.event, al.actor
      order by al.event, al.actor`,
    [requestId]
  );
  for (const event of events.rows) console.log(`Audit: ${event.event} by ${event.actor} (${event.count} claim${event.count === 1 ? "" : "s"})`);
}

function help() {
  console.log(`Local synthetic demo helper

  npm run demo:scenario -- prepare
    Creates Alice's future desk + parking booking and opens a 60-second simulated check-in window.

  npm run demo:scenario -- arm <request-id>
    Applies the same simulated window to Alice's existing future desk + parking booking.

  npm run demo:scenario -- arm-latest
    Arms Alice's only new combined booking from the last 10 minutes, made in the UI.

  npm run demo:scenario -- status <request-id>
    Prints claim statuses and audit evidence without changing data.

Run the app and npm run worker separately. The normal policy remains 09:00–10:00
or 13:00–14:00; this helper changes only one local synthetic booking's stored
window for a clearly labelled presentation.`);
}

async function main() {
  const [command, requestId] = process.argv.slice(2);
  if (!command || command === "help") return help();
  if (!["prepare", "arm", "arm-latest", "status"].includes(command)) throw new Error(`Unknown command: ${command}`);
  assertLocalDemoDatabase();
  if (command === "prepare") return prepare();
  if (command === "arm-latest") return armLatest();
  if (!requestId || !UUID.test(requestId)) throw new Error("Pass a valid booking request UUID.");
  if (command === "arm") return arm(requestId);
  return status(requestId);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.end());
