const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const JWT_PATTERN = /\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
const BEARER_TOKEN_PATTERN = /(\bBearer\s+)[A-Za-z0-9._~+\/-]+=*/gi;
const TOKEN_FIELD_VALUE_PATTERN =
  /(\b(?:token|access[_-]?token|refresh[_-]?token|api[_-]?key|authorization|session(?:id)?|secret)\b\s*[:=]\s*)("|')?[A-Za-z0-9._~+\/-]{8,}(?:\2)?/gi;
const NAME_FIELD_VALUE_PATTERN =
  /(\b(?:name|full[_-]?name|first[_-]?name|last[_-]?name|display[_-]?name|user[_-]?name)\b\s*[:=]\s*)([^,\n]+)/gi;

const TOKEN_KEY_PATTERN =
  /(?:token|access[_-]?token|refresh[_-]?token|api[_-]?key|authorization|session(?:id)?|cookie|secret|password)/i;
const EMAIL_KEY_PATTERN = /email/i;
const NAME_KEY_PATTERN = /(?:^name$|full[_-]?name|first[_-]?name|last[_-]?name|display[_-]?name|user[_-]?name)/i;

const REDACTED_EMAIL = "[REDACTED_EMAIL]";
const REDACTED_NAME = "[REDACTED_NAME]";
const REDACTED_TOKEN = "[REDACTED_TOKEN]";

function redactSensitiveString(value: string) {
  return value
    .replace(EMAIL_PATTERN, REDACTED_EMAIL)
    .replace(BEARER_TOKEN_PATTERN, `$1${REDACTED_TOKEN}`)
    .replace(JWT_PATTERN, REDACTED_TOKEN)
    .replace(TOKEN_FIELD_VALUE_PATTERN, `$1${REDACTED_TOKEN}`)
    .replace(NAME_FIELD_VALUE_PATTERN, `$1${REDACTED_NAME}`);
}

function scrubPiiInternal(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return redactSensitiveString(value);
  }

  if (typeof value !== "object") {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactSensitiveString(value.message),
      stack: value.stack ? redactSensitiveString(value.stack) : undefined,
      cause: value.cause ? scrubPiiInternal(value.cause, seen) : undefined
    };
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((entry) => scrubPiiInternal(entry, seen));
  }

  const scrubbed: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    if (TOKEN_KEY_PATTERN.test(key)) {
      scrubbed[key] = REDACTED_TOKEN;
      continue;
    }

    if (EMAIL_KEY_PATTERN.test(key)) {
      scrubbed[key] = REDACTED_EMAIL;
      continue;
    }

    if (NAME_KEY_PATTERN.test(key)) {
      scrubbed[key] = REDACTED_NAME;
      continue;
    }

    scrubbed[key] = scrubPiiInternal(nestedValue, seen);
  }

  return scrubbed;
}

export function scrubPii<T>(value: T): T {
  return scrubPiiInternal(value, new WeakSet<object>()) as T;
}

export function scrubLogMessage(message: string) {
  return redactSensitiveString(message);
}
