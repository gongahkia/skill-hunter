const textEncoder = new TextEncoder();

function toBase64Url(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let encoded = '';

  for (const byte of bytes) {
    encoded += String.fromCharCode(byte);
  }

  return btoa(encoded).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function randomVerifier(length = 64): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (value) => chars[value % chars.length]).join('');
}

export async function createCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(verifier));
  return toBase64Url(digest);
}
