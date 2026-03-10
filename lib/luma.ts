import { LumaEvent, LumaGuest, LumaHost, LumaPerson, CachedData } from "./types";
import { getPool } from "./db";

const API_BASE = "https://public-api.luma.com/v1";
const API_KEY = process.env.LUMA_API_KEY || "";
const CACHE_TTL_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

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

export async function fetchEventGuests(eventId: string): Promise<LumaGuest[]> {
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

export async function fetchEventHosts(eventId: string): Promise<LumaHost[]> {
  try {
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

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function getLastSyncTime(syncType: string): Promise<Date | null> {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT synced_at FROM luma_sync_log WHERE sync_type = ? AND status = 'success' ORDER BY synced_at DESC LIMIT 1`,
    [syncType]
  ) as [Array<{ synced_at: Date }>, unknown];
  return rows.length ? rows[0].synced_at : null;
}

async function upsertEvents(events: LumaEvent[]): Promise<void> {
  const pool = getPool();
  for (const ev of events) {
    await pool.execute(
      `INSERT INTO luma_events (event_api_id, title, start_at, end_at, geo_city, geo_country, cover_url, url, geo_address_json, creator_api_id, timezone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title=VALUES(title), start_at=VALUES(start_at), end_at=VALUES(end_at),
         geo_city=VALUES(geo_city), geo_country=VALUES(geo_country), cover_url=VALUES(cover_url),
         url=VALUES(url), geo_address_json=VALUES(geo_address_json), creator_api_id=VALUES(creator_api_id),
         timezone=VALUES(timezone), updated_at=CURRENT_TIMESTAMP`,
      [
        ev.api_id,
        ev.name,
        ev.start_at ? new Date(ev.start_at) : null,
        ev.end_at ? new Date(ev.end_at) : null,
        ev.geo_address_json?.city || null,
        ev.geo_address_json?.country || null,
        ev.cover_url,
        ev.url,
        ev.geo_address_json ? JSON.stringify(ev.geo_address_json) : null,
        ev.creator_api_id,
        ev.timezone,
      ]
    );
  }
}

async function getEventsFromDb(): Promise<LumaEvent[]> {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT event_api_id, title, start_at, end_at, geo_address_json, cover_url, url, creator_api_id, timezone FROM luma_events
     ORDER BY CASE WHEN start_at >= NOW() THEN 0 ELSE 1 END, ABS(TIMESTAMPDIFF(SECOND, start_at, NOW()))`
  ) as [Array<Record<string, unknown>>, unknown];

  return rows.map((r) => ({
    api_id: r.event_api_id as string,
    name: r.title as string,
    start_at: (r.start_at as Date).toISOString(),
    end_at: r.end_at ? (r.end_at as Date).toISOString() : "",
    url: r.url as string | null,
    cover_url: r.cover_url as string | null,
    geo_address_json: r.geo_address_json
      ? (typeof r.geo_address_json === "string" ? JSON.parse(r.geo_address_json) : r.geo_address_json)
      : null,
    geo_latitude: null,
    geo_longitude: null,
    timezone: r.timezone as string | null,
    creator_api_id: r.creator_api_id as string | null,
  }));
}

async function upsertPeople(people: LumaPerson[]): Promise<void> {
  const pool = getPool();
  for (const p of people) {
    await pool.execute(
      `INSERT INTO luma_people (person_api_id, email, user_name, avatar_url, event_approved_count, event_checked_in_count, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE email=VALUES(email), user_name=VALUES(user_name), avatar_url=VALUES(avatar_url),
         event_approved_count=VALUES(event_approved_count), event_checked_in_count=VALUES(event_checked_in_count),
         tags=VALUES(tags), updated_at=CURRENT_TIMESTAMP`,
      [
        p.api_id,
        p.email,
        p.user?.name || null,
        p.user?.avatar_url || null,
        p.event_approved_count,
        p.event_checked_in_count,
        JSON.stringify(p.tags),
      ]
    );
  }
}

async function getPeopleFromDb(): Promise<LumaPerson[]> {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT person_api_id, email, user_name, avatar_url, event_approved_count, event_checked_in_count, tags, created_at FROM luma_people`
  ) as [Array<Record<string, unknown>>, unknown];

  return rows.map((r) => ({
    api_id: r.person_api_id as string,
    email: r.email as string,
    created_at: (r.created_at as Date).toISOString(),
    event_approved_count: r.event_approved_count as number,
    event_checked_in_count: r.event_checked_in_count as number,
    tags: r.tags ? JSON.parse(r.tags as string) : [],
    user: {
      api_id: r.person_api_id as string,
      email: r.email as string,
      name: r.user_name as string || "",
      first_name: null,
      last_name: null,
      avatar_url: r.avatar_url as string | null,
    },
  }));
}

async function upsertGuests(eventId: string, guests: LumaGuest[]): Promise<void> {
  const pool = getPool();
  for (const g of guests) {
    await pool.execute(
      `INSERT INTO luma_guests (event_api_id, user_api_id, name, email, approval_status, registered_at, checked_in_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), email=VALUES(email),
         approval_status=VALUES(approval_status), registered_at=VALUES(registered_at), checked_in_at=VALUES(checked_in_at)`,
      [
        eventId,
        g.user_api_id || g.api_id,
        g.user_name,
        g.user_email,
        g.approval_status,
        g.registered_at ? new Date(g.registered_at) : null,
        g.checked_in_at ? new Date(g.checked_in_at) : null,
      ]
    );
  }
}

async function getGuestsFromDb(eventId: string): Promise<LumaGuest[]> {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT user_api_id, name, email, approval_status, registered_at, checked_in_at FROM luma_guests WHERE event_api_id = ?`,
    [eventId]
  ) as [Array<Record<string, unknown>>, unknown];

  return rows.map((r) => ({
    api_id: r.user_api_id as string,
    user_api_id: r.user_api_id as string | null,
    user_name: r.name as string,
    user_email: r.email as string,
    approval_status: r.approval_status as string,
    registered_at: r.registered_at ? (r.registered_at as Date).toISOString() : null,
    checked_in_at: r.checked_in_at ? (r.checked_in_at as Date).toISOString() : null,
  }));
}

async function hasGuestsInDb(eventId: string): Promise<boolean> {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT COUNT(*) as cnt FROM luma_guests WHERE event_api_id = ?`,
    [eventId]
  ) as [Array<{ cnt: number }>, unknown];
  return rows[0].cnt > 0;
}

async function upsertHosts(eventId: string, hosts: LumaHost[]): Promise<void> {
  const pool = getPool();
  for (const h of hosts) {
    await pool.execute(
      `INSERT INTO luma_hosts (host_api_id, name, email, avatar_url) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), email=VALUES(email), avatar_url=VALUES(avatar_url)`,
      [h.api_id, h.name, h.email, h.avatar_url]
    );
    await pool.execute(
      `INSERT IGNORE INTO luma_event_hosts (event_api_id, host_api_id) VALUES (?, ?)`,
      [eventId, h.api_id]
    );
  }
}

async function getHostsFromDb(eventId: string): Promise<LumaHost[]> {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT h.host_api_id, h.name, h.email, h.avatar_url
     FROM luma_hosts h
     JOIN luma_event_hosts eh ON h.host_api_id = eh.host_api_id
     WHERE eh.event_api_id = ?`,
    [eventId]
  ) as [Array<Record<string, unknown>>, unknown];

  return rows.map((r) => ({
    api_id: r.host_api_id as string,
    name: r.name as string,
    email: r.email as string,
    avatar_url: r.avatar_url as string | null,
  }));
}

async function hasHostsInDb(eventId: string): Promise<boolean> {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT COUNT(*) as cnt FROM luma_event_hosts WHERE event_api_id = ?`,
    [eventId]
  ) as [Array<{ cnt: number }>, unknown];
  return rows[0].cnt > 0;
}

async function logSync(syncType: string, counts: { events?: number; people?: number }, status: string) {
  const pool = getPool();
  await pool.execute(
    `INSERT INTO luma_sync_log (sync_type, events_count, people_count, status) VALUES (?, ?, ?, ?)`,
    [syncType, counts.events ?? 0, counts.people ?? 0, status]
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getPeopleFromCache(): LumaPerson[] {
  // kept for backward compat — callers should prefer async getPeopleFromDb
  return [];
}

export async function getEvents(forceRefresh = false): Promise<{
  events: LumaEvent[];
  lastRefreshed: string;
}> {
  const lastSync = await getLastSyncTime("events");
  const stale = !lastSync || Date.now() - lastSync.getTime() > CACHE_TTL_MS;

  if (!forceRefresh && !stale) {
    const events = await getEventsFromDb();
    return { events, lastRefreshed: lastSync!.toISOString() };
  }

  const events = await fetchEvents();
  await upsertEvents(events);
  await logSync("events", { events: events.length }, "success");
  return { events, lastRefreshed: new Date().toISOString() };
}

export async function getData(forceRefresh = false): Promise<CachedData> {
  const lastEventsSync = await getLastSyncTime("events");
  const lastPeopleSync = await getLastSyncTime("people");
  const eventsStale = !lastEventsSync || Date.now() - lastEventsSync.getTime() > CACHE_TTL_MS;
  const peopleStale = !lastPeopleSync || Date.now() - lastPeopleSync.getTime() > CACHE_TTL_MS;

  let events: LumaEvent[];
  let people: LumaPerson[];

  if (!forceRefresh && !eventsStale && !peopleStale) {
    [events, people] = await Promise.all([getEventsFromDb(), getPeopleFromDb()]);
    return {
      events,
      people,
      eventGuests: {},
      eventHosts: {},
      lastRefreshed: lastEventsSync!.toISOString(),
      peopleLastFetched: lastPeopleSync!.toISOString(),
    };
  }

  [events, people] = await Promise.all([fetchEvents(), fetchPeople()]);
  await Promise.all([upsertEvents(events), upsertPeople(people)]);
  await Promise.all([
    logSync("events", { events: events.length }, "success"),
    logSync("people", { people: people.length }, "success"),
  ]);

  return {
    events,
    people,
    eventGuests: {},
    eventHosts: {},
    lastRefreshed: new Date().toISOString(),
    peopleLastFetched: new Date().toISOString(),
  };
}

export async function getGuestsForEvents(
  eventIds: string[]
): Promise<Record<string, LumaGuest[]>> {
  const result: Record<string, LumaGuest[]> = {};
  const toFetch: string[] = [];

  for (const id of eventIds) {
    if (await hasGuestsInDb(id)) {
      result[id] = await getGuestsFromDb(id);
    } else {
      toFetch.push(id);
    }
  }

  const batchSize = 5;
  for (let i = 0; i < toFetch.length; i += batchSize) {
    const batch = toFetch.slice(i, i + batchSize);
    const results = await Promise.all(batch.map((id) => fetchEventGuests(id)));
    await Promise.all(
      batch.map((id, idx) => upsertGuests(id, results[idx]))
    );
    batch.forEach((id, idx) => {
      result[id] = results[idx];
    });
    if (i + batchSize < toFetch.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return result;
}

export async function getHostsForEvents(
  eventIds: string[]
): Promise<Record<string, LumaHost[]>> {
  const result: Record<string, LumaHost[]> = {};
  const toFetch: string[] = [];

  for (const id of eventIds) {
    if (await hasHostsInDb(id)) {
      result[id] = await getHostsFromDb(id);
    } else {
      toFetch.push(id);
    }
  }

  const batchSize = 5;
  for (let i = 0; i < toFetch.length; i += batchSize) {
    const batch = toFetch.slice(i, i + batchSize);
    const results = await Promise.all(batch.map((id) => fetchEventHosts(id)));
    await Promise.all(
      batch.map((id, idx) => upsertHosts(id, results[idx]))
    );
    batch.forEach((id, idx) => {
      result[id] = results[idx];
    });
    if (i + batchSize < toFetch.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return result;
}
