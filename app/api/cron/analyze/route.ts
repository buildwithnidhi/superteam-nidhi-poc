import { NextRequest, NextResponse } from "next/server";
import { fetchPayments, analyzePaymentFlags, updateRecords } from "@/lib/airtable";

// Vercel cron calls this endpoint — secured with a secret so nobody else can trigger it
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const all = await fetchPayments();

    const updates: Array<{ id: string; fields: { Analysis: string } }> = [];

    for (const record of all) {
      const history = all.filter((r) => r.id !== record.id);
      const flags   = analyzePaymentFlags(record, history);
      const analysis = flags.length > 0 ? flags.map((f) => `${f.level.toUpperCase()}: ${f.message}`).join(" | ") : "Clear";

      // Only update if the value has changed
      if (record.fields["Analysis"] !== analysis) {
        updates.push({ id: record.id, fields: { Analysis: analysis } });
      }
    }

    if (updates.length > 0) {
      await updateRecords(updates);
    }

    return NextResponse.json({ updated: updates.length, total: all.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
