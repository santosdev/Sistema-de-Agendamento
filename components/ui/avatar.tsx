import Image from "next/image";
import { cn } from "@/lib/cn";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
  return (first + last).toLocaleUpperCase();
}

type AvatarProps = { name: string; src: string | null; size: number; alt?: string; className?: string };

/** Photo or initials fallback (RN-07). Decorative when next to the name (alt=""). */
export function Avatar({ name, src, size, alt = "", className }: AvatarProps) {
  const style = { width: size, height: size };

  if (src) {
    return (
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        className={cn("shrink-0 rounded-full bg-brand-soft object-cover", className)}
        style={style}
      />
    );
  }

  return (
    <span
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-display font-semibold text-brand-soft-ink",
        className,
      )}
      style={{ ...style, fontSize: Math.round(size * 0.38) }}
    >
      {initials(name)}
    </span>
  );
}
