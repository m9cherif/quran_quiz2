/** PWA manifest — lets hosts and students install the app on a phone. */
export default function manifest() {
  return {
    name: "Quran Quiz Platform",
    short_name: "Quran Quiz",
    description:
      "Host and join live educational quizzes. Real-time question rounds, leaderboards, and results.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#4f46e5",
    icons: [
      { src: "/logo.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/logo.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
    shortcuts: [
      { name: "Join a competition", short_name: "Join", url: "/join" },
      { name: "My quizzes", short_name: "Quizzes", url: "/host/quizzes" },
    ],
  };
}
