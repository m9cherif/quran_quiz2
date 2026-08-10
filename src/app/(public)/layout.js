import AppHeader from "@/components/layout/AppHeader";

export default function PublicLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface-2">
      <AppHeader variant="public" />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border bg-surface py-6 text-center text-sm text-ink-muted">
        © {new Date().getFullYear()} Quran Quiz Platform
      </footer>
    </div>
  );
}