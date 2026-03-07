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
  const response = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
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
    throw error
  }

  return payload
}
