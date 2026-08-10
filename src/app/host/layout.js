import AppHeader from "@/components/layout/AppHeader";
import RequireUser from "@/components/auth/RequireUser";

export const metadata = {
  title: "Host",
};

export default function HostLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface-2">
      <AppHeader variant="host" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <RequireUser role="host">{children}</RequireUser>
      </main>
    </div>
  );
}