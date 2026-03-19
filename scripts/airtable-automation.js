/**
 * AIRTABLE AUTOMATION SCRIPT
 * ─────────────────────────────────────────────────────────────────────────────
 * Setup instructions:
 *  1. In Airtable → Automations → Create automation
 *  2. Trigger: "When a record is created"  (or "When record matches conditions")
 *  3. Action: "Run a script"
 *  4. Add input variable:  name = "recordId",  value = Trigger > Record ID
 *  5. Paste this entire script into the script editor
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Checks performed on every new record:
 *  1. Amount > $10,000                          → SOFT flag
 *  2. Same wallet, completely different name    → HARD flag
 *  3. Same wallet, same words different order   → SOFT flag
 *  4. Same name, different wallet address       → SOFT flag
 *
 * Output: written to the "Analysis" field as pipe-separated labels, e.g.
 *   "HARD: Name mismatch (was: John Doe) | SOFT: Wallet changed"
 *   or "Clear" if no flags raised.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { recordId } = input.config();

const table = base.getTable("Payments"); // change if your table name differs

// Fetch the triggering record
const record = await table.selectRecordAsync(recordId, {
  fields: ["Name", "Wallet Address", "Amount"],
});

// Fetch all records for cross-referencing (only fields we need)
const allResult = await table.selectRecordsAsync({
  fields: ["Name", "Wallet Address", "Amount", "Status"],
});

const name   = (record.getCellValueAsString("Name") || "").trim();
const wallet = (record.getCellValueAsString("Wallet Address") || "").trim();
const amountStr = record.getCellValueAsString("Amount") || "0";
const amount = parseFloat(amountStr.replace(/[^0-9.]/g, "")) || 0;

// Historical = all records except the current one that are verified/paid
// Adjust the Status filter below to match your real data (e.g. "Paid", "Sent")
const history = allResult.records.filter(
  (r) => r.id !== recordId && r.getCellValueAsString("Status") === "Verified"
);

const flags = [];

// ── Check 1: Large amount ────────────────────────────────────────────────────
if (amount > 10000) {
  flags.push(`SOFT: Large amount (${amountStr}) — flagged for awareness`);
}

// ── Check 2 & 3: Same wallet → different name ────────────────────────────────
if (wallet) {
  const walletLower = wallet.toLowerCase();
  const sameWallet = history.filter(
    (r) => r.getCellValueAsString("Wallet Address").toLowerCase() === walletLower
  );

  for (const prev of sameWallet) {
    const prevName = prev.getCellValueAsString("Name").trim();
    if (!prevName || prevName.toLowerCase() === name.toLowerCase()) continue;

    const nameWords = new Set(name.toLowerCase().split(/\s+/).filter(Boolean));
    const prevWords = new Set(prevName.toLowerCase().split(/\s+/).filter(Boolean));
    const overlap   = [...nameWords].filter((w) => prevWords.has(w)).length;
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

// ── Check 4: Same name → different wallet ────────────────────────────────────
if (name && wallet) {
  const walletLower = wallet.toLowerCase();
  const sameName = history.filter(
    (r) => r.getCellValueAsString("Name").toLowerCase() === name.toLowerCase()
  );

  for (const prev of sameName) {
    const prevWallet = prev.getCellValueAsString("Wallet Address").trim();
    if (prevWallet && prevWallet.toLowerCase() !== walletLower) {
      const short = prevWallet.slice(0, 6) + "…" + prevWallet.slice(-4);
      flags.push(`SOFT: Wallet changed — "${name}" previously used ${short}`);
      break;
    }
  }
}

// ── Write result back to Airtable ────────────────────────────────────────────
const analysis = flags.length > 0 ? flags.join(" | ") : "Clear";
await table.updateRecordAsync(recordId, { Analysis: analysis });

console.log(`Record ${recordId} → ${analysis}`);
