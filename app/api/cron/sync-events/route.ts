import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { lumaEvents, lumaSyncLog } from "@/lib/schema";
import { desc, eq, sql } from "drizzle-orm";

const API_BASE = "https://public-api.luma.com/v1";
const API_KEY = process.env.LUMA_API_KEY || "";

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, { headers: { "x-luma-api-key": API_KEY } });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 5000 * Math.pow(2, i)));
      continue;
    }
    return res;
  }
  return fetch(url, { headers: { "x-luma-api-key": API_KEY } });
}

export async function GET(request: Request) {
  // Verify this is called by Vercel cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get the last sync time
  const syncRows = await db
    .select({ syncedAt: lumaSyncLog.syncedAt })
    .from(lumaSyncLog)
    .where(eq(lumaSyncLog.syncType, "events"))
    .orderBy(desc(lumaSyncLog.syncedAt))
    .limit(1);

  const lastSync = syncRows.length ? syncRows[0].syncedAt! : new Date("2026-01-01");

  // Fetch only recent events (sorted by start_at desc, stop when older than lastSync)
  const newEvents: Record<string, unknown>[] = [];
  let cursor: string | null = null;
  let done = false;

  do {
    const params = new URLSearchParams({
      pagination_limit: "100",
      sort_column: "created_at",
      sort_direction: "desc",
    });
    if (cursor) params.set("pagination_cursor", cursor);

    const res = await fetchWithRetry(`${API_BASE}/calendar/list-events?${params}`);
    if (!res.ok) break;

    const data = await res.json();
    const entries = (data.entries as Array<{ event: Record<string, unknown> }>) || [];

    for (const e of entries) {
      const ev = e.event;
      // Stop once we hit events older than last sync
      if (new Date(ev.created_at as string) <= lastSync) { done = true; break; }
      newEvents.push(ev);
    }

    cursor = (!done && data.has_more) ? data.next_cursor : null;
  } while (cursor && !done);

  // Upsert new events into DB
  for (const ev of newEvents) {
    await db
      .insert(lumaEvents)
      .values({
        eventApiId: ev.api_id as string,
        title: ev.name as string,
        startAt: ev.start_at ? new Date(ev.start_at as string) : null,
        endAt: ev.end_at ? new Date(ev.end_at as string) : null,
        geoCity: (ev.geo_address_json as Record<string, string> | null)?.city || null,
        geoCountry: (ev.geo_address_json as Record<string, string> | null)?.country || null,
        coverUrl: (ev.cover_url as string) || null,
        url: (ev.url as string) || null,
        geoAddressJson: ev.geo_address_json || null,
        creatorApiId: (ev.user_api_id as string) || null,
        timezone: (ev.timezone as string) || null,
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
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      });
  }

  await db.insert(lumaSyncLog).values({
    syncType: "events",
    eventsCount: newEvents.length,
    peopleCount: 0,
    status: "success",
  });

  return NextResponse.json({ success: true, newEvents: newEvents.length, since: lastSync });
}
