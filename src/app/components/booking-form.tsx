"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIdentity } from "./identity";

type Period = "morning" | "afternoon" | "full_day";
type ResourceChoice = "desk" | "parking" | "both";
type ResourceType = "desk" | "parking";

interface ResourceAvailability {
  id: string;
  type: ResourceType;
  label: string;
  free: boolean;
  mine: boolean;
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
  resource_taken: "That space was just taken. Pick another on the map.",
  already_booked: "You already have a booking for this date and period.",
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

// Groups desks into pods by the letter in their label (e.g. "Desk A3" -> pod
// "A"), so the floor map can lay them out as clustered desk pods.
function deskPods(desks: ResourceAvailability[]): [string, ResourceAvailability[]][] {
  const map = new Map<string, ResourceAvailability[]>();
  for (const d of desks) {
    const pod = (d.label.match(/Desk\s+([A-Za-z])/)?.[1] ?? "?").toUpperCase();
    const bucket = map.get(pod) ?? [];
    bucket.push(d);
    map.set(pod, bucket);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function SpaceTile({
  r,
  selected,
  onSelect,
}: {
  r: ResourceAvailability;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const state = r.mine ? "mine" : !r.free ? "taken" : selected ? "selected" : "free";
  const stateLabel = r.mine ? "Yours" : !r.free ? "Taken" : selected ? "Selected" : "Free";
  return (
    <button
      type="button"
      className={`ptile ptile--${state}`}
      aria-pressed={r.free ? selected : undefined}
      aria-label={`${r.label}: ${stateLabel.toLowerCase()}`}
      disabled={!r.free}
      onClick={() => onSelect(r.id)}
      title={`${r.label} — ${stateLabel.toLowerCase()}`}
    >
      <span className="ptile__glyph">
        <ResourceGlyph type={r.type} />
      </span>
      <span className="ptile__label">{r.label}</span>
      <span className="ptile__state">{stateLabel}</span>
    </button>
  );
}

export function BookingForm({ halfDayEnabled }: { halfDayEnabled: boolean }) {
  const { identity, loading } = useIdentity();
  const employeeId = identity?.employeeExternalId;

  const today = useMemo(() => officeNow().date, []);
  const maxDate = useMemo(() => addDays(today, MAX_HORIZON_DAYS), [today]);
  const startingSlot = useMemo(() => initialSlot(halfDayEnabled), [halfDayEnabled]);

  const [workDate, setWorkDate] = useState(startingSlot.workDate);
  const [period, setPeriod] = useState<Period>(startingSlot.period);
  const [resource, setResource] = useState<ResourceChoice>("desk");
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [availabilityIssue, setAvailabilityIssue] = useState<{ workDate: string; period: Period; kind: "closed" | "unavailable" } | null>(null);
  const availabilityRequest = useRef<AbortController | null>(null);
  const [selected, setSelected] = useState<{ desk: string | null; parking: string | null }>({
    desk: null,
    parking: null,
  });
  const [dateError, setDateError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ tone: "error"; text: string } | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isWeekend = useMemo(() => isWeekendDate(workDate), [workDate]);

  const refreshAvailability = useCallback(async () => {
    availabilityRequest.current?.abort();
    if (!employeeId || isWeekend) {
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
  }, [workDate, period, isWeekend, employeeId]);

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

  // Drop a selected space that is no longer free (date/period changed, or
  // someone else booked it) so we never submit a stale pick.
  useEffect(() => {
    if (!availability) {
      setSelected({ desk: null, parking: null });
      return;
    }
    const freeIds = new Set(availability.resources.filter((r) => r.free).map((r) => r.id));
    setSelected((s) => ({
      desk: s.desk && freeIds.has(s.desk) ? s.desk : null,
      parking: s.parking && freeIds.has(s.parking) ? s.parking : null,
    }));
  }, [availability]);

  const selectSpace = useCallback((type: ResourceType, id: string) => {
    setSelected((s) => ({ ...s, [type]: s[type] === id ? null : id }));
  }, []);

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
      const resourceIds: string[] = [];
      if ((resource === "desk" || resource === "both") && selected.desk) resourceIds.push(selected.desk);
      if ((resource === "parking" || resource === "both") && selected.parking) resourceIds.push(selected.parking);

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workDate,
          period,
          resourceTypes: RESOURCE_TYPES[resource],
          ...(resourceIds.length > 0 ? { resourceIds } : {}),
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
        } else if (reason === "conflict" || reason === "resource_taken" || reason === "no_resource_available") {
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
  const visibleAvailability = employeeId && availability?.workDate === workDate && availability.period === period ? availability : null;
  const visibleIssue = availabilityIssue?.workDate === workDate && availabilityIssue.period === period ? availabilityIssue.kind : null;

  const desks = visibleAvailability?.resources.filter((r) => r.type === "desk") ?? [];
  const parking = visibleAvailability?.resources.filter((r) => r.type === "parking") ?? [];
  const pods = deskPods(desks);
  const deskFree = desks.filter((r) => r.free).length;
  const parkingFree = parking.filter((r) => r.free).length;

  const labelById = (id: string | null) =>
    id ? visibleAvailability?.resources.find((r) => r.id === id)?.label ?? null : null;
  const picks: string[] = [];
  if ((resource === "desk" || resource === "both") && labelById(selected.desk)) picks.push(labelById(selected.desk)!);
  if ((resource === "parking" || resource === "both") && labelById(selected.parking))
    picks.push(labelById(selected.parking)!);
  const needsDesk = resource !== "parking" && !selected.desk;
  const needsParking = resource !== "desk" && !selected.parking;
  const autoAssigned = [needsDesk ? "desk" : null, needsParking ? "parking" : null].filter(Boolean);
  const bookHelp = picks.length > 0
    ? `${picks.join(" + ")} selected${autoAssigned.length ? `; ${autoAssigned.join(" and ")} assigned automatically` : ""}.`
    : "Available spaces are assigned automatically unless you choose exact ones.";
  const resourceLabel = resource === "both" ? "Desk + parking" : resource === "desk" ? "Desk" : "Parking";

  return (
    <>
      <div className="page-intro">
        <span className="eyebrow">Your workplace, made simple</span>
        <h1 className="screen-title">Book a space</h1>
        <p>Find a desk, parking space, or both for your next office day.</p>
      </div>

      {!identity && !loading && (
        <div className="banner banner--info" role="status">
          ⓘ Enter an employee id above to book (e.g. emp-alice).
        </div>
      )}

      <form className="card booking-form" onSubmit={handleSubmit} aria-describedby="book-help">
        <div className="card__intro">
          <h2 className="card__title">Plan your office day</h2>
          <p>Choose when you need a space. We will show what is free as you go.</p>
        </div>

        <div className="form-section">
          <div className="form-section__heading">
            <span className="form-section__step" aria-hidden="true">01</span>
            <div>
              <h3>When are you coming in?</h3>
              <p>Choose a workday and the time you need.</p>
            </div>
          </div>

          <div className={`when-fields${halfDayEnabled ? " when-fields--multi" : ""}`}>
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
                  setSelected({ desk: null, parking: null });
                }}
                aria-invalid={dateError ? true : undefined}
                aria-describedby="date-help"
              />
              <span className="field__help" id="date-help">
                {dateError ?? "Weekdays only, up to 14 days ahead · times shown in Europe/Belgrade."}
              </span>
            </div>

            <fieldset className="field choice-field">
              <legend className="field__label">Period</legend>
              <div className={`period-grid${halfDayEnabled ? "" : " period-grid--single"}`} role="radiogroup" aria-label="Booking period">
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
                        setSelected({ desk: null, parking: null });
                      }}
                    >
                      <span className="period-option__label">{m.label}</span>
                      <span className="period-option__hours">{m.hours}</span>
                      <span className="period-option__checkin">{m.checkin}</span>
                    </button>
                  );
                })}
              </div>
              {!halfDayEnabled && <span className="field__help">Full-day bookings only.</span>}
            </fieldset>
          </div>

          {identity && (
            <section className="availability-strip" aria-live="polite" aria-label="Booking availability">
              <div className="availability-strip__header">
                <div>
                  <span className="eyebrow">Available for this booking</span>
                  <p>{formatDate(workDate)} · {meta.label}</p>
                </div>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => void refreshAvailability()}>
                  ↻ Refresh
                </button>
              </div>
              {visibleAvailability ? (
                <>
                  <div className="availability-strip__counts">
                    <span><strong>{visibleAvailability.desk}</strong> desks free</span>
                    <span><strong>{visibleAvailability.parking}</strong> parking free</span>
                  </div>
                  <p className="availability-strip__note">Booking availability · updated automatically</p>
                </>
              ) : (
                <p className="availability-strip__message">
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
          )}
        </div>

        <div className="form-section">
          <div className="form-section__heading">
            <span className="form-section__step" aria-hidden="true">02</span>
            <div>
              <h3>What do you need?</h3>
              <p>Choose a desk, parking space, or both.</p>
            </div>
          </div>

          <fieldset className="field choice-field">
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

          {visibleAvailability && visibleAvailability.resources.length > 0 && (
            <details className="space-picker">
              <summary className="space-picker__summary">
                <span>
                  <strong>Choose an exact space</strong>
                  <small>Optional · we can assign a free one for you</small>
                </span>
                <span className="space-picker__selection">{picks.length ? picks.join(" + ") : "Automatic assignment"}</span>
              </summary>
              <div className="space-picker__content">
                <span className="tag-simulated">Illustrative layout · booking availability</span>
                <div className="floorplan">
                  <div className="floorplan__room">
                    {(resource === "desk" || resource === "both") && (
                      <div className="room-area">
                        <div className="room-area__head">
                          <span className="room-area__title">Desks</span>
                          <span className="room-area__count">
                            {deskFree}/{desks.length} free
                          </span>
                        </div>
                        <div className="pods">
                          {pods.map(([pod, items]) => (
                            <div className="pod" key={pod}>
                              <span className="pod__label">Pod {pod}</span>
                              <div className="pod__grid">
                                {items.map((r) => (
                                  <SpaceTile
                                    key={r.id}
                                    r={r}
                                    selected={selected.desk === r.id}
                                    onSelect={(id) => selectSpace("desk", id)}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {(resource === "parking" || resource === "both") && (
                      <div className="room-area">
                        <div className="room-area__head">
                          <span className="room-area__title">Parking</span>
                          <span className="room-area__count">
                            {parkingFree}/{parking.length} free
                          </span>
                        </div>
                        <div className="parking-row">
                          {parking.map((r) => (
                            <SpaceTile
                              key={r.id}
                              r={r}
                              selected={selected.parking === r.id}
                              onSelect={(id) => selectSpace("parking", id)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="plan-legend" aria-hidden="true">
                  <span className="plan-legend__item">
                    <span className="plan-legend__swatch plan-legend__swatch--free" /> Free
                  </span>
                  <span className="plan-legend__item">
                    <span className="plan-legend__swatch plan-legend__swatch--selected" /> Selected
                  </span>
                  <span className="plan-legend__item">
                    <span className="plan-legend__swatch plan-legend__swatch--mine" /> Yours
                  </span>
                  <span className="plan-legend__item">
                    <span className="plan-legend__swatch plan-legend__swatch--taken" /> Taken
                  </span>
                </div>
              </div>
            </details>
          )}
        </div>

        {banner && (
          <div className="banner banner--error" role="alert">
            ⚠ {banner.text}
          </div>
        )}

        <div className="booking-submit">
          <div className="booking-review">
            <span className="eyebrow">Your reservation</span>
            <strong>{formatDate(workDate)} · {meta.label}</strong>
            <span>{resourceLabel} · {meta.hours}</span>
            <span className="muted" id="book-help">{bookHelp}</span>
          </div>
          <button type="submit" className="btn btn--primary" disabled={!identity || submitting || visibleIssue === "closed"}>
            {submitting ? "Booking…" : "Reserve space →"}
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
            <Link className="btn btn--secondary btn--sm" href="/bookings">
              Go to My bookings
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
