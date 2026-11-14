import Sidebar from "@/components/dashboard/sidebar";
import { PageTransition } from "@/components/ui/page-transition";
import { AuthGuard } from "@/components/auth-guard";
import Link from "next/link";
import { KeyboardShortcutsOverlay } from "@/components/dashboard/keyboard-shortcuts";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg"
      >
        Skip to main content
      </a>
      <div className="flex h-dvh bg-background">
        <Sidebar />
        <main id="main-content" className="min-w-0 flex-1 overflow-auto">
          <div className="mx-auto max-w-[1400px] p-4 pt-[calc(4.75rem+env(safe-area-inset-top))] lg:p-8">
            <div role="note" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-100"><strong>Shared dashboard:</strong> Events, bookings, calendar and analytics here are shared and are not private to your account. <Link href="/secure-account" className="font-semibold underline underline-offset-2">Open your private drafts</Link>.</div>
            <PageTransition>{children}</PageTransition>
          </div>
        </main>
      </div>
      <KeyboardShortcutsOverlay />
    </AuthGuard>
  );
}
