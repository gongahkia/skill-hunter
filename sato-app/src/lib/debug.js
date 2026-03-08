const MAX_DEBUG_EVENTS = 300

function debugEnabled() {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return (
      (import.meta.env.DEV && import.meta.env.MODE !== 'test')
      || window.localStorage.getItem('sato.debug') === '1'
      || new URL(window.location.href).searchParams.get('debug') === '1'
    )
  } catch {
    return import.meta.env.DEV && import.meta.env.MODE !== 'test'
  }
}

function ensureDebugStore() {
  if (typeof window === 'undefined') {
    return null
  }

  if (!window.__SATO_DEBUG__) {
    window.__SATO_DEBUG__ = {
      enabled: debugEnabled(),
      events: [],
      clear() {
        this.events.length = 0
      },
      getEvents() {
        return [...this.events]
      },
    }
  } else {
    window.__SATO_DEBUG__.enabled = debugEnabled()
  }

  return window.__SATO_DEBUG__
}

export function logClientEvent(type, payload = {}) {
  const store = ensureDebugStore()
  if (!store) {
    return null
  }

  const entry = {
    timestamp: new Date().toISOString(),
    type,
    payload,
  }

  store.events.push(entry)
  if (store.events.length > MAX_DEBUG_EVENTS) {
    store.events.splice(0, store.events.length - MAX_DEBUG_EVENTS)
  }

  if (store.enabled) {
    console.debug(`[sato:${type}]`, payload)
  }

  return entry
}

export function getClientDebugEvents() {
  const store = ensureDebugStore()
  return store ? store.getEvents() : []
}
