export const metadata = {
  title: "Sign in",
};

import Link from "next/link";

export default function AuthLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-2 px-4 py-16">
      {children}
      <p className="mt-6 text-sm text-ink-muted">
        <Link href="/" className="font-medium text-primary hover:underline">
          Back to home
        </Link>
      </p>
    </div>
  );
}