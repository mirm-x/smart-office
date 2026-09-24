import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";
import { db } from "../src/lib/db";
import { cancelBooking } from "../src/server/booking-service";

type Status = "reserved" | "checked_in" | "released" | "cancelled";
type ResourceType = "desk" | "parking";

interface Claim {
  id: string;
  request_id: string;
  resource_type: ResourceType;
  employee_id: string;
  status: Status;
}

function fakeClient(claims: Claim[]) {
  const audit: string[] = [];
  const client = {
    async query(sql: string, params: unknown[] = []) {
      if (sql === "begin" || sql === "commit" || sql === "rollback") {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("from employees")) {
        const id = params[0] === "emp-owner" ? "owner-id" : "other-id";
        return { rows: [{ id }], rowCount: 1 };
      }
      if (sql.includes("from booking_claims")) {
        const rows = claims.filter((claim) => claim.request_id === params[0] && claim.resource_type === params[1]);
        return { rows: rows.map(({ id, status, employee_id }) => ({ id, status, employee_id })), rowCount: rows.length };
      }
      if (sql.startsWith("update booking_claims")) {
        const claim = claims.find((row) => row.id === params[0]);
        assert.ok(claim);
        claim.status = "cancelled";
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith("insert into audit_log")) {
        audit.push(params[0] as string);
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
    release() {},
  };
  return { client: client as unknown as PoolClient, audit };
}

async function withFakeClient<T>(client: PoolClient, run: () => Promise<T>): Promise<T> {
  const pool = db as unknown as { connect: () => Promise<PoolClient> };
  const originalConnect = pool.connect;
  pool.connect = async () => client;
  try {
    return await run();
  } finally {
    pool.connect = originalConnect;
  }
}

test("cancelling a full-day desk frees both halves and leaves parking reserved", async () => {
  const claims: Claim[] = [
    { id: "desk-am", request_id: "request-1", resource_type: "desk", employee_id: "owner-id", status: "reserved" },
    { id: "desk-pm", request_id: "request-1", resource_type: "desk", employee_id: "owner-id", status: "reserved" },
    { id: "parking-am", request_id: "request-1", resource_type: "parking", employee_id: "owner-id", status: "reserved" },
  ];
  const { client, audit } = fakeClient(claims);
  await withFakeClient(client, async () => {
    const first = await cancelBooking("request-1", "desk", "emp-owner");
    assert.deepEqual(first, { ok: true, claimIds: ["desk-am", "desk-pm"], alreadyCancelled: false });
    assert.deepEqual(claims.map((claim) => claim.status), ["cancelled", "cancelled", "reserved"]);
    assert.deepEqual(audit, ["desk-am", "desk-pm"]);

    const repeated = await cancelBooking("request-1", "desk", "emp-owner");
    assert.deepEqual(repeated, { ok: true, claimIds: ["desk-am", "desk-pm"], alreadyCancelled: true });
    assert.deepEqual(audit, ["desk-am", "desk-pm"]);
  });
});

test("another employee cannot cancel the booking", async () => {
  const claims: Claim[] = [
    { id: "desk-am", request_id: "request-1", resource_type: "desk", employee_id: "owner-id", status: "reserved" },
  ];
  const { client, audit } = fakeClient(claims);
  await withFakeClient(client, async () => {
    assert.deepEqual(await cancelBooking("request-1", "desk", "emp-other"), { ok: false, reason: "not_owner" });
    assert.equal(claims[0]?.status, "reserved");
    assert.equal(audit.length, 0);
  });
});

test("a checked-in booking stays protected from cancellation", async () => {
  const claims: Claim[] = [
    { id: "desk-am", request_id: "request-1", resource_type: "desk", employee_id: "owner-id", status: "checked_in" },
    { id: "desk-pm", request_id: "request-1", resource_type: "desk", employee_id: "owner-id", status: "checked_in" },
  ];
  const { client, audit } = fakeClient(claims);
  await withFakeClient(client, async () => {
    assert.deepEqual(await cancelBooking("request-1", "desk", "emp-owner"), { ok: false, reason: "already_checked_in" });
    assert.ok(claims.every((claim) => claim.status === "checked_in"));
    assert.equal(audit.length, 0);
  });
});

test("a released booking cannot be cancelled", async () => {
  const claims: Claim[] = [
    { id: "desk-am", request_id: "request-1", resource_type: "desk", employee_id: "owner-id", status: "released" },
  ];
  const { client, audit } = fakeClient(claims);
  await withFakeClient(client, async () => {
    assert.deepEqual(await cancelBooking("request-1", "desk", "emp-owner"), { ok: false, reason: "already_released" });
    assert.equal(claims[0]?.status, "released");
    assert.equal(audit.length, 0);
  });
});
