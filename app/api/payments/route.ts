import { NextResponse } from "next/server";
import { fetchPayments, analyzePaymentFlags } from "@/lib/airtable";

export async function GET() {
  try {
    const records = await fetchPayments();
    const recordsWithFlags = records.map((record) => ({
      ...record,
      flags: analyzePaymentFlags(record, records),
    }));
    return NextResponse.json({ records: recordsWithFlags });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
