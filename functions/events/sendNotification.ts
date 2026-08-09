import { NhostHandler } from '../types';
import { gql } from '../lib/hasura';

interface HasuraEventPayload {
  event: { op: string; data: { new: NotificationRow } };
}

interface NotificationRow {
  id: string;
  channel: 'slack' | 'email';
  target: string;
  message: string;
}

async function sendSlack(webhookUrl: string, message: string): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: message }),
  });
  if (!res.ok) throw new Error(`slack webhook responded ${res.status}`);
}

async function sendEmail(to: string, message: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Disclosed stub -- no email provider configured for this deployment.
    console.log(`[stubbed email - no RESEND_API_KEY set] to=${to} message=${message}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: process.env.NOTIFY_FROM_EMAIL ?? 'workflows@example.com',
      to,
      subject: 'Workflow notification',
      text: message,
    }),
  });
  if (!res.ok) throw new Error(`resend api responded ${res.status}`);
}

/**
 * Hasura Event Trigger handler for `notifications` INSERT. This is what
 * makes `notify` an Event Trigger rather than a step the run engine
 * "just sends from" -- the step handler only ever inserts a row (see
 * functions/lib/runEngine.ts, case 'notify'), and delivery + retry of the
 * actual Slack/email call happens here, independently, with its own
 * status tracked on the notifications row.
 */
const handler: NhostHandler = async (req, res) => {
  const payload = req.body as HasuraEventPayload;
  const notification = payload?.event?.data?.new;

  if (!notification) {
    res.status(200).json({ skipped: true });
    return;
  }

  try {
    if (notification.channel === 'slack') {
      await sendSlack(notification.target, notification.message);
    } else {
      await sendEmail(notification.target, notification.message);
    }

    await gql(
      `mutation ($id: uuid!, $now: timestamptz!) {
        update_notifications_by_pk(pk_columns: { id: $id }, _set: { status: "sent", sent_at: $now }) { id }
      }`,
      { id: notification.id, now: new Date().toISOString() }
    );
    res.status(200).json({ sent: true });
  } catch (err) {
    await gql(
      `mutation ($id: uuid!, $error: String!) {
        update_notifications_by_pk(pk_columns: { id: $id }, _set: { status: "failed", error: $error }) { id }
      }`,
      { id: notification.id, error: (err as Error).message }
    );
    // Hasura will retry this event delivery per retry_conf in metadata.
    res.status(500).json({ message: (err as Error).message });
  }
};

export default handler;
