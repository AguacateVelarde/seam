import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "./client";

// Optional auto-migration at startup (used by the Docker image, where
// drizzle-kit is not installed). Local dev uses `bun run db:migrate`.
export async function runMigrations(): Promise<void> {
  const migrationsFolder = process.env.SEAM_MIGRATIONS_DIR ?? "./src/db/migrations";
  await migrate(db, { migrationsFolder });
  console.log("Database migrations applied");
}
