-- Richer synthetic floor for the demo. Desks are grouped into pods (A / B / C,
-- four seats each) and parking into a single row, so the Book screen's floor
-- map reads like a real office layout and a specific desk or space can be
-- picked. Still synthetic demo data, not real client data (task brief
-- section 7); the full site is ~150 desks / 30 parking -- this is a small,
-- demonstrable subset. Desk A1/A2 and Parking P1/P2 come from 0002_seed.sql.

insert into resources (type, label, site) values
  ('desk', 'Desk A3', 'belgrade'),
  ('desk', 'Desk A4', 'belgrade'),
  ('desk', 'Desk B1', 'belgrade'),
  ('desk', 'Desk B2', 'belgrade'),
  ('desk', 'Desk B3', 'belgrade'),
  ('desk', 'Desk B4', 'belgrade'),
  ('desk', 'Desk C1', 'belgrade'),
  ('desk', 'Desk C2', 'belgrade'),
  ('desk', 'Desk C3', 'belgrade'),
  ('desk', 'Desk C4', 'belgrade'),
  ('parking', 'Parking P3', 'belgrade'),
  ('parking', 'Parking P4', 'belgrade'),
  ('parking', 'Parking P5', 'belgrade'),
  ('parking', 'Parking P6', 'belgrade')
on conflict do nothing;
