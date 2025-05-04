export function generateCodeVerifier(length) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
    return Array.from(crypto.getRandomValues(new Uint8Array(length)))
      .map(byte => charset[byte % charset.length])
      .join('')
  }
  
export async function generateCodeChallenge(verifier) {
const encoder = new TextEncoder()
const data = encoder.encode(verifier)
const digest = await crypto.subtle.digest('SHA-256', data)
return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}