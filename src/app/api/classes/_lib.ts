import type { classes } from "@/lib/db/schema";

/** UTC DATETIME -> ISO string, the shape every consumer already expects. */
function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
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
