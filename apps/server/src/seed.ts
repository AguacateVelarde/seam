// Manual seed: always creates a new default project plus an admin and a read
// API key, printing the raw keys (only the SHA-256 hash is stored).
// Usage: bun run --cwd apps/server seed
// Note: the server also auto-seeds an empty database on first start.
import { createDefaultProjectAndKeys } from "./lib/bootstrap";

const { project, adminKey, readKey } = await createDefaultProjectAndKeys();

console.log("Seed complete.");
console.log("");
console.log(`  Project ID : ${project.id}`);
console.log(`  Admin key  : ${adminKey}`);
console.log(`  Read key   : ${readKey}`);
console.log("");
console.log("Store these keys now — only their hashes are persisted.");

process.exit(0);
