// Env vars match Superteam Earn's naming convention exactly:
//   AIRTABLE_GRANTS_API_TOKEN       — Personal access token
//   AIRTABLE_PAYMENTS_BASE_ID       — Base ID from the Airtable URL
//   AIRTABLE_PAYMENTS_TABLE_NAME    — Table name (e.g. "Payments")
const BASE_URL = `https://api.airtable.com/v0/${process.env.AIRTABLE_PAYMENTS_BASE_ID}/${process.env.AIRTABLE_PAYMENTS_TABLE_NAME}`;

const headers = {
  Authorization: `Bearer ${process.env.AIRTABLE_GRANTS_API_TOKEN}`,
  "Content-Type": "application/json",
};

export interface AirtableRecord {
  id: string;
  fields: {
    Name?: string;
    Email?: string;
    "Wallet Address"?: string;
    Amount?: string;
    "Purpose of Payment"?: string;
    Details?: string;
    Category?: string;
    Region?: string;
    Approver?: string;
    Analysis?: string;
    "WA Chars"?: boolean;
    Status?: string;
    "Status - Details"?: string;
    "Proof of Work"?: string;
    "Discord / Earn Username"?: string;
    Created?: string;
    "Date Added"?: string;
    // Workflow fields we add
    "Payment Status"?: string;
    "Foundation Decision"?: string;
    "Rejection Reason"?: string;
    "Batch Id"?: string;
  };
}

export async function fetchPayments(): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(BASE_URL);
    if (offset) url.searchParams.set("offset", offset);
    url.searchParams.set("pageSize", "100");

    const res = await fetch(url.toString(), { headers, cache: "no-store" });
    if (!res.ok) throw new Error(`Airtable error: ${res.statusText}`);

    const data = await res.json();
    records.push(...data.records);
    offset = data.offset;
  } while (offset);

  return records;
}

export async function fetchPendingPayments(): Promise<AirtableRecord[]> {
  const all = await fetchPayments();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return all.filter((r) => {
    const isPending =
      !r.fields["Payment Status"] ||
      r.fields["Payment Status"] === "Pending Review";

    // "Date Added" is the field Earn writes when the record is created
    const dateAdded = r.fields["Date Added"] || r.fields["Created"];
    const isLastWeek = dateAdded
      ? new Date(dateAdded) >= sevenDaysAgo
      : true; // if no date, include it

    return isPending && isLastWeek;
  });
}

export async function fetchBatchPayments(batchId: string): Promise<AirtableRecord[]> {
  const all = await fetchPayments();
  return all.filter((r) => r.fields["Batch Id"] === batchId);
}

export async function updateRecord(
  recordId: string,
  fields: Partial<AirtableRecord["fields"]>
): Promise<void> {
  const res = await fetch(`${BASE_URL}/${recordId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Airtable update failed: ${err}`);
  }
}

/* ── Payment flag analysis ─────────────────────────────────────────────────
 * Cross-references a payment against all historical paid records to surface
 * the same checks the Solana Foundation performs manually:
 *  1. Amount > $10,000
 *  2. Same wallet, completely different name (hard flag)
 *  3. Same wallet, same words but different name order (soft flag)
 *  4. Same name, different wallet address (wallet changed)
 * ─────────────────────────────────────────────────────────────────────────── */

export interface PaymentFlag {
  level: "hard" | "soft";
  type: "name" | "wallet" | "amount";
  message: string;
}

export function analyzePaymentFlags(
  record: AirtableRecord,
  allRecords: AirtableRecord[]
): PaymentFlag[] {
  const flags: PaymentFlag[] = [];

  const name = (record.fields["Name"] || "").trim();
  const wallet = (record.fields["Wallet Address"] || "").trim();
  const amountStr = record.fields["Amount"] || "0";
  const amount = parseFloat(amountStr.replace(/[^0-9.]/g, "")) || 0;

  // Historical = previously accepted records (not the current one)
  const history = allRecords.filter(
    (r) =>
      r.id !== record.id &&
      (r.fields["Foundation Decision"] === "Accepted" ||
        r.fields["Payment Status"] === "Accepted" ||
        r.fields["Payment Status"] === "Sent to Superteam")
  );

  // Rule 1: Amount > $10,000 — internal note only, does not block
  if (amount > 10000) {
    flags.push({ level: "soft", type: "amount", message: `Large grant amount (${amountStr}) — flagged for internal awareness` });
  }

  // Rule 2 & 3: Wallet → name consistency
  if (wallet) {
    const walletLower = wallet.toLowerCase();
    const sameWallet = history.filter(
      (r) => (r.fields["Wallet Address"] || "").trim().toLowerCase() === walletLower
    );
    for (const prev of sameWallet) {
      const prevName = (prev.fields["Name"] || "").trim();
      if (!prevName || prevName.toLowerCase() === name.toLowerCase()) continue;

      // Compare word sets
      const nameWords = new Set(name.toLowerCase().split(/\s+/).filter(Boolean));
      const prevWords = new Set(prevName.toLowerCase().split(/\s+/).filter(Boolean));
      const overlap = [...nameWords].filter((w) => prevWords.has(w)).length;
      const similarity = overlap / Math.max(nameWords.size, prevWords.size);

      if (similarity === 1.0) {
        // Exact same words, different order — soft flag
        flags.push({
          level: "soft",
          type: "name",
          message: `Name order differs — this wallet was registered as "${prevName}"`,
        });
      } else if (similarity >= 0.5) {
        // Partial overlap — soft flag
        flags.push({
          level: "soft",
          type: "name",
          message: `Name partially differs — this wallet was registered as "${prevName}"`,
        });
      } else {
        // Completely different name for this wallet — hard flag
        flags.push({
          level: "hard",
          type: "name",
          message: `Name mismatch — this wallet was previously registered as "${prevName}"`,
        });
      }
      break;
    }
  }

  // Rule 4: Name → wallet consistency (wallet changed)
  if (name && wallet) {
    const walletLower = wallet.toLowerCase();
    const sameName = history.filter(
      (r) => (r.fields["Name"] || "").trim().toLowerCase() === name.toLowerCase()
    );
    for (const prev of sameName) {
      const prevWallet = (prev.fields["Wallet Address"] || "").trim();
      if (prevWallet && prevWallet.toLowerCase() !== walletLower) {
        const short = prevWallet.slice(0, 6) + "…" + prevWallet.slice(-4);
        flags.push({
          level: "soft",
          type: "wallet",
          message: `Wallet address changed — "${name}" previously used ${short}`,
        });
        break;
      }
    }
  }

  return flags;
}

export async function updateRecords(
  updates: Array<{ id: string; fields: Partial<AirtableRecord["fields"]> }>
): Promise<void> {
  // Airtable allows up to 10 records per batch update
  for (let i = 0; i < updates.length; i += 10) {
    const batch = updates.slice(i, i + 10);
    const res = await fetch(BASE_URL, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ records: batch }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Airtable batch update failed: ${err}`);
    }
  }
}
