import { Pool } from "pg";

// Single shared pool for the app. Not a singleton-safe pattern across Next.js
// hot-reload in dev, but fine for the POC; revisit for full delivery.
declare global {
  // eslint-disable-next-line no-var
  var __smartOfficePool: Pool | undefined;
}

export const db =
  global.__smartOfficePool ??
  new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== "production") {
  global.__smartOfficePool = db;
}
