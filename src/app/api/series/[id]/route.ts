import { NextResponse } from "next/server";

import { getSeries } from "@/lib/series/source";
import { stripAnswers } from "@/lib/series/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One series, with the answer key removed before it leaves the server. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const series = (await getSeries())[id];
  if (!series) return NextResponse.json({ error: "No such series" }, { status: 404 });

  return NextResponse.json(stripAnswers(series), {
    headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
