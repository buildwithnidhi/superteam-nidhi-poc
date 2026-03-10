import { NextRequest, NextResponse } from "next/server";
import { updateRecords } from "@/lib/airtable";
import { generateBatchId, generateFoundationToken, parseAmount } from "@/lib/batch";
import { sendFoundationEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { recordIds, records } = await req.json();

    if (!recordIds || recordIds.length === 0) {
      return NextResponse.json({ error: "No records selected" }, { status: 400 });
    }

    const batchId = generateBatchId();
    const token = generateFoundationToken(batchId);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const reviewUrl = `${appUrl}/foundation?batchId=${batchId}&token=${token}`;

    const updates = recordIds.map((id: string) => ({
      id,
      fields: {
        "Payment Status": "Sent to Foundation",
        "Batch Id": batchId,
        "Foundation Decision": "Pending",
      },
    }));

    await updateRecords(updates);

    const totalAmount = records.reduce(
      (sum: number, r: { amount: string }) => sum + parseAmount(r.amount),
      0
    );

    await sendFoundationEmail({
      batchId,
      reviewUrl,
      paymentCount: records.length,
      totalAmount,
      payments: records.map((r: {
        name: string;
        amount: string;
        wallet: string;
        purpose: string;
      }) => ({
        name: r.name,
        amount: r.amount,
        wallet: r.wallet,
        purpose: r.purpose,
      })),
    });

    return NextResponse.json({
      success: true,
      batchId,
      reviewUrl,
      recordCount: recordIds.length,
    });
  } catch (error) {
    console.error("Batch error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
