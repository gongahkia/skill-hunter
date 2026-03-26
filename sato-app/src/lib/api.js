import { logClientEvent } from './debug'

let clientRequestSequence = 0

export function parseApiError(payload, fallbackMessage = 'The request failed.') {
  if (payload?.error?.message) {
    return payload.error.message
  }

  if (typeof payload?.message === 'string' && payload.message.trim()) {
    return payload.message
  }

  return fallbackMessage
}

export async function apiRequest(path, options = {}) {
  clientRequestSequence += 1
  const clientRequestId = `client-${clientRequestSequence}`
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()

  logClientEvent('api.request.started', {
    clientRequestId,
    path,
    method: options.method || 'GET',
  })

  const response = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Sato-Client-Request-Id': clientRequestId,
      ...(options.headers || {}),
    },
    ...options,
  })

  const rawBody = await response.text()
  let payload = null

  if (rawBody) {
    try {
      payload = JSON.parse(rawBody)
    } catch {
      payload = null
    }
  }

  if (!response.ok) {
    const error = new Error(parseApiError(payload, `Request failed with status ${response.status}.`))
    error.status = response.status
    error.payload = payload
    error.requestId = response.headers?.get?.('X-Sato-Request-Id') || null
    logClientEvent('api.request.failed', {
      clientRequestId,
      requestId: error.requestId,
      path,
      method: options.method || 'GET',
      status: response.status,
      durationMs: Number(((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt).toFixed(2)),
      payload,
    })
    throw error
  }

  logClientEvent('api.request.completed', {
    clientRequestId,
    requestId: response.headers?.get?.('X-Sato-Request-Id') || null,
    path,
    method: options.method || 'GET',
    status: response.status,
    durationMs: Number(((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt).toFixed(2)),
  })

  return payload
}

export async function fetchMoodProfiles() {
  return apiRequest('/api/mood-profiles')
}
