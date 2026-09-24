"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useIdentity } from "./identity";

type Period = "morning" | "afternoon" | "full_day";
type ResourceChoice = "desk" | "parking" | "both";

const MAX_HORIZON_DAYS = 14;

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function nextWorkday(from = new Date()): Date {
  const d = new Date(from);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

const PERIOD_LABEL: Record<Period, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  full_day: "Full day",
};

const RESOURCE_TYPES: Record<ResourceChoice, ("desk" | "parking")[]> = {
  desk: ["desk"],
  parking: ["parking"],
  both: ["desk", "parking"],
};

const BOOKING_ERROR: Record<string, string> = {
  no_resource_available: "No resource free for that date and period. Try another slot.",
  conflict: "That space was just taken. Please try again.",
  unknown_employee: "We don't recognise that employee id.",
  half_day_not_enabled: "Half-day booking isn't enabled — choose Full day.",
  checkin_window_closed: "The check-in window for that period has already closed today. Pick a later date or period.",
  invalid_date: "Pick a weekday within the next 14 days.",
};

interface Confirmation {
  workDate: string;
  period: Period;
  resources: ("desk" | "parking")[];
}

export function BookingForm({ halfDayEnabled }: { halfDayEnabled: boolean }) {
  const { identity } = useIdentity();

  const today = useMemo(() => toISODate(new Date()), []);
  const maxDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + MAX_HORIZON_DAYS);
    return toISODate(d);
  }, []);

  const [workDate, setWorkDate] = useState(() => toISODate(nextWorkday()));
  const [period, setPeriod] = useState<Period>(halfDayEnabled ? "morning" : "full_day");
  const [resource, setResource] = useState<ResourceChoice>("desk");
  const [availability, setAvailability] = useState<{ desk: number; parking: number } | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ tone: "error"; text: string } | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isWeekend = useMemo(() => {
    const day = new Date(`${workDate}T00:00:00`).getDay();
    return day === 0 || day === 6;
  }, [workDate]);

  const refreshAvailability = useCallback(async () => {
    if (isWeekend) {
      setAvailability(null);
      return;
    }
    try {
      const res = await fetch(`/api/availability?workDate=${workDate}&period=${period}`);
      if (!res.ok) {
        setAvailability(null);
        return;
      }
      const data = await res.json();
      setAvailability({ desk: data.desk, parking: data.parking });
    } catch {
      setAvailability(null);
    }
  }, [workDate, period, isWeekend]);

  useEffect(() => {
    refreshAvailability();
  }, [refreshAvailability]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);
    setConfirmation(null);
    setDateError(null);
    if (isWeekend) {
      setDateError("Pick a weekday within the next 14 days.");
      return;
    }
    if (!identity) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          employeeExternalId: identity.employeeExternalId,
          workDate,
          period,
          resourceTypes: RESOURCE_TYPES[resource],
        }),
      });
      if (res.ok) {
        setConfirmation({ workDate, period, resources: RESOURCE_TYPES[resource] });
        refreshAvailability();
      } else {
        const data = await res.json().catch(() => ({}));
        const reason = data.error as string;
        if (reason === "invalid_date") {
          setDateError(BOOKING_ERROR.invalid_date ?? "Pick a weekday within the next 14 days.");
        } else {
          setBanner({ tone: "error", text: BOOKING_ERROR[reason] ?? "Something went wrong. Please try again." });
        }
      }
    } catch {
      setBanner({ tone: "error", text: "Something went wrong. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  const periodOptions: Period[] = halfDayEnabled ? ["morning", "afternoon", "full_day"] : ["full_day"];

  return (
    <>
      <h1 className="screen-title">Book a space</h1>

      {!identity && (
        <div className="banner banner--info" role="status">
          ⓘ Enter an employee id above to book (e.g. emp-alice).
        </div>
      )}

      <form className="card" onSubmit={handleSubmit} aria-describedby="book-help">
        <h2 className="card__title">Reserve a desk or parking space</h2>

        {availability && (
          <div className="banner banner--info" role="status" aria-live="polite">
            ⓘ {availability.desk} desk{availability.desk === 1 ? "" : "s"} · {availability.parking} parking free for{" "}
            {formatDate(workDate)}, {PERIOD_LABEL[period].toLowerCase()}.
          </div>
        )}

        <div className={`field${dateError ? " field--error" : ""}`}>
          <label className="field__label" htmlFor="work-date">
            Work date
          </label>
          <input
            id="work-date"
            className="field__control"
            type="date"
            value={workDate}
            min={today}
            max={maxDate}
            onChange={(e) => setWorkDate(e.target.value)}
            aria-invalid={dateError ? true : undefined}
            aria-describedby="date-help"
          />
          <span className="field__help" id="date-help">
            {dateError ?? "Weekdays only, up to 14 days ahead · times shown in Europe/Belgrade."}
          </span>
        </div>

        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field__label">Period</legend>
          <div className="segmented" role="radiogroup" aria-label="Booking period">
            {periodOptions.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={period === p}
                className="segmented__option"
                onClick={() => setPeriod(p)}
              >
                {PERIOD_LABEL[p]}
              </button>
            ))}
          </div>
          {!halfDayEnabled && <span className="field__help">Half-day booking is not enabled — full day only.</span>}
        </fieldset>

        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field__label">Resource</legend>
          <div className="segmented" role="radiogroup" aria-label="Resource type">
            {(["desk", "parking", "both"] as ResourceChoice[]).map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={resource === r}
                className="segmented__option"
                onClick={() => setResource(r)}
              >
                {r === "both" ? "Both" : r === "desk" ? "Desk" : "Parking"}
              </button>
            ))}
          </div>
        </fieldset>

        {banner && (
          <div className="banner banner--error" role="alert">
            ⚠ {banner.text}
          </div>
        )}

        <div className="row-between">
          <span className="muted" id="book-help">
            A resource is assigned automatically on booking.
          </span>
          <button type="submit" className="btn btn--primary" disabled={!identity || submitting}>
            {submitting ? "Booking…" : "Book"}
          </button>
        </div>
      </form>

      {confirmation && (
        <div className="card" role="status" aria-live="polite">
          <div className="banner banner--success">✓ Booking confirmed</div>
          <dl className="summary">
            <dt>Date</dt>
            <dd>{formatDate(confirmation.workDate)}</dd>
            <dt>Period</dt>
            <dd>{PERIOD_LABEL[confirmation.period]}</dd>
            <dt>Resource</dt>
            <dd>{confirmation.resources.map((r) => (r === "desk" ? "Desk" : "Parking")).join(" + ")}</dd>
            <dt>Status</dt>
            <dd>
              <span className="badge badge--reserved">◷ Reserved</span>
            </dd>
          </dl>
          <div className="row-between">
            <span className="muted">See the assigned resource in My bookings.</span>
            <a className="btn btn--secondary btn--sm" href="/bookings">
              Go to My bookings
            </a>
          </div>
        </div>
      )}
    </>
  );
}
