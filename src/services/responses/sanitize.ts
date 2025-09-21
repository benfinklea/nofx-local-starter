import crypto from 'node:crypto';

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /apikey/i,
  /api_key/i,
  /credential/i,
  /ssn/i,
  /social/i,
  /phone/i,
  /email/i,
];

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const CREDIT_CARD_REGEX = /\b(?:\d[ -]*?){13,16}\b/;

export interface SanitizedMetadata {
  metadata: Record<string, string>;
  redactedKeys: string[];
}

export function sanitizeMetadata(input: Record<string, string> | undefined | null): SanitizedMetadata {
  if (!input) {
    return { metadata: {}, redactedKeys: [] };
  }

  const output: Record<string, string> = {};
  const redacted: string[] = [];

  for (const [key, value] of Object.entries(input)) {
    if (value == null) continue;
    const trimmed = String(value).trim();
    if (!trimmed) continue;

    if (isAlreadyHashed(trimmed) || isSystemField(key)) {
      output[key] = trimmed;
      continue;
    }

    if (looksSensitiveKey(key) || looksSensitiveValue(trimmed)) {
      output[key] = hashValue(trimmed);
      redacted.push(key);
      continue;
    }

    output[key] = trimmed;
  }

  return { metadata: output, redactedKeys: redacted };
}

function looksSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function looksSensitiveValue(value: string): boolean {
  if (EMAIL_REGEX.test(value)) return true;
  if (CREDIT_CARD_REGEX.test(value.replace(/[- ]/g, ''))) return true;
  if (/^\+?\d{10,15}$/.test(value.replace(/[-() ]/g, ''))) return true;
  return false;
}

function hashValue(value: string): string {
  return `redacted:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function isAlreadyHashed(value: string): boolean {
  return /^redacted:[a-f0-9]{64}$/i.test(value) || /^[a-f0-9]{64}$/i.test(value);
}

function isSystemField(key: string): boolean {
  return key === 'tenant_id' || key === 'tenantId' || key === 'safety_identifier_hash';
}
