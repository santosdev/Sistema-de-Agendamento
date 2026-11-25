import { PageShell } from "@/components/dashboard/page-shell";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { getCurrentHost } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env/public";
import { getMessages } from "@/lib/i18n";

export default async function ProfilePage() {
  const host = await getCurrentHost();
  return (
    <PageShell title={getMessages().dashboard.profile.title}>
      <ProfileForm
        key={`${host.username}|${host.avatarPath}`}
        host={host}
        appUrl={publicEnv().NEXT_PUBLIC_APP_URL}
      />
    </PageShell>
  );
}
