/**
 * Ids are UUIDs so two devices can export/import into each other without
 * colliding. crypto.randomUUID needs a secure context — localhost and https
 * both qualify, so this holds everywhere the app actually runs.
 */
export function createId(): string {
  return crypto.randomUUID();
}
