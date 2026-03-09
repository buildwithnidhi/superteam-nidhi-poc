import { cacheLife, cacheTag } from "next/cache";
import { LumaEvent, LumaGuest } from "./types";

const API_BASE = "https://api.lu.ma/public/v1";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function headers() {
  return { "x-luma-api-key": process.env.LUMA_API_KEY! };
}

// Fetches all calendar events and caches the result for 24 hours.
// Called by multiple users — they all share this single cached response.
export async function fetchEvents(): Promise<LumaEvent[]> {
  "use cache";
  cacheLife("days");
  cacheTag("luma-events");

  const all: LumaEvent[] = [];
  let cursor: string | null = null;

  do {
    const url = new URL(`${API_BASE}/calendar/list-events`);
    url.searchParams.set("pagination_limit", "100");
    url.searchParams.set("sort_column", "start_at");
    url.searchParams.set("sort_direction", "desc");
    if (cursor) url.searchParams.set("pagination_cursor", cursor);

    const res = await fetch(url.toString(), {
      headers: headers(),
      cache: "no-store", // 'use cache' above handles the TTL
    });
    if (!res.ok) throw new Error(`Luma API ${res.status}`);

    const data = await res.json();
    for (const entry of data.entries ?? []) {
      const ev = entry.event;
      all.push({
        api_id: ev.api_id,
        name: ev.name,
        start_at: ev.start_at,
        end_at: ev.end_at,
        url: ev.url ?? null,
        cover_url: ev.cover_url ?? null,
        geo_address_json: ev.geo_address_json ?? null,
        geo_latitude: ev.geo_latitude ?? null,
        geo_longitude: ev.geo_longitude ?? null,
        timezone: ev.timezone ?? null,
      });
    }

    cursor = data.has_more ? data.next_cursor : null;
    if (cursor) await sleep(300); // 300ms between pages stays well under 300 req/min
  } while (cursor);

  return all;
}

// Fetches guests for a single event — called on-demand when user selects events.
// Not cached: this is an intentional user action, not a background prefetch.
export async function fetchGuestsForEvent(eventId: string): Promise<LumaGuest[]> {
  const all: LumaGuest[] = [];
  let cursor: string | null = null;

  do {
    const url = new URL(`${API_BASE}/event/get-guests`);
    url.searchParams.set("event_id", eventId);
    url.searchParams.set("pagination_limit", "100");
    if (cursor) url.searchParams.set("pagination_cursor", cursor);

    const res = await fetch(url.toString(), {
      headers: headers(),
      cache: "no-store",
    });
    if (!res.ok) break; // silently skip on error

    const data = await res.json();
    for (const entry of data.entries ?? []) {
      const g = entry.guest ?? entry;
      all.push({
        api_id: g.api_id,
        user_name: g.user_name ?? g.name ?? "",
        user_email: g.user_email ?? g.email ?? "",
        approval_status: g.approval_status ?? "",
        registered_at: g.registered_at ?? null,
        checked_in_at: g.checked_in_at ?? null,
      });
    }

    cursor = data.has_more ? data.next_cursor : null;
    if (cursor) await sleep(300);
  } while (cursor);

  return all;
}
