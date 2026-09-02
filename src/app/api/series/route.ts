import { NextResponse } from "next/server";

import { getSeries } from "@/lib/series/source";
import { wordCount } from "@/lib/series/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Every series on offer, with what each exercise asks for. */
export async function GET() {
  const plans = await getSeries();
  const list = Object.values(plans).map((plan) => ({
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
  }));

  return NextResponse.json(list, {
    headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
