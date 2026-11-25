/** Error codes raised by the database booking functions (docs/BANCO.md). */
const DB_CODES = [
  "event_not_found",
  "booking_not_found",
  "not_authenticated",
  "invalid_guest",
  "invalid_answers",
  "invalid_input",
  "slot_in_past",
  "outside_notice",
  "outside_booking_window",
  "outside_availability",
  "daily_limit_reached",
  "slot_taken",
  "booking_already_cancelled",
  "modification_deadline_passed",
  "demo_seed_protected",
] as const;

export type DbErrorCode = (typeof DB_CODES)[number];

/** Codes the booking UI knows how to explain. */
export type BookingErrorCode =
  | "slot_taken"
  | "slot_unavailable"
  | "daily_limit_reached"
  | "event_not_found"
  | "invalid_guest"
  | "invalid_answers"
  | "rate_limited"
  | "unknown";

/** Codes the manage page knows how to explain. */
export type ManageErrorCode =
  | "booking_not_found"
  | "booking_already_cancelled"
  | "modification_deadline_passed"
  | "demo_seed_protected"
  | BookingErrorCode;

export function dbErrorCode(error: { message?: string } | null | undefined): DbErrorCode | null {
  const message = error?.message ?? "";
  return (DB_CODES as readonly string[]).includes(message) ? (message as DbErrorCode) : null;
}

/** Collapses slot rule failures into what the guest can act on. */
export function toBookingError(code: DbErrorCode | null): BookingErrorCode {
  switch (code) {
    case "slot_taken":
    case "daily_limit_reached":
    case "event_not_found":
    case "invalid_guest":
    case "invalid_answers":
      return code;
    case "slot_in_past":
    case "outside_notice":
    case "outside_booking_window":
    case "outside_availability":
    case "invalid_input":
      return "slot_unavailable";
    default:
      return "unknown";
  }
}

export function toManageError(code: DbErrorCode | null): ManageErrorCode {
  switch (code) {
    case "booking_not_found":
    case "booking_already_cancelled":
    case "modification_deadline_passed":
    case "demo_seed_protected":
      return code;
    default:
      return toBookingError(code);
  }
}
