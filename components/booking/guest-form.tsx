"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import type { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { describedBy, Field, FieldError, Input, Textarea } from "@/components/ui/field";
import { guestFormSchema } from "@/lib/booking/schemas";
import type { PublicEvent, Question } from "@/lib/booking/types";
import { cn } from "@/lib/cn";
import { getMessages } from "@/lib/i18n";

type Schema = ReturnType<typeof guestFormSchema>;
export type GuestFormInput = z.input<Schema>;
export type GuestFormOutput = z.output<Schema>;

type Props = {
  event: PublicEvent;
  submitting: boolean;
  serverError: string | null;
  onSubmit: (values: GuestFormOutput) => void;
  /** Renders the submit button; on mobile it is fixed at the bottom. */
  formId: string;
};

function defaultAnswer(q: Question) {
  return q.type === "multi_choice" ? [] : "";
}

export function GuestForm({ event, submitting, serverError, onSubmit, formId }: Props) {
  const t = getMessages().booking.form;
  const schema = useMemo(() => guestFormSchema(event, t), [event, t]);
  const phoneRequired = event.locationType === "phone" && event.phoneMode === "host_calls";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitted },
  } = useForm<GuestFormInput, unknown, GuestFormOutput>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      website: "",
      answers: Object.fromEntries(event.questions.map((q) => [q.id, defaultAnswer(q)])),
    },
  });

  const answerErrors = (errors.answers ?? {}) as FieldErrors<Record<string, unknown>>;
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <form id={formId} noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <h2 tabIndex={-1} className="font-display text-heading text-ink focus:outline-none">
        {t.heading}
      </h2>

      {serverError ? <Alert>{serverError}</Alert> : null}
      {isSubmitted && hasErrors && !serverError ? <Alert>{t.fixErrors}</Alert> : null}

      <Field id="guest-name" label={t.name} error={errors.name?.message}>
        <Input
          id="guest-name"
          autoComplete="name"
          aria-invalid={!!errors.name || undefined}
          aria-describedby={describedBy("guest-name", { error: errors.name?.message })}
          {...register("name")}
        />
      </Field>

      <Field id="guest-email" label={t.email} error={errors.email?.message}>
        <Input
          id="guest-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          spellCheck={false}
          aria-invalid={!!errors.email || undefined}
          aria-describedby={describedBy("guest-email", { error: errors.email?.message })}
          {...register("email")}
        />
      </Field>

      <Field
        id="guest-phone"
        label={phoneRequired ? t.phoneForCall : t.phone}
        optionalLabel={phoneRequired ? undefined : getMessages().common.optional}
        hint={t.phoneHint}
        error={errors.phone?.message}
      >
        <Input
          id="guest-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          aria-invalid={!!errors.phone || undefined}
          aria-describedby={describedBy("guest-phone", { hint: t.phoneHint, error: errors.phone?.message })}
          {...register("phone")}
        />
      </Field>

      {event.questions.map((q) => {
        const fieldId = `q-${q.id}`;
        const error = answerErrors[q.id]?.message as string | undefined;
        const optional = q.required ? undefined : getMessages().common.optional;

        if (q.type === "short_text" || q.type === "long_text") {
          const Control = q.type === "short_text" ? Input : Textarea;
          return (
            <Field key={q.id} id={fieldId} label={q.label} optionalLabel={optional} error={error}>
              <Control
                id={fieldId}
                aria-invalid={!!error || undefined}
                aria-describedby={describedBy(fieldId, { error })}
                {...register(`answers.${q.id}`)}
              />
            </Field>
          );
        }

        const multiple = q.type === "multi_choice";
        return (
          <fieldset
            key={q.id}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? `${fieldId}-error` : undefined}
            className="flex flex-col gap-2"
          >
            <legend className="mb-1.5 text-label text-ink-secondary">
              {q.label}
              {optional ? <span className="ml-1 text-ink-muted">{optional}</span> : null}
            </legend>
            {q.options?.map((option, i) => (
              <label
                key={option}
                className={cn(
                  "flex min-h-control cursor-pointer items-center gap-3 rounded-control border border-border bg-surface px-4 text-label text-ink",
                  "transition-colors hover:border-brand has-checked:border-brand has-checked:bg-slot-selected",
                  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand",
                )}
              >
                <input
                  type={multiple ? "checkbox" : "radio"}
                  value={option}
                  id={`${fieldId}-${i}`}
                  className="size-4 accent-brand focus-visible:outline-none"
                  {...register(`answers.${q.id}`)}
                />
                {option}
              </label>
            ))}
            {error ? <FieldError id={`${fieldId}-error`}>{error}</FieldError> : null}
          </fieldset>
        );
      })}

      {/* Honeypot: hidden from people and assistive tech. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="guest-website">Website</label>
        <input id="guest-website" tabIndex={-1} autoComplete="off" {...register("website")} />
      </div>

      <p className="text-caption text-ink-muted">{t.privacy}</p>

      <Button type="submit" size="lg" loading={submitting} className="hidden w-full sm:inline-flex">
        {submitting ? t.submitting : t.submit}
      </Button>
    </form>
  );
}
