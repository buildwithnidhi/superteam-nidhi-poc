import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

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

  const pool = getPool();

  // Get the last sync time
  const [rows] = await pool.execute(
    `SELECT synced_at FROM luma_sync_log WHERE sync_type = 'events' AND status = 'success' ORDER BY synced_at DESC LIMIT 1`
  ) as [Array<{ synced_at: Date }>, unknown];

  const lastSync = rows.length ? rows[0].synced_at : new Date("2026-01-01");

  // Fetch only recent events (sorted by start_at desc, stop when older than lastSync)
  const newEvents = [];
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
    await pool.execute(
      `INSERT INTO luma_events (event_api_id, title, start_at, end_at, geo_city, geo_country, cover_url, url, geo_address_json, creator_api_id, timezone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title=VALUES(title), start_at=VALUES(start_at), end_at=VALUES(end_at),
         geo_city=VALUES(geo_city), geo_country=VALUES(geo_country), cover_url=VALUES(cover_url),
         url=VALUES(url), geo_address_json=VALUES(geo_address_json), updated_at=CURRENT_TIMESTAMP`,
      [
        ev.api_id, ev.name,
        ev.start_at ? new Date(ev.start_at as string) : null,
        ev.end_at ? new Date(ev.end_at as string) : null,
        (ev.geo_address_json as Record<string, string> | null)?.city || null,
        (ev.geo_address_json as Record<string, string> | null)?.country || null,
        ev.cover_url || null, ev.url || null,
        ev.geo_address_json ? JSON.stringify(ev.geo_address_json) : null,
        ev.user_api_id || null, ev.timezone || null,
      ]
    );
  }

  await pool.execute(
    `INSERT INTO luma_sync_log (sync_type, events_count, people_count, status) VALUES ('events', ?, 0, 'success')`,
    [newEvents.length]
  );

  return NextResponse.json({ success: true, newEvents: newEvents.length, since: lastSync });
}
