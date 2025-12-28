import { createHash, createHmac, randomBytes } from 'crypto';

/**
 * Generate a SHA256 hash
 */
export function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Generate a SHA256 HMAC
 */
export function hmacSha256(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Generate a random string
 */
export function generateRandomString(length: number = 32): string {
  return randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

/**
 * Generate a unique code for certificates
 */
export function generateCertificateCode(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(4).toString('hex');
  return `ODAN-${timestamp}-${random}`.toUpperCase();
}

/**
 * Verify Telegram auth data
 */
export function verifyTelegramAuth(
  authData: Record<string, string>,
  botToken: string
): boolean {
  const { hash, ...data } = authData;
  
  if (!hash) return false;

  // Create data-check-string
  const checkString = Object.keys(data)
    .sort()
    .map((key) => `${key}=${data[key]}`)
    .join('\n');

  // Create secret key from bot token
  const secretKey = sha256(botToken);
  
  // Calculate hash
  const calculatedHash = createHmac('sha256', Buffer.from(secretKey, 'hex'))
    .update(checkString)
    .digest('hex');

  return calculatedHash === hash;
}
