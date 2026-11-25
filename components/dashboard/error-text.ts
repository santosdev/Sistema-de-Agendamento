import type { DashboardErrorCode } from "@/lib/dashboard/actions";
import { getMessages } from "@/lib/i18n";

/** Human text for a dashboard action error (falls back to the booking and manage messages). */
export function errorText(code: DashboardErrorCode): string {
  const t = getMessages();
  const d = t.dashboard;
  const map: Partial<Record<DashboardErrorCode, string>> = {
    ...t.booking.errors,
    ...t.manage.errors,
    ...d.errors,
    slug_taken: d.events.errors.slugTaken,
    username_taken: d.profile.usernameTaken,
    username_reserved: d.profile.usernameReserved,
    override_conflict: d.availability.conflict,
  };
  return map[code] ?? d.errors.unknown;
}
