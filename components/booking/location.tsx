import { Link2, MapPin, Phone, Video } from "lucide-react";
import type { LocationType, PhoneMode } from "@/lib/booking/types";
import { getMessages } from "@/lib/i18n";

export function LocationIcon({ type, className }: { type: LocationType; className?: string }) {
  const Icon = { google_meet: Video, zoom: Video, phone: Phone, in_person: MapPin, custom_link: Link2 }[type];
  return <Icon aria-hidden="true" className={className} />;
}

type LocationInfo = { label: string; detail: string | null; href: string | null };

/**
 * What to show about the location. Before booking, online links stay hidden (RN-11);
 * after booking, pass the revealed value.
 */
export function describeLocation(
  type: LocationType,
  phoneMode: PhoneMode | null,
  value: string | null,
  { booked }: { booked: boolean },
): LocationInfo {
  const t = getMessages().location;
  const label = t[type];

  switch (type) {
    case "in_person":
      return { label, detail: value, href: null };
    case "phone":
      if (phoneMode === "guest_calls") {
        return {
          label,
          detail: booked && value ? value : t.guestCalls,
          href: booked && value ? `tel:${value}` : null,
        };
      }
      return { label, detail: t.hostCalls, href: null };
    default:
      return {
        label,
        detail: booked ? value : t.revealedAfter,
        href: booked && value ? value : null,
      };
  }
}
