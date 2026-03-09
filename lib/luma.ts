import { LumaEvent, LumaGuest, LumaPerson, CachedData } from "./types";
import fs from "fs";
import path from "path";

const API_BASE = "https://public-api.luma.com/v1";
const API_KEY = process.env.LUMA_API_KEY || "";
const CACHE_FILE = path.join(process.cwd(), ".cache", "luma-data.json");
const CACHE_TTL_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

// Luma rate limit: 300 req/min per calendar (5 req/sec).
// We stay well under by delaying between paginated pages and guest batches.
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function headers() {
  return { "x-luma-api-key": API_KEY };
}

async function fetchAllPages<T>(
  url: string,
  extractEntries: (data: Record<string, unknown>) => T[]
): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | null = null;

  do {
    const params = new URLSearchParams();
    params.set("pagination_limit", "100");
    if (cursor) {
      params.set("pagination_cursor", cursor);
      await sleep(300); // 300ms between pages ~= max 3 req/sec per paginated call
    }
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}${params}`, { headers: headers() });
    if (!res.ok) throw new Error(`Luma API error: ${res.status}`);
    const data = await res.json();
    all.push(...extractEntries(data));
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);

  return all;
}

export async function fetchEvents(): Promise<LumaEvent[]> {
  const entries = await fetchAllPages(
    `${API_BASE}/calendar/list-events?sort_column=start_at&sort_direction=desc`,
    (data) =>
      ((data.entries as Array<{ event: Record<string, unknown> }>) || []).map(
        (e) => {
          const ev = e.event;
          return {
            api_id: ev.api_id as string,
            name: ev.name as string,
            start_at: ev.start_at as string,
            end_at: ev.end_at as string,
            url: ev.url as string | null,
            cover_url: ev.cover_url as string | null,
            geo_address_json: ev.geo_address_json as LumaEvent["geo_address_json"],
            geo_latitude: ev.geo_latitude as string | null,
            geo_longitude: ev.geo_longitude as string | null,
            timezone: ev.timezone as string | null,
          };
        }
      )
  );
  return entries;
}

export async function fetchPeople(): Promise<LumaPerson[]> {
  return fetchAllPages(
    `${API_BASE}/calendar/list-people?sort_column=created_at&sort_direction=desc`,
    (data) =>
      ((data.entries as Array<Record<string, unknown>>) || []).map((e) => ({
        api_id: e.api_id as string,
        email: e.email as string,
        created_at: e.created_at as string,
        event_approved_count: e.event_approved_count as number,
        event_checked_in_count: e.event_checked_in_count as number,
        tags: (e.tags as Array<{ api_id: string; name: string }>) || [],
        user: e.user as LumaPerson["user"],
      }))
  );
}

export async function fetchEventGuests(
  eventId: string
): Promise<LumaGuest[]> {
  return fetchAllPages(
    `${API_BASE}/event/get-guests?event_id=${eventId}`,
    (data) =>
      (
        (data.entries as Array<{ guest: Record<string, unknown> }>) || []
      ).map((e) => {
        const g = e.guest;
        return {
          api_id: g.api_id as string,
          user_name: (g.user_name || g.name || "") as string,
          user_email: (g.user_email || g.email || "") as string,
          approval_status: g.approval_status as string,
          registered_at: g.registered_at as string | null,
          checked_in_at: g.checked_in_at as string | null,
        };
      })
  );
}

function readCache(): CachedData | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const raw = fs.readFileSync(CACHE_FILE, "utf-8");
    const data: CachedData = JSON.parse(raw);
    const age = Date.now() - new Date(data.lastRefreshed).getTime();
    if (age > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(data: CachedData) {
  const dir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data));
}

export async function getData(forceRefresh = false): Promise<CachedData> {
  if (!forceRefresh) {
    const cached = readCache();
    if (cached) return cached;
  }

  const [events, people] = await Promise.all([fetchEvents(), fetchPeople()]);

  // Fetch guests for all events in small batches with delays to stay under
  // Luma's 300 req/min limit. Each batch of 5 concurrent requests, 2s between
  // batches = max ~150 req/min for this section alone.
  const eventGuests: Record<string, LumaGuest[]> = {};
  const batchSize = 5;
  for (let i = 0; i < events.length; i += batchSize) {
    if (i > 0) await sleep(2000);
    const batch = events.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map((e) => fetchEventGuests(e.api_id))
    );
    batch.forEach((e, idx) => {
      eventGuests[e.api_id] = results[idx];
    });
  }

  const data: CachedData = {
    events,
    people,
    eventGuests,
    lastRefreshed: new Date().toISOString(),
  };
  writeCache(data);
  return data;
}
