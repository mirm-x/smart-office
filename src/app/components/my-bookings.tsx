"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIdentity } from "./identity";

type ClaimStatus = "reserved" | "checked_in" | "released" | "cancelled";
type Period = "morning" | "afternoon" | "full_day";
const BOOKINGS_REFRESH_MS = 60_000;

interface BookingItem {
  requestId: string;
  resourceType: "desk" | "parking";
  resourceLabel: string;
  workDate: string;
  period: Period;
  status: ClaimStatus;
  checkinWindowOpensAt: string;
  checkinDeadlineAt: string;
}

const PERIOD_LABEL: Record<Period, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  full_day: "Full day",
};

const STATUS_BADGE: Record<ClaimStatus, { className: string; icon: string; label: string }> = {
  reserved: { className: "badge--reserved", icon: "◷", label: "Reserved" },
  checked_in: { className: "badge--checked_in", icon: "✓", label: "Checked in" },
  released: { className: "badge--released", icon: "↩", label: "Released" },
  cancelled: { className: "badge--cancelled", icon: "⊘", label: "Cancelled" },
};

const CHECKIN_ERROR: Record<string, string> = {
  too_early: "Check-in isn't open yet.",
  too_late: "The check-in window has closed for this booking.",
  not_owner: "You can only check in to your own booking.",
  not_found: "We couldn't find that booking.",
  already_released: "This booking was released and can't be checked in.",
  already_cancelled: "This booking was cancelled and can't be checked in.",
  unauthorized: "Sign in to check in.",
};

const CANCEL_ERROR: Record<string, string> = {
  not_found: "We couldn't find that booking.",
  not_owner: "You can only cancel your own booking.",
  already_checked_in: "This booking is already checked in and can't be cancelled.",
  already_released: "This booking has already been released.",
  unauthorized: "Sign in to cancel this booking.",
};

function timeInOffice(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Belgrade",
  });
}

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/Belgrade",
  });
}

function Countdown({ item, now }: { item: BookingItem; now: number }) {
  const opens = new Date(item.checkinWindowOpensAt).getTime();
  const deadline = new Date(item.checkinDeadlineAt).getTime();

  if (now < opens) {
    return <span className="muted">◷ Check-in opens {timeInOffice(item.checkinWindowOpensAt)}</span>;
  }
  if (now >= deadline) {
    return <span style={{ color: "var(--status-released-text)", fontSize: 13 }}>◷ Window closed</span>;
  }
  const msLeft = deadline - now;
  const mins = Math.floor(msLeft / 60000);
  const secs = Math.floor((msLeft % 60000) / 1000);
  const warn = msLeft < 5 * 60000;
  return (
    <span style={{ color: warn ? "var(--status-warning-text)" : "var(--text-secondary)", fontSize: 13 }}>
      ◷ Check in before {timeInOffice(item.checkinDeadlineAt)} ·{" "}
      {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")} left
    </span>
  );
}

export function MyBookings() {
  const { identity, loading } = useIdentity();
  const [bookingResult, setBookingResult] = useState<{ employeeId: string; items: BookingItem[] } | null>(null);
  const bookings = bookingResult && identity && bookingResult.employeeId === identity.employeeExternalId
    ? bookingResult.items
    : null;
  const [fetching, setFetching] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [liveMsg, setLiveMsg] = useState("");
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const [busyKeys, setBusyKeys] = useState<Set<string>>(() => new Set());
  const busyRef = useRef<Set<string>>(new Set());
  const refreshVersion = useRef(0);
  const lastRefreshAt = useRef(0);

  const refresh = useCallback(async () => {
    if (!identity) return;
    const version = ++refreshVersion.current;
    lastRefreshAt.current = Date.now();
    setFetching(true);
    try {
      const res = await fetch("/api/bookings", { cache: "no-store" });
      if (!res.ok) throw new Error("bookings request failed");
      const data = await res.json();
      if (version !== refreshVersion.current) return;
      setBookingResult({ employeeId: identity.employeeExternalId, items: data.bookings });
      setLoadError(null);
      setLiveMsg("Bookings updated.");
    } catch {
      if (version === refreshVersion.current) setLoadError("Could not load bookings. Try refreshing.");
    } finally {
      if (version === refreshVersion.current) setFetching(false);
    }
  }, [identity]);

  useEffect(() => {
    setRowError({});
    setConfirmingKey(null);
    setLiveMsg("");
    if (identity) void refresh();
    else {
      refreshVersion.current++;
      setBookingResult(null);
      setLoadError(null);
      setFetching(false);
    }
    return () => { refreshVersion.current++; };
  }, [identity, refresh]);

  useEffect(() => {
    if (!identity) return;
    const tick = window.setInterval(() => {
      if (!document.hidden) setNow(Date.now());
    }, 1000);
    const onVisible = () => {
      if (document.hidden) return;
      setNow(Date.now());
      if (Date.now() - lastRefreshAt.current < 1000) return;
      void refresh();
    };
    const poll = window.setInterval(onVisible, BOOKINGS_REFRESH_MS);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(poll);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [identity, refresh]);

  async function checkIn(item: BookingItem) {
    const key = `${item.requestId}:${item.resourceType}`;
    if (busyRef.current.has(key)) return;
    busyRef.current.add(key);
    setBusyKeys((current) => new Set(current).add(key));
    setRowError((e) => ({ ...e, [key]: "" }));
    try {
      const res = await fetch(`/api/bookings/${item.requestId}/checkin`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resourceType: item.resourceType }),
      });
      if (res.ok) {
        await refresh();
        setLiveMsg(`Checked in ${item.resourceLabel}.`);
      } else {
        const data = await res.json().catch(() => ({}));
        setRowError((e) => ({ ...e, [key]: CHECKIN_ERROR[data.error] ?? "Check-in failed." }));
        if (res.status === 409) await refresh();
      }
    } catch {
      setRowError((e) => ({ ...e, [key]: "Check-in failed. Please try again." }));
    } finally {
      busyRef.current.delete(key);
      setBusyKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }

  async function cancel(item: BookingItem) {
    const key = `${item.requestId}:${item.resourceType}`;
    if (busyRef.current.has(key)) return;
    busyRef.current.add(key);
    setBusyKeys((current) => new Set(current).add(key));
    setRowError((e) => ({ ...e, [key]: "" }));
    try {
      const res = await fetch(`/api/bookings/${item.requestId}/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resourceType: item.resourceType }),
      });
      if (res.ok) {
        setConfirmingKey(null);
        await refresh();
        setLiveMsg(`Cancelled ${item.resourceLabel}.`);
      } else {
        const data = await res.json().catch(() => ({}));
        setRowError((e) => ({ ...e, [key]: CANCEL_ERROR[data.error] ?? "Cancellation failed." }));
        if (res.status === 409) await refresh();
      }
    } catch {
      setRowError((e) => ({ ...e, [key]: "Cancellation failed. Please try again." }));
    } finally {
      busyRef.current.delete(key);
      setBusyKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }

  if (loading) return <p className="muted">Loading…</p>;

  if (!identity) {
    return (
      <>
        <h1 className="screen-title">My bookings</h1>
        <div className="banner banner--info" role="status">
          ⓘ Enter an employee id above to see your bookings.
        </div>
      </>
    );
  }

  return (
    <>
      <div className="row-between">
        <h1 className="screen-title">My bookings</h1>
        <button type="button" className="btn btn--secondary btn--sm" onClick={refresh} disabled={fetching}>
          {fetching ? "Refreshing…" : "↻ Refresh"}
        </button>
      </div>

      <p className="visually-hidden" role="status" aria-live="polite">
        {liveMsg}
      </p>

      {loadError && <div className="banner banner--error" role="alert">⚠ {loadError}</div>}

      {!bookings && fetching && <p className="muted">Loading bookings…</p>}

      {bookings && bookings.length === 0 && (
        <div className="card">
          <p className="muted">No bookings yet. Book a desk or parking space to get started.</p>
          <Link className="btn btn--primary btn--sm" href="/" style={{ alignSelf: "flex-start" }}>
            Book a space
          </Link>
        </div>
      )}

      {bookings && bookings.length > 0 && (
        <ul className="booking-list">
          {bookings.map((item) => {
            const key = `${item.requestId}:${item.resourceType}`;
            const badge = STATUS_BADGE[item.status];
            const opens = new Date(item.checkinWindowOpensAt).getTime();
            const deadline = new Date(item.checkinDeadlineAt).getTime();
            const withinWindow = now >= opens && now < deadline;
            return (
              <li key={key} className="card">
                <div className="booking-row">
                  <div className="booking-row__meta">
                    <span className="booking-row__resource">
                      {item.resourceType === "desk" ? "🖥" : "🅿"} {item.resourceLabel}
                    </span>
                    <span className="booking-row__sub">
                      {formatDate(item.workDate)} · {PERIOD_LABEL[item.period]}
                    </span>
                    {item.status === "reserved" && <Countdown item={item} now={now} />}
                    {item.status === "checked_in" && (
                      <span style={{ color: "var(--status-checkedin-text)", fontSize: 13 }}>
                        Protected for this period.
                      </span>
                    )}
                  </div>
                  <div className="booking-row__actions">
                    <span className={`badge ${badge.className}`}>
                      {badge.icon} {badge.label}
                    </span>
                    {item.status === "reserved" && now < deadline && (
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        disabled={!withinWindow || busyKeys.has(key)}
                        onClick={() => checkIn(item)}
                      >
                        {busyKeys.has(key) ? "Working…" : "Check in"}
                      </button>
                    )}
                    {item.status === "reserved" && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        disabled={busyKeys.has(key)}
                        onClick={() => setConfirmingKey(confirmingKey === key ? null : key)}
                      >
                        Cancel booking
                      </button>
                    )}
                    {item.status === "released" && (
                      <Link className="btn btn--ghost btn--sm" href="/">
                        Find another slot
                      </Link>
                    )}
                  </div>
                </div>
                {item.status === "reserved" && confirmingKey === key && (
                  <div className="booking-cancel" role="group" aria-label={`Cancel ${item.resourceLabel}`}>
                    <p>Cancel {item.resourceLabel} on {formatDate(item.workDate)} ({PERIOD_LABEL[item.period]})? Your reservation will be removed.</p>
                    <div className="booking-cancel__actions">
                      <button type="button" className="btn btn--secondary btn--sm" onClick={() => setConfirmingKey(null)} disabled={busyKeys.has(key)}>
                        Keep booking
                      </button>
                      <button type="button" className="btn btn--danger btn--sm" onClick={() => cancel(item)} disabled={busyKeys.has(key)}>
                        {busyKeys.has(key) ? "Cancelling…" : "Confirm cancellation"}
                      </button>
                    </div>
                  </div>
                )}
                {item.status === "released" && (
                  <div className="banner banner--info">Released — check availability for the next bookable period.</div>
                )}
                {item.status === "cancelled" && <span className="muted">This booking no longer holds the space.</span>}
                {rowError[key] && (
                  <div className="banner banner--error" role="alert">
                    ⚠ {rowError[key]}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
