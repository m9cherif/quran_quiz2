import { getTimelines } from "@/lib/quran/timelineSource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Which pages have a recitation, as the data repo has it now. */
export async function GET() {
  const { index, stale } = await getTimelines();
  return Response.json(index, {
    headers: {
      // Short enough that an edit upstream shows up on its own, long enough
      // that a lobby full of students does not each ask the data repo.
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
      "x-timeline-source": stale ? "committed" : "data-repo",
    },
  });
}
