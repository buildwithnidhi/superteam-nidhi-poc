import { unstable_cache } from 'next/cache'

const BASE = 'https://api.lu.ma/public/v1'

async function paginate<T>(path: string): Promise<T[]> {
  const all: T[] = []
  let cursor: string | null = null

  do {
    const url = new URL(`${BASE}${path}`)
    if (cursor) url.searchParams.set('pagination_cursor', cursor)

    const res = await fetch(url.toString(), {
      headers: { 'x-luma-api-key': process.env.LUMA_API_KEY! },
      cache: 'no-store', // unstable_cache handles the 24h TTL
    })

    if (!res.ok) throw new Error(`Luma API ${res.status}: ${await res.text()}`)

    const data = await res.json()
    all.push(...(data.entries ?? []))
    cursor = data.has_more ? data.next_cursor : null
  } while (cursor)

  return all
}

export type LumaEvent = {
  api_id: string
  event: {
    name: string
    start_at: string
    end_at: string
    cover_url: string | null
    geo_address_json?: {
      city?: string
      country?: string
      full_address?: string
    } | null
  }
}

export type LumaPerson = {
  api_id: string
  email: string
  event_approved_count: number
  event_checked_in_count: number
  tags: Array<{ name: string }>
  user: {
    name: string
    avatar_url: string | null
  } | null
}

export const getEvents = unstable_cache(
  () => paginate<LumaEvent>('/calendar/list-events'),
  ['luma-events'],
  { revalidate: 86400, tags: ['luma-events'] },
)

export const getPeople = unstable_cache(
  () => paginate<LumaPerson>('/calendar/list-people'),
  ['luma-people'],
  { revalidate: 86400, tags: ['luma-people'] },
)
