import localFont from "next/font/local";
import "../styles/tokens.css";
import "../styles/global.css";
import Providers from "./providers";
import { themeBootScript } from "@/lib/theme/ThemeProvider";
import { accentBootScript } from "@/components/ui/AccentPicker";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

export const metadata = {
  title: {
    default: "Quran Quiz Platform",
    template: "%s | Quran Quiz Platform",
  },
  description:
    "Host and join live educational quizzes. Real-time question rounds, leaderboards, and results.",
  applicationName: "Quran Quiz",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Quran Quiz",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before first paint (no white flash). */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript + accentBootScript }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
