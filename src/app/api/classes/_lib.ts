import type { classes } from "@/lib/db/schema";

/** UTC DATETIME -> ISO string, the shape every consumer already expects. */
function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

/**
 * Drizzle wraps the mysql2 driver error, so the `code` a unique-violation
 * carries (e.g. "ER_DUP_ENTRY") can land on the wrapper itself or on its
 * `.cause` depending on the failure path — check both.
 */
export function dupKeyCode(err: unknown): string | undefined {
  const asRecord = err as { code?: string; cause?: { code?: string } } | null;
  return asRecord?.code ?? asRecord?.cause?.code;
}

/** classes row (camelCase, Drizzle) -> ClassRow (snake_case, old RPC shape). */
export function toClassRowJson(row: typeof classes.$inferSelect) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    created_at: iso(row.createdAt),
    archived_at: iso(row.archivedAt),
  };
}
