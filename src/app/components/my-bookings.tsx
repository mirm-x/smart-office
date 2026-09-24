"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useIdentity } from "./identity";

type ClaimStatus = "reserved" | "checked_in" | "released" | "cancelled";
type Period = "morning" | "afternoon" | "full_day";

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
  unauthenticated: "Sign in to check in.",
};

function timeInOffice(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Belgrade",
  });
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
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
  const [bookings, setBookings] = useState<BookingItem[] | null>(null);
  const [fetching, setFetching] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [liveMsg, setLiveMsg] = useState("");
  const busyRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!identity) return;
    setFetching(true);
    try {
      const res = await fetch("/api/bookings", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setBookings(data.bookings);
        setLiveMsg("Bookings updated.");
      }
    } finally {
      setFetching(false);
    }
  }, [identity]);

  useEffect(() => {
    if (identity) refresh();
    else setBookings(null);
  }, [identity, refresh]);

  // Tick the countdowns every second and poll the server every 15s so an
  // automatic release shows up live during the demo.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(() => refresh(), 15000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [refresh]);

  async function checkIn(item: BookingItem) {
    const key = `${item.requestId}:${item.resourceType}`;
    if (busyRef.current.has(key)) return;
    busyRef.current.add(key);
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
      }
    } finally {
      busyRef.current.delete(key);
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

      {bookings && bookings.length === 0 && (
        <div className="card">
          <p className="muted">No bookings yet. Book a desk or parking space to get started.</p>
          <a className="btn btn--primary btn--sm" href="/" style={{ alignSelf: "flex-start" }}>
            Book a space
          </a>
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
                    {item.status === "reserved" && (
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        disabled={!withinWindow}
                        onClick={() => checkIn(item)}
                      >
                        Check in
                      </button>
                    )}
                    {item.status === "released" && (
                      <a className="btn btn--ghost btn--sm" href="/">
                        Book again
                      </a>
                    )}
                  </div>
                </div>
                {item.status === "released" && (
                  <div className="banner banner--info">Released — this space is free to book again.</div>
                )}
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
