const BASE_URL = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}`;

const headers = {
  Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
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
  return all.filter(
    (r) =>
      !r.fields["Payment Status"] ||
      r.fields["Payment Status"] === "Pending Review"
  );
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
