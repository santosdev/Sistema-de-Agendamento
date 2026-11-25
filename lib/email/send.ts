import "server-only";
import { Resend } from "resend";
import { serverEnv } from "@/lib/env/server";

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  ics?: { content: string; cancel: boolean };
};

let client: Resend | null | undefined;

function resend(): Resend | null {
  if (client === undefined) {
    const key = serverEnv().RESEND_API_KEY;
    client = key ? new Resend(key) : null;
  }
  return client;
}

/**
 * Sends one e-mail. Never throws (RN-58): a failure is logged and the booking stays as it is.
 * Without RESEND_API_KEY the e-mail is skipped and logged, so local runs work without Resend.
 */
export async function sendEmail(email: OutgoingEmail): Promise<boolean> {
  try {
    const api = resend();
    if (!api) {
      console.info(`[email skipped: no RESEND_API_KEY] ${email.subject}`);
      return false;
    }
    const { error } = await api.emails.send({
      from: serverEnv().EMAIL_FROM,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      attachments: email.ics
        ? [
            {
              filename: email.ics.cancel ? "cancelamento.ics" : "reuniao.ics",
              content: Buffer.from(email.ics.content, "utf8"),
              contentType: `text/calendar; charset=utf-8; method=${email.ics.cancel ? "CANCEL" : "PUBLISH"}`,
            },
          ]
        : undefined,
    });
    if (error) {
      console.error("email failed", email.subject, error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("email failed", email.subject, error);
    return false;
  }
}
