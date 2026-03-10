import { LumaEvent, LumaGuest, LumaHost, LumaPerson, CachedData } from "./types";
import { db } from "./db";
import {
  lumaEvents,
  lumaPeople,
  lumaGuests,
  lumaHosts,
  lumaEventHosts,
  lumaSyncLog,
} from "./schema";
import { eq, desc, sql, count } from "drizzle-orm";

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

// ─── DB helpers (Drizzle) ─────────────────────────────────────────────────────

async function getLastSyncTime(syncType: string): Promise<Date | null> {
  const rows = await db
    .select({ syncedAt: lumaSyncLog.syncedAt })
    .from(lumaSyncLog)
    .where(eq(lumaSyncLog.syncType, syncType))
    .orderBy(desc(lumaSyncLog.syncedAt))
    .limit(1);
  return rows.length ? rows[0].syncedAt : null;
}

async function upsertEvents(events: LumaEvent[]): Promise<void> {
  for (const ev of events) {
    await db
      .insert(lumaEvents)
      .values({
        eventApiId: ev.api_id,
        title: ev.name,
        startAt: ev.start_at ? new Date(ev.start_at) : null,
        endAt: ev.end_at ? new Date(ev.end_at) : null,
        geoCity: ev.geo_address_json?.city || null,
        geoCountry: ev.geo_address_json?.country || null,
        coverUrl: ev.cover_url,
        url: ev.url,
        geoAddressJson: ev.geo_address_json || null,
        creatorApiId: ev.creator_api_id,
        timezone: ev.timezone,
      })
      .onDuplicateKeyUpdate({
        set: {
          title: sql`VALUES(${lumaEvents.title})`,
          startAt: sql`VALUES(${lumaEvents.startAt})`,
          endAt: sql`VALUES(${lumaEvents.endAt})`,
          geoCity: sql`VALUES(${lumaEvents.geoCity})`,
          geoCountry: sql`VALUES(${lumaEvents.geoCountry})`,
          coverUrl: sql`VALUES(${lumaEvents.coverUrl})`,
          url: sql`VALUES(${lumaEvents.url})`,
          geoAddressJson: sql`VALUES(${lumaEvents.geoAddressJson})`,
          creatorApiId: sql`VALUES(${lumaEvents.creatorApiId})`,
          timezone: sql`VALUES(${lumaEvents.timezone})`,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      });
  }
}

async function getEventsFromDb(): Promise<LumaEvent[]> {
  const rows = await db
    .select({
      eventApiId: lumaEvents.eventApiId,
      title: lumaEvents.title,
      startAt: lumaEvents.startAt,
      endAt: lumaEvents.endAt,
      geoAddressJson: lumaEvents.geoAddressJson,
      coverUrl: lumaEvents.coverUrl,
      url: lumaEvents.url,
      creatorApiId: lumaEvents.creatorApiId,
      timezone: lumaEvents.timezone,
    })
    .from(lumaEvents)
    .orderBy(
      sql`CASE WHEN ${lumaEvents.startAt} >= NOW() THEN 0 ELSE 1 END`,
      sql`ABS(TIMESTAMPDIFF(SECOND, ${lumaEvents.startAt}, NOW()))`
    );

  return rows.map((r) => ({
    api_id: r.eventApiId,
    name: r.title,
    start_at: r.startAt ? r.startAt.toISOString() : "",
    end_at: r.endAt ? r.endAt.toISOString() : "",
    url: r.url,
    cover_url: r.coverUrl,
    geo_address_json: r.geoAddressJson as LumaEvent["geo_address_json"],
    geo_latitude: null,
    geo_longitude: null,
    timezone: r.timezone,
    creator_api_id: r.creatorApiId,
  }));
}

async function upsertPeople(people: LumaPerson[]): Promise<void> {
  for (const p of people) {
    await db
      .insert(lumaPeople)
      .values({
        personApiId: p.api_id,
        email: p.email,
        userName: p.user?.name || null,
        avatarUrl: p.user?.avatar_url || null,
        eventApprovedCount: p.event_approved_count,
        eventCheckedInCount: p.event_checked_in_count,
        tags: p.tags,
      })
      .onDuplicateKeyUpdate({
        set: {
          email: sql`VALUES(${lumaPeople.email})`,
          userName: sql`VALUES(${lumaPeople.userName})`,
          avatarUrl: sql`VALUES(${lumaPeople.avatarUrl})`,
          eventApprovedCount: sql`VALUES(${lumaPeople.eventApprovedCount})`,
          eventCheckedInCount: sql`VALUES(${lumaPeople.eventCheckedInCount})`,
          tags: sql`VALUES(${lumaPeople.tags})`,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      });
  }
}

async function getPeopleFromDb(): Promise<LumaPerson[]> {
  const rows = await db
    .select({
      personApiId: lumaPeople.personApiId,
      email: lumaPeople.email,
      userName: lumaPeople.userName,
      avatarUrl: lumaPeople.avatarUrl,
      eventApprovedCount: lumaPeople.eventApprovedCount,
      eventCheckedInCount: lumaPeople.eventCheckedInCount,
      tags: lumaPeople.tags,
      createdAt: lumaPeople.createdAt,
    })
    .from(lumaPeople);

  return rows.map((r) => ({
    api_id: r.personApiId,
    email: r.email || "",
    created_at: r.createdAt ? r.createdAt.toISOString() : "",
    event_approved_count: r.eventApprovedCount ?? 0,
    event_checked_in_count: r.eventCheckedInCount ?? 0,
    tags: r.tags ? (r.tags as Array<{ api_id: string; name: string }>) : [],
    user: {
      api_id: r.personApiId,
      email: r.email || "",
      name: r.userName || "",
      first_name: null,
      last_name: null,
      avatar_url: r.avatarUrl,
    },
  }));
}

async function upsertGuests(eventId: string, guests: LumaGuest[]): Promise<void> {
  for (const g of guests) {
    await db
      .insert(lumaGuests)
      .values({
        eventApiId: eventId,
        userApiId: g.user_api_id || g.api_id,
        name: g.user_name,
        email: g.user_email,
        approvalStatus: g.approval_status,
        registeredAt: g.registered_at ? new Date(g.registered_at) : null,
        checkedInAt: g.checked_in_at ? new Date(g.checked_in_at) : null,
      })
      .onDuplicateKeyUpdate({
        set: {
          name: sql`VALUES(${lumaGuests.name})`,
          email: sql`VALUES(${lumaGuests.email})`,
          approvalStatus: sql`VALUES(${lumaGuests.approvalStatus})`,
          registeredAt: sql`VALUES(${lumaGuests.registeredAt})`,
          checkedInAt: sql`VALUES(${lumaGuests.checkedInAt})`,
        },
      });
  }
}

async function getGuestsFromDb(eventId: string): Promise<LumaGuest[]> {
  const rows = await db
    .select({
      userApiId: lumaGuests.userApiId,
      name: lumaGuests.name,
      email: lumaGuests.email,
      approvalStatus: lumaGuests.approvalStatus,
      registeredAt: lumaGuests.registeredAt,
      checkedInAt: lumaGuests.checkedInAt,
    })
    .from(lumaGuests)
    .where(eq(lumaGuests.eventApiId, eventId));

  return rows.map((r) => ({
    api_id: r.userApiId,
    user_api_id: r.userApiId,
    user_name: r.name || "",
    user_email: r.email || "",
    approval_status: r.approvalStatus || "",
    registered_at: r.registeredAt ? r.registeredAt.toISOString() : null,
    checked_in_at: r.checkedInAt ? r.checkedInAt.toISOString() : null,
  }));
}

async function hasGuestsInDb(eventId: string): Promise<boolean> {
  const rows = await db
    .select({ cnt: count() })
    .from(lumaGuests)
    .where(eq(lumaGuests.eventApiId, eventId));
  return rows[0].cnt > 0;
}

async function upsertHosts(eventId: string, hosts: LumaHost[]): Promise<void> {
  for (const h of hosts) {
    await db
      .insert(lumaHosts)
      .values({
        hostApiId: h.api_id,
        name: h.name,
        email: h.email,
        avatarUrl: h.avatar_url,
      })
      .onDuplicateKeyUpdate({
        set: {
          name: sql`VALUES(${lumaHosts.name})`,
          email: sql`VALUES(${lumaHosts.email})`,
          avatarUrl: sql`VALUES(${lumaHosts.avatarUrl})`,
        },
      });

    await db
      .insert(lumaEventHosts)
      .values({
        eventApiId: eventId,
        hostApiId: h.api_id,
      })
      .onDuplicateKeyUpdate({
        set: { eventApiId: sql`VALUES(${lumaEventHosts.eventApiId})` },
      });
  }
}

async function getHostsFromDb(eventId: string): Promise<LumaHost[]> {
  const rows = await db
    .select({
      hostApiId: lumaHosts.hostApiId,
      name: lumaHosts.name,
      email: lumaHosts.email,
      avatarUrl: lumaHosts.avatarUrl,
    })
    .from(lumaHosts)
    .innerJoin(lumaEventHosts, eq(lumaHosts.hostApiId, lumaEventHosts.hostApiId))
    .where(eq(lumaEventHosts.eventApiId, eventId));

  return rows.map((r) => ({
    api_id: r.hostApiId,
    name: r.name || "",
    email: r.email || "",
    avatar_url: r.avatarUrl,
  }));
}

async function hasHostsInDb(eventId: string): Promise<boolean> {
  const rows = await db
    .select({ cnt: count() })
    .from(lumaEventHosts)
    .where(eq(lumaEventHosts.eventApiId, eventId));
  return rows[0].cnt > 0;
}

async function logSync(syncType: string, counts: { events?: number; people?: number }, status: string) {
  await db.insert(lumaSyncLog).values({
    syncType,
    eventsCount: counts.events ?? 0,
    peopleCount: counts.people ?? 0,
    status,
  });
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

  if (!forceRefresh && lastSync) {
    console.log("[luma] Serving events from Aiven DB (last synced:", lastSync.toISOString(), ")");
    const events = await getEventsFromDb();
    return { events, lastRefreshed: lastSync.toISOString() };
  }

  console.log("[luma] No sync record found — fetching from Luma API and seeding DB");
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
