/** A meeting is "past" once it ended (RN-44). Not a stored status. */
export function hasEnded(endAt: string | Date, now: number = Date.now()): boolean {
  return new Date(endAt).getTime() < now;
}
