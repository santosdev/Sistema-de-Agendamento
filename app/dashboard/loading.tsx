import { PageSkeleton } from "@/components/dashboard/page-shell";
import { getMessages } from "@/lib/i18n";

export default function Loading() {
  return <PageSkeleton title={getMessages().dashboard.nav.meetings} />;
}
