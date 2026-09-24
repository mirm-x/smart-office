-- Synthetic seed data for local development and the camp demo.
-- Fictional employees and a small resource set (not the full 150 desks / 30
-- parking spaces) so the booking -> check-in -> release -> rebook journey
-- can be demonstrated end to end. Not real client data (task brief section 7).

insert into employees (external_id, display_name) values
  ('emp-alice', 'Alice Novak'),
  ('emp-bob', 'Bob Petrovic')
on conflict do nothing;

insert into resources (type, label, site) values
  ('desk', 'Desk A1', 'belgrade'),
  ('desk', 'Desk A2', 'belgrade'),
  ('parking', 'Parking P1', 'belgrade'),
  ('parking', 'Parking P2', 'belgrade')
on conflict do nothing;
