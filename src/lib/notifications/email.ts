import nodemailer from "nodemailer";
import { getDatabase } from "../database";
import { site } from "../site";
import type { CredentialDelivery } from "../admin/credential-service";

function transporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) return null;
  return nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587), secure: Number(process.env.SMTP_PORT) === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
}

export function isUniversityMailConfigured() {
  return Boolean(transporter() && process.env.APP_URL && process.env.SMTP_FROM);
}

export async function sendInitialCredentials(electionId: string, electionTitle: string, deliveries: CredentialDelivery[]) {
  const mailer = transporter();
  if (!mailer) throw new Error("University email service is not configured. No credentials were sent.");
  const appUrl = process.env.APP_URL;
  if (!appUrl) throw new Error("APP_URL is not configured.");
  let sent = 0; let failed = 0; const failedCredentialEventIds: string[] = [];
  for (const delivery of deliveries) {
    try {
      await mailer.sendMail({ from: process.env.SMTP_FROM, to: delivery.email, subject: `${site.name}: temporary password for ${electionTitle}`, text: `Hello ${delivery.fullName},\n\nYou are eligible to vote in ${electionTitle}.\n\nOpen ${appUrl}/vote?e=${encodeURIComponent(electionId)} and sign in with:\nEmail: ${delivery.email}\nTemporary password: ${delivery.temporaryPassword}\n\nYou will be required to create a new password. Do not share this password.\n\nSupport: ${site.supportEmail}` });
      sent += 1;
      await getDatabase().query(`UPDATE credential_events SET delivery_status = 'SENT', sent_at = now() WHERE id = $1`, [delivery.credentialEventId]);
    } catch {
      failed += 1;
      failedCredentialEventIds.push(delivery.credentialEventId);
      await getDatabase().query(`UPDATE credential_events SET delivery_status = 'FAILED' WHERE id = $1`, [delivery.credentialEventId]);
    }
  }
  return { sent, failed, failedCredentialEventIds };
}