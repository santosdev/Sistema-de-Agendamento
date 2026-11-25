import type { EventColor } from "@/lib/design/tokens";

export type LocationType = "google_meet" | "zoom" | "phone" | "in_person" | "custom_link";
export type PhoneMode = "host_calls" | "guest_calls";
export type BookingStatus = "confirmed" | "rescheduled" | "cancelled";

export type QuestionType = "short_text" | "long_text" | "single_choice" | "multi_choice";

export type Question = {
  id: string;
  type: QuestionType;
  label: string;
  required: boolean;
  options?: string[];
};

export type PublicHost = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  timeZone: string;
  welcomeMessage: string | null;
};

/** Event type as shown to guests. location_value of online events is hidden until booked (RN-11). */
export type PublicEvent = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  maxDaysAhead: number;
  locationType: LocationType;
  phoneMode: PhoneMode | null;
  /** Only for in_person (address) before booking. */
  address: string | null;
  color: EventColor;
  questions: Question[];
};

/** Booking returned to the guest right after creating it. */
export type CreatedBooking = {
  token: string;
  startAt: string;
  endAt: string;
  guestEmail: string;
  guestTimeZone: string;
  locationValue: string | null;
};

/** Booking as shown on /booking/[token]. */
export type ManagedBooking = {
  id: string;
  status: BookingStatus;
  startAt: string;
  endAt: string;
  previousStartAt: string | null;
  guestName: string;
  guestEmail: string;
  guestTimeZone: string;
  eventTypeId: string;
  eventSlug: string;
  eventTitle: string;
  eventColor: EventColor;
  locationType: LocationType;
  locationValue: string | null;
  phoneMode: PhoneMode | null;
  host: { id: string; username: string; displayName: string; avatarUrl: string | null; timeZone: string };
  cancelReason: string | null;
  cancelledBy: "guest" | "host" | null;
  icsSequence: number;
  modifyDeadline: string;
  canModify: boolean;
};
