import { NextResponse } from "next/server";

import { getSeries, } from "@/lib/series/source";
import { pointsFor } from "@/lib/series/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Every series on offer, as a list — no exercises, no answers. */
export async function GET() {
  const series = await getSeries();
  const list = Object.values(series)
    .map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description ?? null,
      level: s.level ?? null,
      pages: s.pages ?? [],
      exercises: s.exercises.length,
      totalPoints: s.exercises.reduce((sum, e) => sum + pointsFor(e), 0),
    }))
    .sort((a, b) => (a.level ?? 99) - (b.level ?? 99) || a.title.localeCompare(b.title));

  return NextResponse.json(list, {
    headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
