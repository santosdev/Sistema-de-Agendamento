import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ManageBooking } from "@/components/manage/manage-booking";
import { SiteHeader } from "@/components/site-header";
import { getBookingByToken } from "@/lib/booking/queries";
import { hasEnded } from "@/lib/booking/status";
import { getMessages } from "@/lib/i18n";

export const metadata: Metadata = {
  title: getMessages().manage.title,
  // The URL carries a secret token: keep it out of search engines and referrers.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** /booking/[token]: guest view, cancel or reschedule (RN-47 to RN-55). */
export default async function ManagePage({ params }: PageProps<"/booking/[token]">) {
  const { token } = await params;
  const booking = await getBookingByToken(token);
  if (!booking) notFound();

  const isPast = hasEnded(booking.endAt);

  return (
    <>
      <SiteHeader width="max-w-[720px]" />
      <main id="main" className="mx-auto flex w-full max-w-[720px] flex-1 flex-col px-4 pb-12 sm:px-6">
        <ManageBooking token={token} booking={booking} isPast={isPast} />
      </main>
    </>
  );
}
