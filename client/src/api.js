import { useSessionStore } from './store.js'

export async function request(path, options = {}) {
  const token = useSessionStore.getState().token
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (response.status === 204) return null
  const payload = await response.json()
  if (response.status === 401) {
    useSessionStore.getState().clearSession()
  }
  if (!response.ok) {
    const details = payload.details
      ?.map(({ field, message }) => `${field}: ${message}`)
      .join('\n')
    throw new Error([payload.error, details].filter(Boolean).join('\n') || `La solicitud falló (${response.status}).`)
  }
  return payload
}

export function jsonBody(data) {
  return JSON.stringify(data)
}
