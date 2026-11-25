import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 rounded-control hover:text-ink">
      <ArrowLeft aria-hidden="true" className="size-4" />
      {label}
    </Link>
  );
}
