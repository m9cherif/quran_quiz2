export const metadata = {
  title: "Series",
};

import SeriesRunner from "./SeriesRunner";

export default async function StudentSeriesRunPage({ params }) {
  const { id } = await params;
  return <SeriesRunner seriesId={id} />;
}
