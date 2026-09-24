"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIdentity } from "./identity";

type Period = "morning" | "afternoon" | "full_day";
type ResourceChoice = "desk" | "parking" | "both";
type ResourceType = "desk" | "parking";

interface ResourceAvailability {
  type: ResourceType;
  label: string;
  free: boolean;
}

interface Availability {
  workDate: string;
  period: Period;
  desk: number;
  parking: number;
  resources: ResourceAvailability[];
}

const MAX_HORIZON_DAYS = 14;
const AVAILABILITY_REFRESH_MS = 60_000;
const OFFICE_TIME_ZONE = "Europe/Belgrade";
const OFFICE_DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: OFFICE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

function officeNow(now = new Date()): { date: string; hour: number } {
  const parts = OFFICE_DATE_TIME.formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { date: `${value("year")}-${value("month")}-${value("day")}`, hour: Number(value("hour")) };
}

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10);
}

function isWeekendDate(iso: string): boolean {
  const day = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

function nextWorkday(iso: string): string {
  let date = iso;
  while (isWeekendDate(date)) date = addDays(date, 1);
  return date;
}

function initialSlot(halfDayEnabled: boolean): { workDate: string; period: Period } {
  const { date, hour } = officeNow();
  if (!isWeekendDate(date) && hour < 10) {
    return { workDate: date, period: halfDayEnabled ? "morning" : "full_day" };
  }
  if (!isWeekendDate(date) && halfDayEnabled && hour < 14) {
    return { workDate: date, period: "afternoon" };
  }
  return { workDate: nextWorkday(addDays(date, 1)), period: halfDayEnabled ? "morning" : "full_day" };
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("en-GB", { timeZone: OFFICE_TIME_ZONE, weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

// Display copy for the booking periods. Hours and the check-in deadline mirror
// src/server/booking-policy.ts (PERIOD_WINDOWS), the source of truth.
const PERIOD_META: Record<Period, { label: string; hours: string; checkin: string }> = {
  morning: { label: "Morning", hours: "09:00 – 13:00", checkin: "check in by 10:00" },
  afternoon: { label: "Afternoon", hours: "13:00 – 17:00", checkin: "check in by 14:00" },
  full_day: { label: "Full day", hours: "09:00 – 17:00", checkin: "check in by 10:00" },
};

const RESOURCE_TYPES: Record<ResourceChoice, ResourceType[]> = {
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
  unauthorized: "Your sign-in has ended. Sign in again before booking.",
};

interface Confirmation {
  workDate: string;
  period: Period;
  resources: { type: "desk" | "parking"; label: string }[];
}

function ResourceGlyph({ type }: { type: ResourceType }) {
  // Simulated floor-plan glyph (illustrative). Desk = seat-at-table, parking = car.
  if (type === "desk") {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
        <rect x="3" y="11" width="18" height="3" rx="1" fill="currentColor" />
        <rect x="4" y="14" width="2" height="6" rx="1" fill="currentColor" />
        <rect x="18" y="14" width="2" height="6" rx="1" fill="currentColor" />
        <circle cx="12" cy="6.5" r="3" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path
        d="M5 13l1.4-4.2A2 2 0 0 1 8.3 7.4h7.4a2 2 0 0 1 1.9 1.4L19 13v5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H8v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-5z"
        fill="currentColor"
      />
      <circle cx="8" cy="15.5" r="1.1" fill="var(--bg-surface)" />
      <circle cx="16" cy="15.5" r="1.1" fill="var(--bg-surface)" />
    </svg>
  );
}

// Non-bookable amenity zones shown for context on the floor plan. Illustrative
// only -- they are NOT rentable spaces (greenery, piazza, lounge, workshop),
// mirroring the real office plan the client shared.
const PLAN_ZONES: { key: string; label: string; note: string }[] = [
  { key: "greenery", label: "Greenery", note: "Planted area" },
  { key: "piazza", label: "Piazza", note: "Open communal" },
  { key: "collab", label: "Collab", note: "Lounge / meeting" },
  { key: "workshop", label: "Workshop", note: "Event space" },
];

function BookableCluster({ title, type, resources }: { title: string; type: ResourceType; resources: ResourceAvailability[] }) {
  const items = resources.filter((r) => r.type === type);
  if (items.length === 0) return null;
  const free = items.filter((r) => r.free).length;
  return (
    <div className="plan-cluster">
      <div className="plan-cluster__head">
        <span className="plan-cluster__title">{title}</span>
        <span className="plan-cluster__count">
          {free}/{items.length} free
        </span>
      </div>
      <ul className="plan-tiles" role="list">
        {items.map((r) => (
          <li
            key={r.label}
            className={`ptile ${r.free ? "ptile--free" : "ptile--taken"}`}
            aria-label={`${r.label}: ${r.free ? "free" : "taken"}`}
            title={`${r.label} — ${r.free ? "free" : "taken"}`}
          >
            <span className="ptile__glyph">
              <ResourceGlyph type={type} />
            </span>
            <span className="ptile__label">{r.label}</span>
            <span className="ptile__state">{r.free ? "Free" : "Taken"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BookingForm({ halfDayEnabled }: { halfDayEnabled: boolean }) {
  const { identity } = useIdentity();

  const today = useMemo(() => officeNow().date, []);
  const maxDate = useMemo(() => addDays(today, MAX_HORIZON_DAYS), [today]);
  const startingSlot = useMemo(() => initialSlot(halfDayEnabled), [halfDayEnabled]);

  const [workDate, setWorkDate] = useState(startingSlot.workDate);
  const [period, setPeriod] = useState<Period>(startingSlot.period);
  const [resource, setResource] = useState<ResourceChoice>("desk");
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [availabilityIssue, setAvailabilityIssue] = useState<{ workDate: string; period: Period; kind: "closed" | "unavailable" } | null>(null);
  const availabilityRequest = useRef<AbortController | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ tone: "error"; text: string } | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isWeekend = useMemo(() => isWeekendDate(workDate), [workDate]);

  const refreshAvailability = useCallback(async () => {
    availabilityRequest.current?.abort();
    if (isWeekend) {
      setAvailability(null);
      setAvailabilityIssue(null);
      return;
    }
    const controller = new AbortController();
    availabilityRequest.current = controller;
    try {
      const res = await fetch(`/api/availability?workDate=${workDate}&period=${period}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (res.status === 409) {
        setAvailability(null);
        setAvailabilityIssue({ workDate, period, kind: "closed" });
        return;
      }
      if (!res.ok) {
        setAvailability(null);
        setAvailabilityIssue({ workDate, period, kind: "unavailable" });
        return;
      }
      const data = await res.json();
      if (controller.signal.aborted) return;
      setAvailability({ workDate, period, desk: data.desk, parking: data.parking, resources: data.resources ?? [] });
      setAvailabilityIssue(null);
    } catch {
      if (controller.signal.aborted) return;
      setAvailability(null);
      setAvailabilityIssue({ workDate, period, kind: "unavailable" });
    }
  }, [workDate, period, isWeekend]);

  useEffect(() => {
    void refreshAvailability();
    const onVisible = () => {
      if (!document.hidden) void refreshAvailability();
    };
    const interval = window.setInterval(onVisible, AVAILABILITY_REFRESH_MS);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      availabilityRequest.current?.abort();
    };
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
          workDate,
          period,
          resourceTypes: RESOURCE_TYPES[resource],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { resources: Confirmation["resources"] };
        setConfirmation({ workDate, period, resources: data.resources });
        void refreshAvailability();
      } else {
        const data = await res.json().catch(() => ({}));
        const reason = data.error as string;
        if (reason === "checkin_window_closed") {
          setAvailability(null);
          setAvailabilityIssue({ workDate, period, kind: "closed" });
        } else if (reason === "conflict" || reason === "no_resource_available") {
          void refreshAvailability();
        }
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
  const meta = PERIOD_META[period];
  const visibleAvailability = availability?.workDate === workDate && availability.period === period ? availability : null;
  const visibleIssue = availabilityIssue?.workDate === workDate && availabilityIssue.period === period ? availabilityIssue.kind : null;

  return (
    <>
      <h1 className="screen-title">Book a space</h1>

      {!identity && (
        <div className="banner banner--info" role="status">
          ⓘ Enter an employee id above to book (e.g. emp-alice).
        </div>
      )}

      {/* Punchy availability overview -- big, confident numbers first. */}
      <section className="avail" aria-live="polite" aria-label="Availability">
        <div className="row-between">
          <span className="muted">Booking availability · checks every minute while open</span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => void refreshAvailability()}>
            ↻ Refresh
          </button>
        </div>
        {visibleAvailability ? (
          <>
            <div className="avail__stats">
              <div className={`avail-stat ${visibleAvailability.desk > 0 ? "avail-stat--free" : "avail-stat--none"}`}>
                <span className="avail-stat__num">{visibleAvailability.desk}</span>
                <span className="avail-stat__label">desk{visibleAvailability.desk === 1 ? "" : "s"} free</span>
              </div>
              <div className={`avail-stat ${visibleAvailability.parking > 0 ? "avail-stat--free" : "avail-stat--none"}`}>
                <span className="avail-stat__num">{visibleAvailability.parking}</span>
                <span className="avail-stat__label">parking free</span>
              </div>
            </div>
            <p className="avail__caption">
              {formatDate(workDate)} · {meta.label}, {meta.hours}
            </p>
          </>
        ) : (
          <p className="avail__caption">
            {isWeekend
              ? "Weekends are closed — pick a weekday."
              : visibleIssue === "closed"
                ? `The ${meta.label.toLowerCase()} check-in window has closed today. Choose ${halfDayEnabled ? "a later period or another date" : "another date"}.`
                : visibleIssue === "unavailable"
                  ? "Availability could not be loaded. You can still try to book."
                  : "Checking availability for this period…"}
          </p>
        )}
      </section>

      <form className="card" onSubmit={handleSubmit} aria-describedby="book-help">
        <h2 className="card__title">Reserve a desk or parking space</h2>

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
            required
            onChange={(e) => {
              setWorkDate(e.target.value);
              setAvailability(null);
              setAvailabilityIssue(null);
            }}
            aria-invalid={dateError ? true : undefined}
            aria-describedby="date-help"
          />
          <span className="field__help" id="date-help">
            {dateError ?? "Weekdays only, up to 14 days ahead · times shown in Europe/Belgrade."}
          </span>
        </div>

        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field__label">Period</legend>
          <div className="period-grid" role="radiogroup" aria-label="Booking period">
            {periodOptions.map((p) => {
              const m = PERIOD_META[p];
              return (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={period === p}
                  className="period-option"
                  onClick={() => {
                    setPeriod(p);
                    setAvailability(null);
                    setAvailabilityIssue(null);
                  }}
                >
                  <span className="period-option__label">{m.label}</span>
                  <span className="period-option__hours">{m.hours}</span>
                  <span className="period-option__checkin">{m.checkin}</span>
                </button>
              );
            })}
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

        {/* Floor map -- illustrative office layout with booking availability.
            Coloured zones are amenities and are NOT bookable. */}
        {visibleAvailability && visibleAvailability.resources.length > 0 && (
          <div className="field" role="group" aria-label="Floor map">
            <div className="row-between">
              <span className="field__label">Floor map</span>
              <span className="tag-simulated">Illustrative layout · booking availability</span>
            </div>
            <div className="floorplan">
              <div className="floorplan__zones" aria-hidden="true">
                {PLAN_ZONES.map((z) => (
                  <div key={z.key} className={`zone zone--${z.key}`}>
                    <span className="zone__label">{z.label}</span>
                    <span className="zone__note">{z.note}</span>
                    <span className="zone__tag">Not bookable</span>
                  </div>
                ))}
              </div>
              <div className="floorplan__bookable">
                {(resource === "desk" || resource === "both") && (
                  <BookableCluster title="Desks" type="desk" resources={visibleAvailability.resources} />
                )}
                {(resource === "parking" || resource === "both") && (
                  <BookableCluster title="Parking" type="parking" resources={visibleAvailability.resources} />
                )}
              </div>
            </div>
            <div className="plan-legend" aria-hidden="true">
              <span className="plan-legend__item">
                <span className="plan-legend__swatch plan-legend__swatch--free" /> Free
              </span>
              <span className="plan-legend__item">
                <span className="plan-legend__swatch plan-legend__swatch--taken" /> Taken
              </span>
              <span className="plan-legend__item">
                <span className="plan-legend__swatch plan-legend__swatch--zone" /> Amenity · not bookable
              </span>
            </div>
          </div>
        )}

        {banner && (
          <div className="banner banner--error" role="alert">
            ⚠ {banner.text}
          </div>
        )}

        <div className="row-between">
          <span className="muted" id="book-help">
            A free resource is assigned automatically on booking.
          </span>
          <button type="submit" className="btn btn--primary" disabled={!identity || submitting || visibleIssue === "closed"}>
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
            <dd>
              {PERIOD_META[confirmation.period].label} · {PERIOD_META[confirmation.period].hours}
            </dd>
            <dt>Resource</dt>
            <dd>{confirmation.resources.map((r) => r.label).join(" + ")}</dd>
            <dt>Status</dt>
            <dd>
              <span className="badge badge--reserved">◷ Reserved</span>
            </dd>
          </dl>
          <div className="row-between">
            <span className="muted">Manage check-in in My bookings.</span>
            <a className="btn btn--secondary btn--sm" href="/bookings">
              Go to My bookings
            </a>
          </div>
        </div>
      )}
    </>
  );
}
