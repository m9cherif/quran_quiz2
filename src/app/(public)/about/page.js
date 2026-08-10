export const metadata = {
  title: "About",
};

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold text-ink">About the platform</h1>
      <div className="mt-6 space-y-6 text-base leading-relaxed text-ink-muted">
        <p>
          Quran Quiz Platform is a real-time educational quiz tool. Teachers create
          quizzes and host live games with a shared join code; students answer on their
          own devices while scores and the leaderboard update instantly.
        </p>
        <p>
          The platform is being prepared for Arabic-first content, including Quran
          memorization questions with surah and ayah references, with full
          right-to-left support.
        </p>
        <p>
          Everything runs on Supabase — authentication, the database, and realtime
          updates — so questions, answers, and game state stay in sync without extra
          infrastructure.
        </p>
      </div>
    </div>
  );
}