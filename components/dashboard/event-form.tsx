"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useFieldArray, useForm, type FieldError as RhfError } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { controlClasses, describedBy, Field, Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { archiveEventTypeAction, saveEventTypeAction, type DashboardResult } from "@/lib/dashboard/actions";
import {
  eventTypeSchema,
  LOCATION_TYPES,
  newQuestionId,
  QUESTION_TYPES,
  SLOT_INTERVALS,
  slugify,
  type EventFormValues,
  type EventTypeRow,
} from "@/lib/dashboard/schemas";
import { EVENT_COLOR_NAMES, EVENT_COLORS } from "@/lib/design/tokens";
import { fill, getMessages } from "@/lib/i18n";
import { ConfirmDialog } from "./confirm-dialog";
import { errorText } from "./error-text";
import { Switch } from "./switch";

type Props = { id?: string; initial: EventFormValues; baseUrl: string };

const selectClasses = cn(controlClasses, "h-control");

export function EventForm({ id, initial, baseUrl }: Props) {
  const t = getMessages();
  const te = t.dashboard.events;
  const router = useRouter();
  const schema = useMemo(() => eventTypeSchema(te.errors), [te]);
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitted, dirtyFields },
  } = useForm<EventFormValues, unknown, EventTypeRow>({
    resolver: zodResolver(schema),
    defaultValues: initial,
    mode: "onTouched",
  });
  const questions = useFieldArray({ control, name: "questions" });
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const slugEdited = useRef(Boolean(id));

  const locationType = watch("locationType");
  const phoneMode = watch("phoneMode");
  const slug = watch("slug");
  const isActive = watch("isActive");
  const color = watch("color");
  const slugHint = fill(te.fields.slugHint, { url: `${baseUrl}/${slug || "..."}` });

  const err = (e: RhfError | undefined) => e?.message;
  const num = (name: keyof EventFormValues, label: string, hint?: string) => (
    <Field id={`ev-${name}`} label={label} hint={hint} error={err(errors[name] as RhfError)}>
      <Input
        id={`ev-${name}`}
        inputMode="numeric"
        aria-invalid={!!errors[name] || undefined}
        aria-describedby={describedBy(`ev-${name}`, { hint, error: err(errors[name] as RhfError) })}
        {...register(name)}
      />
    </Field>
  );

  function done(result: DashboardResult, message: string) {
    if (!result.ok) {
      setServerError(errorText(result.error));
      return false;
    }
    setSaved(message);
    return true;
  }

  const submit = handleSubmit(() => {
    setServerError(null);
    setSaved(null);
    startTransition(async () => {
      const result = await saveEventTypeAction({ id, values: getValues() }).catch((): DashboardResult => ({
        ok: false,
        error: "unknown",
      }));
      if (done(result, id ? t.dashboard.saved : te.created) && !id && result.ok) {
        router.push(`/dashboard/events/${result.id}`);
      }
    });
  });

  return (
    <form noValidate onSubmit={submit} className="flex max-w-3xl flex-col gap-6">
      {serverError ? <Alert>{serverError}</Alert> : null}
      {isSubmitted && Object.keys(errors).length > 0 && !serverError ? (
        <Alert>{t.dashboard.errors.invalid_input}</Alert>
      ) : null}
      {saved ? <Alert tone="success">{saved}</Alert> : null}

      <Section title={te.sections.basics}>
        <Field id="ev-title" label={te.fields.title} error={err(errors.title)}>
          <Input
            id="ev-title"
            aria-invalid={!!errors.title || undefined}
            aria-describedby={describedBy("ev-title", { error: err(errors.title) })}
            {...register("title", {
              onChange: (e) => {
                if (!slugEdited.current)
                  setValue("slug", slugify(e.target.value), {
                    shouldValidate: isSubmitted || !!dirtyFields.slug,
                  });
              },
            })}
          />
        </Field>
        <Field id="ev-slug" label={te.fields.slug} hint={slugHint} error={err(errors.slug)}>
          <Input
            id="ev-slug"
            spellCheck={false}
            autoCapitalize="none"
            aria-invalid={!!errors.slug || undefined}
            aria-describedby={describedBy("ev-slug", { hint: slugHint, error: err(errors.slug) })}
            {...register("slug", { onChange: () => (slugEdited.current = true) })}
          />
        </Field>
        <Field id="ev-description" label={te.fields.description} optionalLabel={t.common.optional}>
          <Textarea id="ev-description" maxLength={1000} {...register("description")} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          {num("durationMinutes", te.fields.duration)}
          <Field id="ev-interval" label={te.fields.interval}>
            <select id="ev-interval" className={selectClasses} {...register("slotIntervalMinutes")}>
              {SLOT_INTERVALS.map((n) => (
                <option key={n} value={String(n)}>
                  {fill(t.common.minutes, { n })}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-label text-ink-secondary">{te.fields.color}</legend>
          <div className="flex flex-wrap gap-2">
            {EVENT_COLOR_NAMES.map((c) => (
              <label
                key={c}
                className="relative flex size-touch cursor-pointer items-center justify-center rounded-full has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand"
              >
                <input type="radio" value={c} className="sr-only" {...register("color")} />
                <span className="sr-only">{te.colors[c]}</span>
                <span
                  aria-hidden="true"
                  className={cn("size-8 rounded-full", color === c && "ring-2 ring-ink ring-offset-2")}
                  style={{ backgroundColor: EVENT_COLORS[c] }}
                />
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex items-center justify-between gap-3 rounded-control border border-border px-4 py-1">
          <span id="ev-active-label" className="text-label text-ink-secondary">
            {te.fields.active}
          </span>
          <Switch
            checked={isActive}
            label={te.fields.active}
            stateLabel={isActive ? te.active : te.inactive}
            onChange={(v) => setValue("isActive", v, { shouldDirty: true })}
          />
        </div>
      </Section>

      <Section title={te.sections.location}>
        <Field id="ev-location" label={te.fields.location}>
          <select id="ev-location" className={selectClasses} {...register("locationType")}>
            {LOCATION_TYPES.map((l) => (
              <option key={l} value={l}>
                {t.location[l]}
              </option>
            ))}
          </select>
        </Field>
        {locationType === "in_person" ? (
          <Field id="ev-address" label={te.fields.address} error={err(errors.address)}>
            <Input
              id="ev-address"
              autoComplete="street-address"
              aria-invalid={!!errors.address || undefined}
              aria-describedby={describedBy("ev-address", { error: err(errors.address) })}
              {...register("address")}
            />
          </Field>
        ) : locationType === "phone" ? (
          <>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-label text-ink-secondary">{te.fields.phoneMode}</legend>
              {(["host_calls", "guest_calls"] as const).map((mode) => (
                <label
                  key={mode}
                  className="flex min-h-control cursor-pointer items-center gap-3 rounded-control border border-border bg-surface px-4 text-label text-ink has-checked:border-brand has-checked:bg-slot-selected has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand"
                >
                  <input
                    type="radio"
                    value={mode}
                    className="size-4 accent-brand"
                    {...register("phoneMode")}
                  />
                  {mode === "host_calls" ? te.fields.hostCalls : te.fields.guestCalls}
                </label>
              ))}
            </fieldset>
            {phoneMode === "guest_calls" ? (
              <Field
                id="ev-phone"
                label={te.fields.hostPhone}
                hint={t.booking.form.phoneHint}
                error={err(errors.hostPhone)}
              >
                <Input
                  id="ev-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  aria-invalid={!!errors.hostPhone || undefined}
                  aria-describedby={describedBy("ev-phone", {
                    hint: t.booking.form.phoneHint,
                    error: err(errors.hostPhone),
                  })}
                  {...register("hostPhone")}
                />
              </Field>
            ) : null}
          </>
        ) : (
          <Field id="ev-link" label={te.fields.link} error={err(errors.link)}>
            <Input
              id="ev-link"
              type="url"
              inputMode="url"
              spellCheck={false}
              placeholder="https://"
              aria-invalid={!!errors.link || undefined}
              aria-describedby={describedBy("ev-link", { error: err(errors.link) })}
              {...register("link")}
            />
          </Field>
        )}
      </Section>

      <Section title={te.sections.rules}>
        <div className="grid gap-5 sm:grid-cols-2">
          {num("minNoticeHours", te.fields.minNotice)}
          {num("maxDaysAhead", te.fields.maxDays)}
          {num("bufferBeforeMinutes", te.fields.bufferBefore)}
          {num("bufferAfterMinutes", te.fields.bufferAfter)}
          {num("dailyLimit", te.fields.dailyLimit, te.fields.dailyLimitHint)}
        </div>
      </Section>

      <Section title={te.sections.questions}>
        {questions.fields.length === 0 ? (
          <p className="text-label text-ink-muted">{te.questions.none}</p>
        ) : null}
        <ol className="flex flex-col gap-4">
          {questions.fields.map((q, i) => {
            const qErrors = errors.questions?.[i];
            const type = watch(`questions.${i}.type`);
            return (
              <li
                key={q.id}
                className="flex flex-col gap-4 rounded-card-sm border border-border bg-surface-soft p-4"
              >
                <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
                  <Field id={`q-${i}-label`} label={te.questions.label} error={err(qErrors?.label)}>
                    <Input
                      id={`q-${i}-label`}
                      aria-invalid={!!qErrors?.label || undefined}
                      aria-describedby={describedBy(`q-${i}-label`, { error: err(qErrors?.label) })}
                      {...register(`questions.${i}.label`)}
                    />
                  </Field>
                  <Field id={`q-${i}-type`} label={te.questions.type}>
                    <select id={`q-${i}-type`} className={selectClasses} {...register(`questions.${i}.type`)}>
                      {QUESTION_TYPES.map((qt) => (
                        <option key={qt} value={qt}>
                          {te.questions.types[qt]}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                {type === "single_choice" || type === "multi_choice" ? (
                  <Field
                    id={`q-${i}-options`}
                    label={te.questions.options}
                    hint={te.questions.optionsHint}
                    error={err(qErrors?.optionsText)}
                  >
                    <Textarea
                      id={`q-${i}-options`}
                      aria-invalid={!!qErrors?.optionsText || undefined}
                      aria-describedby={describedBy(`q-${i}-options`, {
                        hint: te.questions.optionsHint,
                        error: err(qErrors?.optionsText),
                      })}
                      {...register(`questions.${i}.optionsText`)}
                    />
                  </Field>
                ) : null}
                <div className="flex items-center justify-between gap-3">
                  <label className="flex min-h-touch cursor-pointer items-center gap-2 text-label text-ink">
                    <input
                      type="checkbox"
                      className="size-4 accent-brand"
                      {...register(`questions.${i}.required`)}
                    />
                    {te.questions.required}
                  </label>
                  <button
                    type="button"
                    onClick={() => questions.remove(i)}
                    aria-label={fill(te.questions.remove, { n: i + 1 })}
                    className="inline-flex size-touch items-center justify-center rounded-control text-danger hover:bg-danger-soft"
                  >
                    <Trash2 aria-hidden="true" className="size-5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
        {questions.fields.length < 10 ? (
          <Button
            variant="secondary"
            onClick={() =>
              questions.append({
                id: newQuestionId(),
                type: "short_text",
                label: "",
                required: false,
                optionsText: "",
              })
            }
            icon={<Plus aria-hidden="true" className="size-4" />}
            className="w-fit"
          >
            {te.questions.add}
          </Button>
        ) : (
          <p className="text-caption text-ink-muted">{te.questions.max}</p>
        )}
      </Section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        {id ? (
          <Button variant="danger" onClick={() => setArchiveOpen(true)}>
            {te.archive}
          </Button>
        ) : null}
        <Button type="submit" size="lg" loading={pending} className="sm:ml-auto sm:min-w-48">
          {pending ? t.dashboard.saving : t.dashboard.save}
        </Button>
      </div>

      {id ? (
        <ConfirmDialog
          open={archiveOpen}
          title={fill(te.archiveTitle, { title: getValues("title") })}
          body={te.archiveBody}
          confirmLabel={te.archiveConfirm}
          cancelLabel={t.manage.cancelDialog.keep}
          pending={pending}
          onClose={() => setArchiveOpen(false)}
          onConfirm={() =>
            startTransition(async () => {
              const result = await archiveEventTypeAction({ id }).catch((): DashboardResult => ({
                ok: false,
                error: "unknown",
              }));
              setArchiveOpen(false);
              if (done(result, "")) router.push("/dashboard/events");
            })
          }
        />
      ) : null}
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5 rounded-card border border-border bg-surface p-5 shadow-card sm:p-7">
      <h2 className="font-display text-heading text-ink">{title}</h2>
      {children}
    </section>
  );
}
