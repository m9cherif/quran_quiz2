import { NextResponse } from "next/server";

import { getSeries } from "@/lib/series/source";
import { wordCount } from "@/lib/series/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One series.
 *
 * The plan itself is safe to hand over: it holds parameters, never answers.
 * Which words an exercise hides is decided per attempt, on the server, and only
 * the half the student needs is sent — see the start route.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = (await getSeries())[id];
  if (!plan) return NextResponse.json({ error: "No such series" }, { status: 404 });

  return NextResponse.json(
    {
      id: plan.id,
      nom: plan.nom,
      exercices: plan.exercices.map((e, i) => ({
        num: i + 1,
        page: Number(e.page),
        diff: Number(e.diff) || 0,
        mots: wordCount(e),
        limite: Number(e.limite) || 0,
        ecrire_mot: Boolean(e.ecrire_mot),
      })),
    },
    { headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" } }
  );
}
