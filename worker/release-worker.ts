import "dotenv/config";
import { db } from "../src/lib/db";

// Automatic no-show release (plan section 3, acceptance criteria: automatic
// release). Runs on a short interval and, each pass, releases every
// `reserved` claim whose check-in deadline has passed -- never a `checked_in`
// one, so a timely check-in is never undone by a sensor or a late run
// (criterion #2). Safe to run repeatedly or restart: a released claim is no
// longer `reserved`, so it is simply not selected again (criterion #5).
const POLL_INTERVAL_MS = 15_000;

async function releaseExpiredClaims(): Promise<number> {
  const client = await db.connect();
  try {
    await client.query("begin");

    const expired = await client.query<{ id: string; resource_id: string; request_id: string }>(
      `select id, resource_id, request_id
         from booking_claims
        where status = 'reserved'
          and checkin_deadline <= now()
        for update skip locked`
    );

    // Plan section 2: a full-day no-show is released from the first deadline
    // (10:00), so the still-reserved halves of the same request must not stay
    // reserved until their own later deadlines (e.g. the afternoon 14:00).
    const siblingRequestIds = expired.rows.map((row) => row.request_id);
    const siblings = siblingRequestIds.length
      ? await client.query<{ id: string; resource_id: string }>(
          `select bc.id, bc.resource_id
             from booking_claims bc
             join booking_requests br on br.id = bc.request_id
            where br.period = 'full_day'
              and br.id = any($1::uuid[])
              and bc.status = 'reserved'
            for update skip locked`,
          [siblingRequestIds]
        )
      : { rows: [] as { id: string; resource_id: string }[] };

    const seen = new Set<string>();
    const toRelease = [...expired.rows, ...siblings.rows].filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });

    for (const claim of toRelease) {
      await client.query(
        "update booking_claims set status = 'released', released_at = now() where id = $1",
        [claim.id]
      );
      await client.query(
        "insert into audit_log (claim_id, event, actor, details) values ($1, 'released', 'release-worker', '{}'::jsonb)",
        [claim.id]
      );

      // Criterion #6: a sensor reporting physical occupancy after release does
      // not cancel the release (booking rights are the source of truth) -- it
      // raises a review exception instead.
      const latestReading = await client.query<{ occupied: boolean }>(
        `select occupied from occupancy_readings
          where resource_id = $1
          order by observed_at desc
          limit 1`,
        [claim.resource_id]
      );
      if (latestReading.rows[0]?.occupied) {
        await client.query(
          "insert into audit_log (claim_id, event, actor, details) values ($1, 'exception_flagged', 'release-worker', $2::jsonb)",
          [claim.id, JSON.stringify({ reason: "occupied_without_booking" })]
        );
      }
    }

    await client.query("commit");
    return toRelease.length;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  console.log(`release-worker: polling every ${POLL_INTERVAL_MS / 1000}s`);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const released = await releaseExpiredClaims();
      if (released > 0) console.log(`release-worker: released ${released} claim(s)`);
    } catch (err) {
      console.error("release-worker: pass failed", err);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

if (require.main === module) {
  main();
}

export { releaseExpiredClaims };
