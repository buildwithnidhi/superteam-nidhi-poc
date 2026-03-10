import { LumaEvent, LumaGuest, LumaHost, LumaPerson, CachedData } from "./types";
import fs from "fs";
import path from "path";

const API_BASE = "https://public-api.luma.com/v1";
const API_KEY = process.env.LUMA_API_KEY || "";
const CACHE_FILE = path.join(process.cwd(), ".cache", "luma-data.json");
const CACHE_TTL_MS = 2 * 24 * 60 * 60 * 1000; // 2 days
const PEOPLE_TTL_MS = 2 * 24 * 60 * 60 * 1000; // 2 days — separate TTL for people

function headers() {
  return { "x-luma-api-key": API_KEY };
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 5
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, options);
    if (res.status === 429) {
      // Wait 5s, 10s, 20s, 40s, 80s — Luma rate limits need longer backoff
      const wait = 5000 * Math.pow(2, i);
      console.log(`Rate limited, waiting ${wait / 1000}s before retry ${i + 1}/${retries}...`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    return res;
  }
  return fetch(url, options);
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
    if (cursor) params.set("pagination_cursor", cursor);
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetchWithRetry(`${url}${sep}${params}`, { headers: headers() });
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
      (
        (data.entries as Array<{ event: Record<string, unknown> }>) || []
      ).map((e) => {
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
          creator_api_id: (ev.user_api_id || null) as string | null,
        };
      })
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
  try {
    return await fetchAllPages(
      `${API_BASE}/event/get-guests?event_id=${eventId}`,
      (data) =>
        (
          (data.entries as Array<{ guest: Record<string, unknown> }>) || []
        ).map((e) => {
          const g = e.guest;
          return {
            api_id: g.api_id as string,
            user_api_id: (g.user_api_id || null) as string | null,
            user_name: (g.user_name || g.name || "") as string,
            user_email: (g.user_email || g.email || "") as string,
            approval_status: g.approval_status as string,
            registered_at: g.registered_at as string | null,
            checked_in_at: g.checked_in_at as string | null,
          };
        })
    );
  } catch (err) {
    console.warn(`Failed to fetch guests for event ${eventId}:`, err);
    return [];
  }
}

export async function fetchEventHosts(
  eventId: string
): Promise<LumaHost[]> {
  try {
    // /event/get returns hosts alongside the event — single API call
    const res = await fetchWithRetry(
      `${API_BASE}/event/get?api_id=${eventId}`,
      { headers: headers() }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const hosts = (data.hosts as Array<Record<string, unknown>>) || [];
    return hosts.map((h) => ({
      api_id: (h.api_id || "") as string,
      name: (h.name || "") as string,
      email: (h.email || "") as string,
      avatar_url: (h.avatar_url || null) as string | null,
    }));
  } catch (err) {
    console.warn(`Failed to fetch hosts for event ${eventId}:`, err);
    return [];
  }
}

function readCache(): CachedData | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const raw = fs.readFileSync(CACHE_FILE, "utf-8");
    const data: CachedData = JSON.parse(raw);
    const age = Date.now() - new Date(data.lastRefreshed).getTime();
    if (age > CACHE_TTL_MS) return null;
    // Ensure eventHosts exists (old cache may not have it)
    if (!data.eventHosts) data.eventHosts = {};
    return data;
  } catch {
    return null;
  }
}

export function getPeopleFromCache(): LumaPerson[] {
  const cached = readCache();
  return cached?.people || [];
}

function writeCache(data: CachedData) {
  const dir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data));
}

export async function getEvents(forceRefresh = false): Promise<{
  events: LumaEvent[];
  lastRefreshed: string;
}> {
  if (!forceRefresh) {
    const cached = readCache();
    if (cached) return { events: cached.events, lastRefreshed: cached.lastRefreshed };
  }

  const events = await fetchEvents();

  // Update cache with new events, preserve existing people/guests data
  const existing = readCache();
  const data: CachedData = {
    events,
    people: existing?.people || [],
    eventGuests: existing?.eventGuests || {},
    eventHosts: existing?.eventHosts || {},
    lastRefreshed: new Date().toISOString(),
  };
  writeCache(data);
  return { events: data.events, lastRefreshed: data.lastRefreshed };
}

export async function getData(forceRefresh = false): Promise<CachedData> {
  if (!forceRefresh) {
    const cached = readCache();
    if (cached) {
      // Check if people TTL is still valid — avoids hammering the API when rate-limited
      const peopleAge = cached.peopleLastFetched
        ? Date.now() - new Date(cached.peopleLastFetched).getTime()
        : Infinity;
      if (peopleAge < PEOPLE_TTL_MS && cached.people.length > 0) return cached;
    }
  }

  const [events, people] = await Promise.all([fetchEvents(), fetchPeople()]);

  const existing = readCache();
  const data: CachedData = {
    events,
    people,
    eventGuests: existing?.eventGuests || {},
    eventHosts: existing?.eventHosts || {},
    lastRefreshed: new Date().toISOString(),
    peopleLastFetched: new Date().toISOString(),
  };
  writeCache(data);
  return data;
}

export async function getGuestsForEvents(
  eventIds: string[]
): Promise<Record<string, LumaGuest[]>> {
  // Try to use cached guest data first
  const cached = readCache();
  const result: Record<string, LumaGuest[]> = {};
  const toFetch: string[] = [];

  for (const id of eventIds) {
    if (cached?.eventGuests[id]) {
      result[id] = cached.eventGuests[id];
    } else {
      toFetch.push(id);
    }
  }

  // Fetch missing guests in small batches with delays
  const batchSize = 5;
  for (let i = 0; i < toFetch.length; i += batchSize) {
    const batch = toFetch.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map((id) => fetchEventGuests(id))
    );
    batch.forEach((id, idx) => {
      result[id] = results[idx];
    });
    if (i + batchSize < toFetch.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // Update cache with new guest data
  if (cached && toFetch.length > 0) {
    cached.eventGuests = { ...cached.eventGuests, ...result };
    writeCache(cached);
  }

  return result;
}

export async function getHostsForEvents(
  eventIds: string[]
): Promise<Record<string, LumaHost[]>> {
  const cached = readCache();
  const result: Record<string, LumaHost[]> = {};
  const toFetch: string[] = [];

  for (const id of eventIds) {
    if (cached?.eventHosts[id]) {
      result[id] = cached.eventHosts[id];
    } else {
      toFetch.push(id);
    }
  }

  const batchSize = 5;
  for (let i = 0; i < toFetch.length; i += batchSize) {
    const batch = toFetch.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map((id) => fetchEventHosts(id))
    );
    batch.forEach((id, idx) => {
      result[id] = results[idx];
    });
    if (i + batchSize < toFetch.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  if (cached && toFetch.length > 0) {
    cached.eventHosts = { ...cached.eventHosts, ...result };
    writeCache(cached);
  }

  return result;
}
