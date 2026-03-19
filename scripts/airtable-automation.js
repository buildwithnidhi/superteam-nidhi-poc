/**
 * AIRTABLE AUTOMATION SCRIPT — paste this into an Airtable "Run a script" action
 * ─────────────────────────────────────────────────────────────────────────────
 * Setup:
 *  1. Automations → + New automation
 *  2. Trigger: "When a record is created"
 *  3. + Add action → "Run a script"
 *  4. Under "Input variables" add one:
 *       Name:  recordId
 *       Value: Trigger → Airtable record ID
 *  5. Paste this entire script → Save → Turn on
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Checks:
 *  1. Same wallet, completely different name        → [HARD] name mismatch
 *  2. Same wallet, same words different order       → [SOFT] name mismatch
 *  3. Same wallet, partial name overlap             → [SOFT] name mismatch
 *  4. Same name, different wallet                   → [SOFT] wallet-person mismatch
 *  5. Amount > $10,000                              → [SOFT] high amount
 *  6. Bounty/grant but scope looks like contractor  → [SOFT] contractor scope
 *
 * Writes to:
 *  - Analysis     (select field) → "Alert" or "Clear"
 *  - Flag Reasons (text field)   → short labels + full detail
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { recordId } = input.config();

const table = base.getTable("Payments"); // ← change if your table name differs

const record = await table.selectRecordAsync(recordId, {
  fields: ["Name", "Wallet Address", "Amount", "Purpose of Payment", "Details", "Category", "Status"],
});

const allResult = await table.selectRecordsAsync({
  fields: ["Name", "Wallet Address", "Amount", "Purpose of Payment", "Details", "Category", "Status"],
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function wordSet(str) {
  return new Set(str.toLowerCase().split(/\s+/).filter(Boolean));
}

function similarity(a, b) {
  const setA = wordSet(a), setB = wordSet(b);
  const overlap = [...setA].filter(w => setB.has(w)).length;
  return overlap / Math.max(setA.size, setB.size);
}

// ── Current record values ────────────────────────────────────────────────────

const name    = (record.getCellValueAsString("Name") || "").trim();
const wallet  = (record.getCellValueAsString("Wallet Address") || "").trim();
const amtStr  = record.getCellValueAsString("Amount") || "0";
const amount  = parseFloat(amtStr.replace(/[^0-9.]/g, "")) || 0;
const purpose = (record.getCellValueAsString("Purpose of Payment") || "").toLowerCase();
const details = (record.getCellValueAsString("Details") || "").toLowerCase();
const category = (record.getCellValueAsString("Category") || "").toLowerCase();
const combined = `${purpose} ${details}`;

// ── Historical records (all verified except current) ─────────────────────────

const history = allResult.records.filter(r =>
  r.id !== recordId &&
  r.getCellValueAsString("Status") === "Verified"
);

const flags = []; // { level, type, message }

// ── Check 1: Amount > $10,000 ────────────────────────────────────────────────

if (amount > 10000) {
  flags.push({ level: "SOFT", type: "high amount", message: `Large grant amount (${amtStr}) — flagged for internal awareness` });
}

// ── Check 2–3–4: Wallet → name consistency ───────────────────────────────────

if (wallet) {
  const walletLower = wallet.toLowerCase();
  const sameWallet = history.filter(r =>
    r.getCellValueAsString("Wallet Address").toLowerCase() === walletLower
  );

  for (const prev of sameWallet) {
    const prevName = prev.getCellValueAsString("Name").trim();
    if (!prevName || prevName.toLowerCase() === name.toLowerCase()) continue;

    const sim = similarity(name, prevName);

    if (sim === 1.0) {
      flags.push({ level: "SOFT", type: "name mismatch", message: `Name order differs — wallet was registered as "${prevName}"` });
    } else if (sim >= 0.5) {
      flags.push({ level: "SOFT", type: "name mismatch", message: `Name partially differs — wallet was registered as "${prevName}"` });
    } else {
      flags.push({ level: "HARD", type: "name mismatch", message: `Name mismatch — wallet was previously registered as "${prevName}"` });
    }
    break;
  }
}

// ── Check 5: Name → wallet consistency ──────────────────────────────────────

if (name && wallet) {
  const walletLower = wallet.toLowerCase();
  const sameName = history.filter(r =>
    r.getCellValueAsString("Name").toLowerCase() === name.toLowerCase()
  );

  for (const prev of sameName) {
    const prevWallet = prev.getCellValueAsString("Wallet Address").trim();
    if (prevWallet && prevWallet.toLowerCase() !== walletLower) {
      const short = prevWallet.slice(0, 6) + "…" + prevWallet.slice(-4);
      flags.push({ level: "SOFT", type: "wallet-person mismatch", message: `Wallet address changed — "${name}" previously used ${short}` });
      break;
    }
  }
}

// ── Check 6: Contractor/freelancer scope in bounty/grant ────────────────────

const ROLE_PATTERNS = [
  /\bdevrel\b/, /\bdeveloper\s+relations?\b/, /\bdev\s+rel\b/,
  /\bpartnership[s]?\b/, /\bbd\s+manager\b/, /\bbusiness\s+development\b/,
  /\bcommunity\s+manager\b/, /\bhead\s+of\b/, /\blead\s+for\b/,
  /\bcontractor\b/, /\bfreelancer\b/, /\bretainer\b/,
  /\bonboarding\s+manager\b/, /\bgrowth\s+manager\b/,
  /\bmonthly\s+(pay|compensation|salary|stipend)\b/,
  /\bhiring\b.*\bsuperteam\b/, /\bsuperteam\b.*\bhiring\b/,
];
const ROLE_KEYWORDS = [
  "ambassador", "evangelist", "moderator hired", "paid role",
  "ongoing role", "monthly role", "part-time", "full-time",
];

const isRolePattern = ROLE_PATTERNS.some(re => re.test(combined));
const isRoleKeyword = ROLE_KEYWORDS.some(kw => combined.includes(kw));
const isBountyOrGrant = category.includes("bounty") || category.includes("grant");

if ((isRolePattern || isRoleKeyword) && isBountyOrGrant) {
  flags.push({
    level: "SOFT",
    type: "contractor scope",
    message: "Scope resembles a contractor/freelancer role — should come from Superteam's own budget, not the foundation",
  });
}

// ── Write results back ───────────────────────────────────────────────────────

const analysis = flags.length > 0 ? "Alert" : "Clear";

const uniqueLabels = [...new Set(flags.map(f => f.type))].join(", ");
const detail = flags.map(f => `[${f.level}] ${f.message}`).join("\n");
const flagReasons = flags.length > 0 ? `${uniqueLabels}\n\n${detail}` : "";

await table.updateRecordAsync(recordId, {
  "Analysis": analysis,
  "Flag Reasons": flagReasons,
});

console.log(`${name} → ${analysis}${flags.length > 0 ? `: ${uniqueLabels}` : ""}`);
