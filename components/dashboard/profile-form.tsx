"use client";

import { ImageUp, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { TimeZonePicker } from "@/components/booking/time-zone-picker";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { describedBy, Field, Input, Textarea } from "@/components/ui/field";
import type { Host } from "@/lib/auth/session";
import { setAvatarAction, updateProfileAction, type DashboardResult } from "@/lib/dashboard/actions";
import { USERNAME_RE } from "@/lib/dashboard/schemas";
import { fill, getMessages } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { errorText } from "./error-text";
import { Switch } from "./switch";

const AVATAR_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const AVATAR_MAX = 2 * 1024 * 1024;

export function ProfileForm({ host, appUrl }: { host: Host; appUrl: string }) {
  const t = getMessages();
  const tp = t.dashboard.profile;
  const [displayName, setDisplayName] = useState(host.displayName);
  const [username, setUsername] = useState(host.username);
  const [timeZone, setTimeZone] = useState(host.timeZone);
  const [welcome, setWelcome] = useState(host.welcomeMessage ?? "");
  const [isPublic, setIsPublic] = useState(host.isPublic);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ displayName?: string; username?: string }>({});
  const [pending, startTransition] = useTransition();
  const [uploading, startUpload] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const usernameChanged = username.trim().toLowerCase() !== host.username;
  const usernameHint = fill(tp.usernameHint, { url: `${appUrl}/${username.trim().toLowerCase() || "..."}` });

  function result(r: DashboardResult, message: string) {
    if (!r.ok) setError(errorText(r.error));
    else setSuccess(message);
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const errors = {
      displayName: displayName.trim() ? undefined : t.dashboard.events.errors.required,
      username: USERNAME_RE.test(username.trim().toLowerCase()) ? undefined : tp.usernameInvalid,
    };
    setFieldErrors(errors);
    if (errors.displayName || errors.username) return;
    startTransition(async () => {
      const r = await updateProfileAction({
        displayName,
        username,
        timeZone,
        welcomeMessage: welcome,
        isPublic,
      }).catch((): DashboardResult => ({ ok: false, error: "unknown" }));
      result(r, t.dashboard.saved);
    });
  }

  function upload(file: File) {
    setError(null);
    setSuccess(null);
    const ext = AVATAR_TYPES[file.type];
    if (!ext) return setError(tp.avatarType);
    if (file.size > AVATAR_MAX) return setError(tp.avatarTooBig);
    startUpload(async () => {
      const path = `${host.id}/${Date.now().toString(36)}.${ext}`;
      const { error: uploadError } = await createClient()
        .storage.from("avatars")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) return setError(t.dashboard.errors.unknown);
      const r = await setAvatarAction({ path }).catch((): DashboardResult => ({
        ok: false,
        error: "unknown",
      }));
      result(r, t.dashboard.saved);
    });
  }

  return (
    <form noValidate onSubmit={save} className="flex max-w-2xl flex-col gap-6">
      {error ? <Alert>{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}

      <section className="flex flex-col gap-5 rounded-card border border-border bg-surface p-5 shadow-card sm:p-7">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={host.displayName} src={host.avatarUrl} size={72} />
          <div className="flex flex-col gap-2">
            <p className="text-label font-semibold text-ink">{tp.avatar}</p>
            <p id="avatar-hint" className="text-caption text-ink-muted">
              {tp.avatarHint}
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) upload(file);
                }}
              />
              <Button
                variant="secondary"
                size="sm"
                loading={uploading}
                aria-describedby="avatar-hint"
                onClick={() => fileInput.current?.click()}
                icon={<ImageUp aria-hidden="true" className="size-4" />}
              >
                {tp.uploadAvatar}
              </Button>
              {host.avatarPath ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={uploading}
                  onClick={() =>
                    startUpload(async () =>
                      result(
                        await setAvatarAction({ path: null }).catch((): DashboardResult => ({
                          ok: false,
                          error: "unknown",
                        })),
                        t.dashboard.saved,
                      ),
                    )
                  }
                  icon={<Trash2 aria-hidden="true" className="size-4" />}
                >
                  {tp.removeAvatar}
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <Field id="profile-name" label={tp.displayName} error={fieldErrors.displayName}>
          <Input
            id="profile-name"
            autoComplete="name"
            maxLength={80}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            aria-invalid={!!fieldErrors.displayName || undefined}
            aria-describedby={describedBy("profile-name", { error: fieldErrors.displayName })}
          />
        </Field>

        <Field
          id="profile-username"
          label={tp.username}
          hint={host.isDemo ? tp.demoLocked : usernameHint}
          error={fieldErrors.username}
        >
          <Input
            id="profile-username"
            spellCheck={false}
            autoCapitalize="none"
            maxLength={30}
            readOnly={host.isDemo}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            aria-invalid={!!fieldErrors.username || undefined}
            aria-describedby={describedBy("profile-username", {
              hint: host.isDemo ? tp.demoLocked : usernameHint,
              error: fieldErrors.username,
            })}
          />
        </Field>
        {usernameChanged && !host.isDemo ? <Alert tone="info">{tp.usernameWarning}</Alert> : null}

        <div className="flex flex-col gap-1.5">
          <p id="profile-tz-label" className="text-label text-ink-secondary">
            {tp.timeZone}
          </p>
          <div className="w-fit rounded-control border border-border-input">
            <TimeZonePicker value={timeZone} onChange={setTimeZone} align="left" />
          </div>
        </div>
        {timeZone !== host.timeZone ? <Alert tone="info">{tp.timeZoneWarning}</Alert> : null}

        <Field id="profile-welcome" label={tp.welcome} optionalLabel={t.common.optional}>
          <Textarea
            id="profile-welcome"
            maxLength={500}
            value={welcome}
            onChange={(e) => setWelcome(e.target.value)}
          />
        </Field>

        <div className="flex items-center justify-between gap-3 rounded-control border border-border px-4 py-1">
          <div className="py-2">
            <p className="text-label text-ink-secondary">{tp.isPublic}</p>
            <p className="text-caption text-ink-muted">{tp.isPublicHint}</p>
          </div>
          <Switch checked={isPublic} label={tp.isPublic} onChange={setIsPublic} />
        </div>
      </section>

      <Button type="submit" size="lg" loading={pending} className="sm:w-fit sm:min-w-48">
        {pending ? t.dashboard.saving : t.dashboard.save}
      </Button>
    </form>
  );
}
