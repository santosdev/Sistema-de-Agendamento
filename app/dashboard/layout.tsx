import type { Metadata } from "next";
import { Suspense } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { getCurrentHost } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env/public";
import { getMessages } from "@/lib/i18n";

export const metadata: Metadata = {
  title: getMessages().dashboard.nav.label,
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      {/* The session read streams in; the page content has its own boundary (loading.tsx). */}
      <Suspense fallback={<div className="h-[68px] bg-sidebar lg:h-dvh lg:w-60" aria-hidden="true" />}>
        <DashboardNav />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

async function DashboardNav() {
  const host = await getCurrentHost();
  return <Sidebar publicUrl={`${publicEnv().NEXT_PUBLIC_APP_URL}/${host.username}`} isDemo={host.isDemo} />;
}
