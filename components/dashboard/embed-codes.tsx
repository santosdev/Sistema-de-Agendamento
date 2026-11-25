"use client";

import { ExternalLink } from "lucide-react";
import { useId, useState } from "react";
import { controlClasses, Field } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { fill, getMessages } from "@/lib/i18n";
import { CopyButton } from "./copy-button";

type Kind = "button" | "inline" | "link";
const KINDS: Kind[] = ["button", "inline", "link"];

/** RN-74: ready-to-paste codes for the agency site (button with popup, inline, direct link). */
export function EmbedCodes({
  events,
  appUrl,
  username,
}: {
  events: { slug: string; title: string }[];
  appUrl: string;
  username: string;
}) {
  const t = getMessages().embed;
  const id = useId();
  const [slug, setSlug] = useState(events[0]?.slug ?? "");
  const [kind, setKind] = useState<Kind>("button");
  if (events.length === 0) return null;

  const url = `${appUrl}/${username}/${slug}`;
  const codes: Record<Kind, string> = {
    button: `<script src="${appUrl}/embed.js" data-url="${url}" data-label="${t.buttonLabel}" async></script>`,
    inline: `<div data-techresolute-inline="${url}"></div>\n<script src="${appUrl}/embed.js" async></script>`,
    link: url,
  };

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="flex flex-col gap-5 rounded-card border border-border bg-surface p-5 shadow-card sm:p-7"
    >
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-title`} className="font-display text-heading text-ink">
          {t.title}
        </h2>
        <p className="text-label text-ink-muted">{t.intro}</p>
      </div>

      <Field id={`${id}-event`} label={t.event}>
        <select
          id={`${id}-event`}
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className={cn(controlClasses, "h-control sm:max-w-sm")}
        >
          {events.map((e) => (
            <option key={e.slug} value={e.slug}>
              {e.title}
            </option>
          ))}
        </select>
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">{t.title}</legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <label
              key={k}
              className="flex min-h-touch cursor-pointer items-center gap-2 rounded-control border border-border bg-surface px-4 text-label text-ink has-checked:border-brand has-checked:bg-slot-selected has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand"
            >
              <input
                type="radio"
                name={`${id}-kind`}
                checked={kind === k}
                onChange={() => setKind(k)}
                className="size-4 accent-brand"
              />
              {t.kinds[k]}
            </label>
          ))}
        </div>
        <p className="text-caption text-ink-muted">{t.hints[kind]}</p>
      </fieldset>

      <pre
        aria-label={fill(t.codeLabel, { kind: t.kinds[kind] })}
        tabIndex={0}
        className="overflow-x-auto rounded-control border border-border bg-surface-soft p-4 text-caption whitespace-pre-wrap text-ink"
      >
        <code>{codes[kind]}</code>
      </pre>

      <div className="flex flex-wrap items-center gap-3">
        <CopyButton value={codes[kind]} label={t.copyCode} />
        <a
          href="/embed-example.html"
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-touch items-center gap-2 rounded-control px-2 text-label font-semibold text-brand underline-offset-2 hover:underline"
        >
          {t.example}
          <ExternalLink aria-hidden="true" className="size-4" />
        </a>
      </div>
    </section>
  );
}
