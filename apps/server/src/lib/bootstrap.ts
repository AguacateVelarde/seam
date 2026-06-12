import { randomBytes } from "node:crypto";
import { ulid } from "ulid";
import { db } from "../db/client";
import { apiKeys, projects } from "../db/schema";
import { hashKey } from "../middleware/auth";

export function generateKey(prefix: string): string {
  return `${prefix}_${randomBytes(24).toString("base64url")}`;
}

export async function createDefaultProjectAndKeys() {
  const [project] = await db
    .insert(projects)
    .values({ id: ulid(), name: "Default Project", description: "Created on first run" })
    .returning();

  const adminKey = generateKey("sk_admin");
  const readKey = generateKey("sk_read");

  await db.insert(apiKeys).values([
    {
      id: ulid(),
      projectId: project.id,
      role: "admin",
      keyHash: hashKey(adminKey),
      label: "bootstrap admin key",
    },
    {
      id: ulid(),
      projectId: project.id,
      role: "read",
      keyHash: hashKey(readKey),
      label: "bootstrap read key",
    },
  ]);

  return { project, adminKey, readKey };
}
