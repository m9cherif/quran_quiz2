import { getTimelines } from "@/lib/quran/timelineSource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One page's timeline, straight from the data repo (cached for a few minutes). */
export async function GET(_request, { params }) {
  const { page } = await params;
  const { pages, stale } = await getTimelines();
  const timeline = pages[String(Number(page))];
  if (!timeline) {
    // A page the data repo no longer covers genuinely has no timeline.
    return Response.json({ error: "no timeline for that page" }, { status: 404 });
  }
  return Response.json(timeline, {
    headers: {
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
      "x-timeline-source": stale ? "committed" : "data-repo",
    },
  });
}
