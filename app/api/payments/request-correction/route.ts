import { NextRequest, NextResponse } from "next/server";
import { fetchPayments, analyzePaymentFlags } from "@/lib/airtable";
import { sendCorrectionRequestEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { recordId } = await req.json();
    if (!recordId) {
      return NextResponse.json({ error: "Missing recordId" }, { status: 400 });
    }

    const allRecords = await fetchPayments();
    const record = allRecords.find((r) => r.id === recordId);
    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    const flags = analyzePaymentFlags(record, allRecords);
    if (!flags.length) {
      return NextResponse.json({ error: "No flags found for this record" }, { status: 400 });
    }

    const email = record.fields["Email"];
    if (!email) {
      return NextResponse.json({ error: "No email address on this record" }, { status: 400 });
    }

    const recipientName = record.fields["Name"] || "—";
    const projectName =
      record.fields["Details"] || record.fields["Purpose of Payment"] || "your submission";

    await sendCorrectionRequestEmail({
      recipientEmail: email,
      recipientName,
      projectName,
      flags,
    });

    return NextResponse.json({ success: true, flagCount: flags.length });
  } catch (error) {
    console.error("Correction request error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
