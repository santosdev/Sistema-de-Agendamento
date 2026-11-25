"use client";

import { useEffect, useState } from "react";
import { isValidTimeZone } from "@/lib/scheduling/time";

/**
 * RN-36: the guest time zone, detected in the browser after mount (null on the
 * server and on the first client render, so markup matches during hydration).
 */
export function useGuestTimeZone(initial?: string) {
  const [timeZone, setTimeZone] = useState<string | null>(initial ?? null);

  useEffect(() => {
    if (initial) return;
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only value, read once after hydration
    setTimeZone(detected && isValidTimeZone(detected) ? detected : "America/Sao_Paulo");
  }, [initial]);

  return [timeZone, setTimeZone] as const;
}
