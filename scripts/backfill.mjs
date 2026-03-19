/**
 * ONE-TIME BACKFILL SCRIPT
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs all 3 flag checks against every existing record in the Airtable base
 * and writes results to the "Analysis" field.
 *
 * Usage:
 *   node scripts/backfill.mjs
 *
 * Requires env vars (create a .env.local or export them in your shell):
 *   AIRTABLE_GRANTS_API_TOKEN
 *   AIRTABLE_PAYMENTS_BASE_ID
 *   AIRTABLE_PAYMENTS_TABLE_NAME
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TOKEN    = process.env.AIRTABLE_GRANTS_API_TOKEN;
const BASE_ID  = process.env.AIRTABLE_PAYMENTS_BASE_ID;
const TABLE    = process.env.AIRTABLE_PAYMENTS_TABLE_NAME;

if (!TOKEN || !BASE_ID || !TABLE) {
  console.error("Missing env vars: AIRTABLE_GRANTS_API_TOKEN, AIRTABLE_PAYMENTS_BASE_ID, AIRTABLE_PAYMENTS_TABLE_NAME");
  process.exit(1);
}

const BASE_URL = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}`;
const HEADERS  = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

// ── Fetch all records ────────────────────────────────────────────────────────
async function fetchAll() {
  const records = [];
  let offset;
  do {
    const url = new URL(BASE_URL);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);

    const res  = await fetch(url.toString(), { headers: HEADERS });
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));

    records.push(...data.records);
    offset = data.offset;
    process.stdout.write(`\rFetched ${records.length} records...`);
  } while (offset);

  console.log();
  return records;
}

// ── Flag analysis (mirrors lib/airtable.ts logic) ────────────────────────────
function analyzeFlags(record, history) {
  const flags = [];
  const f = record.fields;

  const name      = (f["Name"] || "").trim();
  const wallet    = (f["Wallet Address"] || "").trim();
  const amountStr = f["Amount"] || "0";
  const amount    = parseFloat(amountStr.replace(/[^0-9.]/g, "")) || 0;

  // Check 1: Large amount
  if (amount > 10000) {
    flags.push(`SOFT: Large amount (${amountStr}) — flagged for awareness`);
  }

  // Check 2 & 3: Wallet → name consistency
  if (wallet) {
    const walletLower = wallet.toLowerCase();
    const sameWallet  = history.filter(
      (r) => (r.fields["Wallet Address"] || "").trim().toLowerCase() === walletLower
    );

    for (const prev of sameWallet) {
      const prevName = (prev.fields["Name"] || "").trim();
      if (!prevName || prevName.toLowerCase() === name.toLowerCase()) continue;

      const nameWords  = new Set(name.toLowerCase().split(/\s+/).filter(Boolean));
      const prevWords  = new Set(prevName.toLowerCase().split(/\s+/).filter(Boolean));
      const overlap    = [...nameWords].filter((w) => prevWords.has(w)).length;
      const similarity = overlap / Math.max(nameWords.size, prevWords.size);

      if (similarity === 1.0) {
        flags.push(`SOFT: Name order differs (wallet was registered as "${prevName}")`);
      } else if (similarity >= 0.5) {
        flags.push(`SOFT: Name partially differs (wallet was registered as "${prevName}")`);
      } else {
        flags.push(`HARD: Name mismatch — wallet was registered as "${prevName}"`);
      }
      break;
    }
  }

  // Check 4: Name → wallet consistency
  if (name && wallet) {
    const walletLower = wallet.toLowerCase();
    const sameName    = history.filter(
      (r) => (r.fields["Name"] || "").trim().toLowerCase() === name.toLowerCase()
    );

    for (const prev of sameName) {
      const prevWallet = (prev.fields["Wallet Address"] || "").trim();
      if (prevWallet && prevWallet.toLowerCase() !== walletLower) {
        const short = prevWallet.slice(0, 6) + "…" + prevWallet.slice(-4);
        flags.push(`SOFT: Wallet changed — "${name}" previously used ${short}`);
        break;
      }
    }
  }

  return flags.length > 0 ? flags.join(" | ") : "Clear";
}

// ── Batch update (Airtable max 10 per request) ───────────────────────────────
async function batchUpdate(updates) {
  for (let i = 0; i < updates.length; i += 10) {
    const batch = updates.slice(i, i + 10);
    const res   = await fetch(BASE_URL, {
      method:  "PATCH",
      headers: HEADERS,
      body:    JSON.stringify({ records: batch }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Batch update failed: ${err}`);
    }
    process.stdout.write(`\rUpdated ${Math.min(i + 10, updates.length)}/${updates.length}...`);
  }
  console.log();
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log("Fetching all records...");
  const all = await fetchAll();
  console.log(`Total records: ${all.length}`);

  // Historical = "Verified" records (adjust if your real base uses different status values)
  const verified = all.filter((r) => r.fields["Status"] === "Verified");

  const updates = [];
  for (const record of all) {
    // History = all verified records except the current one
    const history  = verified.filter((r) => r.id !== record.id);
    const analysis = analyzeFlags(record, history);
    updates.push({ id: record.id, fields: { Analysis: analysis } });
  }

  const flagged = updates.filter((u) => u.fields.Analysis !== "Clear");
  console.log(`Flagged: ${flagged.length} / ${all.length}`);
  console.log("Writing to Airtable...");

  await batchUpdate(updates);
  console.log("Done.");
})();
