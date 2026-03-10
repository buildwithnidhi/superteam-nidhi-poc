import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env.local') });

const LUMA_API_KEY = process.env.LUMA_API_KEY;
const API_BASE = 'https://public-api.luma.com/v1';
const CUTOFF = new Date('2026-01-01T00:00:00Z');

const pool = await mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT),
  ssl: { rejectUnauthorized: false },
  connectionLimit: 3,
});

async function fetchWithRetry(url, retries = 5) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, { headers: { 'x-luma-api-key': LUMA_API_KEY } });
    if (res.status === 429) {
      const wait = 10000 * Math.pow(2, i);
      console.log(`  Rate limited. Waiting ${wait / 1000}s...`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    return res;
  }
  throw new Error(`Failed after ${retries} retries: ${url}`);
}

// ── Fetch Events (Jan 2026 onwards) ──────────────────────────────────────────
console.log('\n[1/2] Fetching events from Jan 2026...');
const events = [];
let cursor = null;
let page = 1;
let done = false;

do {
  const params = new URLSearchParams({ pagination_limit: '100', sort_column: 'start_at', sort_direction: 'desc' });
  if (cursor) params.set('pagination_cursor', cursor);
  const res = await fetchWithRetry(`${API_BASE}/calendar/list-events?${params}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  const entries = (data.entries || []).map(e => e.event);

  for (const ev of entries) {
    if (new Date(ev.start_at) < CUTOFF) { done = true; break; }
    events.push(ev);
  }

  console.log(`  Page ${page++}: got ${entries.length} (kept: ${events.length})`);
  cursor = (!done && data.has_more) ? data.next_cursor : null;
  if (cursor) await new Promise(r => setTimeout(r, 2000));
} while (cursor && !done);

console.log(`Fetched ${events.length} events. Upserting...`);
for (const ev of events) {
  await pool.execute(
    `INSERT INTO luma_events (event_api_id, title, start_at, end_at, geo_city, geo_country, cover_url, url, geo_address_json, creator_api_id, timezone)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE title=VALUES(title), start_at=VALUES(start_at), end_at=VALUES(end_at),
       geo_city=VALUES(geo_city), geo_country=VALUES(geo_country), cover_url=VALUES(cover_url),
       url=VALUES(url), geo_address_json=VALUES(geo_address_json), creator_api_id=VALUES(creator_api_id),
       timezone=VALUES(timezone), updated_at=CURRENT_TIMESTAMP`,
    [
      ev.api_id, ev.name,
      ev.start_at ? new Date(ev.start_at) : null,
      ev.end_at ? new Date(ev.end_at) : null,
      ev.geo_address_json?.city || null,
      ev.geo_address_json?.country || null,
      ev.cover_url || null, ev.url || null,
      ev.geo_address_json ? JSON.stringify(ev.geo_address_json) : null,
      ev.user_api_id || null, ev.timezone || null,
    ]
  );
}
await pool.execute(
  `INSERT INTO luma_sync_log (sync_type, events_count, people_count, status) VALUES ('events', ?, 0, 'success')`,
  [events.length]
);
console.log(`✓ ${events.length} events saved.`);

console.log('\nWaiting 5s...');
await new Promise(r => setTimeout(r, 5000));

// ── Fetch People (created Jan 2026 onwards) ───────────────────────────────────
console.log('\n[2/2] Fetching people from Jan 2026...');
const people = [];
cursor = null;
page = 1;
done = false;

do {
  const params = new URLSearchParams({ pagination_limit: '100', sort_column: 'created_at', sort_direction: 'desc' });
  if (cursor) params.set('pagination_cursor', cursor);
  const res = await fetchWithRetry(`${API_BASE}/calendar/list-people?${params}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  const entries = data.entries || [];

  for (const p of entries) {
    if (new Date(p.created_at) < CUTOFF) { done = true; break; }
    people.push(p);
  }

  console.log(`  Page ${page++}: got ${entries.length} (kept: ${people.length})`);
  cursor = (!done && data.has_more) ? data.next_cursor : null;
  if (cursor) await new Promise(r => setTimeout(r, 2000));
} while (cursor && !done);

console.log(`Fetched ${people.length} people. Upserting...`);
for (const p of people) {
  await pool.execute(
    `INSERT INTO luma_people (person_api_id, email, user_name, avatar_url, event_approved_count, event_checked_in_count, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE email=VALUES(email), user_name=VALUES(user_name), avatar_url=VALUES(avatar_url),
       event_approved_count=VALUES(event_approved_count), event_checked_in_count=VALUES(event_checked_in_count),
       tags=VALUES(tags), updated_at=CURRENT_TIMESTAMP`,
    [
      p.api_id, p.email,
      p.user?.name || null,
      p.user?.avatar_url || null,
      p.event_approved_count || 0,
      p.event_checked_in_count || 0,
      JSON.stringify(p.tags || []),
    ]
  );
}
await pool.execute(
  `INSERT INTO luma_sync_log (sync_type, events_count, people_count, status) VALUES ('people', 0, ?, 'success')`,
  [people.length]
);
console.log(`✓ ${people.length} people saved.`);

await pool.end();
console.log('\n✅ Seed complete!');
