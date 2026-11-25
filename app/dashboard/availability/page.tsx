import { AvailabilityEditor } from "@/components/dashboard/availability-editor";
import { PageShell } from "@/components/dashboard/page-shell";
import { getAvailability } from "@/lib/dashboard/queries";
import { todayIn } from "@/lib/format";
import { getMessages } from "@/lib/i18n";

export default async function AvailabilityPage() {
  const { timeZone, rules, overrides } = await getAvailability();
  return (
    <PageShell title={getMessages().dashboard.availability.title}>
      <AvailabilityEditor timeZone={timeZone} rules={rules} overrides={overrides} today={todayIn(timeZone)} />
    </PageShell>
  );
}
