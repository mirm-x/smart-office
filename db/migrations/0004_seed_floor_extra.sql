-- More synthetic pods so the Book screen's floor map has enough desks and
-- parking to scroll horizontally, and so pods vary in size (2 / 4 / 6 desks)
-- like a real office rather than uniform blocks. Still synthetic demo data, not
-- real client data (task brief section 7); the full site is ~150 desks / 30
-- parking -- this remains a small, demonstrable subset.

insert into resources (type, label, site) values
  -- Pod D: 2 desks
  ('desk', 'Desk D1', 'belgrade'),
  ('desk', 'Desk D2', 'belgrade'),
  -- Pod E: 6 desks
  ('desk', 'Desk E1', 'belgrade'),
  ('desk', 'Desk E2', 'belgrade'),
  ('desk', 'Desk E3', 'belgrade'),
  ('desk', 'Desk E4', 'belgrade'),
  ('desk', 'Desk E5', 'belgrade'),
  ('desk', 'Desk E6', 'belgrade'),
  -- Pod F: 2 desks
  ('desk', 'Desk F1', 'belgrade'),
  ('desk', 'Desk F2', 'belgrade'),
  -- Pod G: 6 desks
  ('desk', 'Desk G1', 'belgrade'),
  ('desk', 'Desk G2', 'belgrade'),
  ('desk', 'Desk G3', 'belgrade'),
  ('desk', 'Desk G4', 'belgrade'),
  ('desk', 'Desk G5', 'belgrade'),
  ('desk', 'Desk G6', 'belgrade'),
  -- Pod H: 4 desks
  ('desk', 'Desk H1', 'belgrade'),
  ('desk', 'Desk H2', 'belgrade'),
  ('desk', 'Desk H3', 'belgrade'),
  ('desk', 'Desk H4', 'belgrade'),
  -- More parking so the row scrolls sideways
  ('parking', 'Parking P7', 'belgrade'),
  ('parking', 'Parking P8', 'belgrade'),
  ('parking', 'Parking P9', 'belgrade'),
  ('parking', 'Parking P10', 'belgrade'),
  ('parking', 'Parking P11', 'belgrade'),
  ('parking', 'Parking P12', 'belgrade')
on conflict do nothing;
