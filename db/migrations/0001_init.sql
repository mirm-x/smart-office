-- Smart Office POC schema
-- Implements the modelling approach from the plan (section 4):
--   "Model each resource/date as morning and afternoon claims; a full-day
--    booking claims both. Database constraints enforce active overlaps
--    for resources and employees."
--
-- A `booking_request` is the atomic unit a user submits (a desk, a parking
-- space, or one of each for the same date/period). Each request creates one
-- `booking_claim` per resource per half-day period it occupies: a half-day
-- request creates one claim, a full-day request creates two (morning +
-- afternoon), so both halves are protected and released independently.

create extension if not exists "pgcrypto";

create table employees (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique, -- synthetic identity id in the POC; Entra object id in full delivery
  display_name text not null,
  active boolean not null default true
);

create table resources (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('desk', 'parking')),
  label text not null,
  site text not null default 'belgrade',
  status text not null default 'active' check (status in ('active', 'unavailable', 'maintenance'))
);

create table booking_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees (id),
  work_date date not null,
  period text not null check (period in ('morning', 'afternoon', 'full_day')),
  created_at timestamptz not null default now()
);

create table booking_claims (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references booking_requests (id) on delete cascade,
  employee_id uuid not null references employees (id), -- denormalized for the per-employee overlap constraint below
  resource_id uuid not null references resources (id),
  resource_type text not null check (resource_type in ('desk', 'parking')), -- denormalized from resources for the constraint below
  work_date date not null,
  period text not null check (period in ('morning', 'afternoon')), -- a full-day request yields one claim per half
  status text not null default 'reserved' check (status in ('reserved', 'checked_in', 'released', 'cancelled')),
  checkin_window_opens_at timestamptz not null,
  checkin_deadline timestamptz not null, -- automatic release runs from this instant if not checked in
  checked_in_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now()
);

-- Active overlap enforcement (booking acceptance criterion 2 & check-in AC 4):
-- only one reserved/checked-in claim may exist per resource, date and period.
create unique index booking_claims_resource_active_period
  on booking_claims (resource_id, work_date, period)
  where status in ('reserved', 'checked_in');

-- Per-employee limit (plan section 2, "Overlap and limits"):
-- one desk and one parking space per employee per overlapping period.
create unique index booking_claims_employee_active_period
  on booking_claims (employee_id, resource_type, work_date, period)
  where status in ('reserved', 'checked_in');

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references booking_claims (id),
  event text not null, -- e.g. booked, checked_in, released, exception_flagged
  actor text not null, -- e.g. employee external_id, or "release-worker"
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_claim_id_idx on audit_log (claim_id);

-- Simulated occupancy signal, kept separate from booking rights and identity
-- (plan section 4, "Sensors and LEDs"): a reading never cancels a booking by
-- itself, it only feeds the release worker and the exception review view.
create table occupancy_readings (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references resources (id),
  occupied boolean not null,
  source text not null default 'simulated', -- simulated | radar | ir | ultrasonic
  observed_at timestamptz not null default now()
);
