const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function fetchAPI(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const error = await res.text()
    throw new Error(error || `API error: ${res.status}`)
  }
  return res.json()
}

export async function approveTicket(ticketId: string) {
  return fetchAPI(`/tickets/${ticketId}/approve`, { method: 'POST' })
}

export async function rejectTicket(ticketId: string, reason?: string) {
  return fetchAPI(`/tickets/${ticketId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export async function updateTicket(ticketId: string, updates: Partial<any>) {
  return fetchAPI(`/tickets/${ticketId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
}