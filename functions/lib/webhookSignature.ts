import { createHmac, timingSafeEqual } from 'crypto';

/**
 * HMAC-SHA256 signature check for inbound workflow webhooks, same shape as
 * Stripe/GitHub webhook verification: the caller signs the raw request body
 * with the trigger's stored secret and sends it as `x-webhook-signature`.
 * This -- not hiding the secret from the GraphQL API -- is the actual
 * security boundary for the webhook trigger type.
 */
export function verifyWebhookSignature(rawBody: string, secret: string, signatureHeader: string | undefined): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signatureHeader, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
