import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env.local') });

const LUMA_API_KEY = process.env.LUMA_API_KEY;
const API_BASE = 'https://public-api.luma.com/v1';

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
  throw new Error(`Failed after ${retries} retries`);
}

// Get all event IDs from DB (Jan 2026+) that don't have guests yet
const [events] = await pool.execute(
  `SELECT e.event_api_id FROM luma_events e
   WHERE e.start_at >= '2026-01-01'
   AND NOT EXISTS (SELECT 1 FROM luma_guests g WHERE g.event_api_id = e.event_api_id)
   ORDER BY e.start_at DESC`
);

console.log(`Found ${events.length} events without guest data. Fetching...`);

let done = 0;
for (const { event_api_id } of events) {
  try {
    // Fetch all guest pages for this event
    const guests = [];
    let cursor = null;
    do {
      const params = new URLSearchParams({ event_id: event_api_id, pagination_limit: '100' });
      if (cursor) params.set('pagination_cursor', cursor);
      const res = await fetchWithRetry(`${API_BASE}/event/get-guests?${params}`);
      if (!res.ok) break;
      const data = await res.json();
      guests.push(...(data.entries || []).map(e => e.guest));
      cursor = data.has_more ? data.next_cursor : null;
    } while (cursor);

    // Upsert guests
    for (const g of guests) {
      await pool.execute(
        `INSERT INTO luma_guests (event_api_id, user_api_id, name, email, approval_status, registered_at, checked_in_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE approval_status=VALUES(approval_status), checked_in_at=VALUES(checked_in_at)`,
        [
          event_api_id,
          g.user_api_id || g.api_id,
          g.user_name || g.name || '',
          g.user_email || g.email || '',
          g.approval_status,
          g.registered_at ? new Date(g.registered_at) : null,
          g.checked_in_at ? new Date(g.checked_in_at) : null,
        ]
      );
    }

    done++;
    console.log(`[${done}/${events.length}] ${event_api_id}: ${guests.length} guests`);

    // 3s delay between events to stay well under rate limit
    await new Promise(r => setTimeout(r, 3000));
  } catch (err) {
    console.warn(`  Skipped ${event_api_id}: ${err.message}`);
  }
}

await pool.end();
console.log('\n✅ Guests seed complete!');
