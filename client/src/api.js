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
  if (!response.ok) throw new Error(payload.error || 'No se pudo completar la solicitud.')
  return payload
}
