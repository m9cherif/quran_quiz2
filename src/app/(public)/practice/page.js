export const metadata = {
  title: "Listen & follow",
};

import PracticeBrowser from "./PracticeBrowser";

export default function PracticePage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <PracticeBrowser />
    </div>
  );
}
