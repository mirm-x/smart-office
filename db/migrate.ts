import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

// Minimal, dependency-free migration runner: applies every .sql file in this
// directory in filename order, once. Good enough for a two-day POC; swap for
// a real migration tool before full delivery.
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const dir = join(__dirname, "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = await pool.connect();
  try {
    await client.query(
      "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())"
    );

    for (const file of files) {
      const { rowCount } = await client.query(
        "select 1 from schema_migrations where name = $1",
        [file]
      );
      if (rowCount) {
        console.log(`skip  ${file} (already applied)`);
        continue;
      }

      const sql = readFileSync(join(dir, file), "utf8");
      console.log(`apply ${file}`);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into schema_migrations (name) values ($1)", [file]);
        await client.query("commit");
      } catch (err) {
        await client.query("rollback");
        throw err;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
