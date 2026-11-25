"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useToast } from "./toast";

/**
 * Shows a toast once when the URL carries ?<param>=<value> (set by a redirect, such as
 * /dashboard?password=updated) and removes the flag so a reload does not repeat it.
 */
export function FlashToast({ param, value, message }: { param: string; value: string; message: string }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const active = params.get(param) === value;

  useEffect(() => {
    if (!active) return;
    toast(message);
    const rest = new URLSearchParams(params);
    rest.delete(param);
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [active, message, param, params, pathname, router, toast]);

  return null;
}
