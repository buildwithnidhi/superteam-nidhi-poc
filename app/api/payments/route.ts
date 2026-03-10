import { NextResponse } from "next/server";
import { fetchPayments } from "@/lib/airtable";

export async function GET() {
  try {
    const records = await fetchPayments();
    return NextResponse.json({ records });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
