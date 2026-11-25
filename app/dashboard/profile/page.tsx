import { Suspense } from "react";
import { AccountForm } from "@/components/dashboard/account-form";
import { PageShell } from "@/components/dashboard/page-shell";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { FlashToast } from "@/components/ui/flash-toast";
import { getAccountEmail, getCurrentHost } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env/public";
import { getMessages } from "@/lib/i18n";

export default async function ProfilePage() {
  const t = getMessages().dashboard.profile;
  const [host, account] = await Promise.all([getCurrentHost(), getAccountEmail()]);
  return (
    <PageShell title={t.title}>
      <Suspense>
        <FlashToast param="email" value="confirmed" message={t.account.emailConfirmed} />
      </Suspense>
      <div className="flex flex-col gap-10">
        <ProfileForm
          key={`${host.username}|${host.avatarPath}`}
          host={host}
          appUrl={publicEnv().NEXT_PUBLIC_APP_URL}
        />
        <AccountForm
          key={`${account.email}|${account.pendingEmail}`}
          email={account.email}
          pendingEmail={account.pendingEmail}
          isDemo={host.isDemo}
        />
      </div>
    </PageShell>
  );
}
