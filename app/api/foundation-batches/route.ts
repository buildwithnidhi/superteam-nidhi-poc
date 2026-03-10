import { NextRequest, NextResponse } from "next/server";
import { fetchPayments } from "@/lib/airtable";
import { generateFoundationToken } from "@/lib/batch";
import crypto from "crypto";

function verifyPassword(password: string): boolean {
  const secret = process.env.FOUNDATION_SECRET || "superteam-secret";
  const expected = crypto
    .createHash("sha256")
    .update(secret)
    .digest("hex");
  const provided = crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(provided, "hex")
  );
}

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();

    if (!password || !verifyPassword(password)) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const allRecords = await fetchPayments();

    // Group by Batch Id
    const batchMap = new Map<
      string,
      {
        batchId: string;
        totalPayments: number;
        totalAmount: number;
        accepted: number;
        rejected: number;
        pending: number;
        status: "pending" | "reviewed" | "partial";
      }
    >();

    for (const r of allRecords) {
      const batchId = r.fields["Batch Id"];
      if (!batchId) continue;

      if (!batchMap.has(batchId)) {
        batchMap.set(batchId, {
          batchId,
          totalPayments: 0,
          totalAmount: 0,
          accepted: 0,
          rejected: 0,
          pending: 0,
          status: "pending",
        });
      }

      const batch = batchMap.get(batchId)!;
      batch.totalPayments++;

      const amountMatch = (r.fields["Amount"] || "").match(/[\d,]+\.?\d*/);
      if (amountMatch) {
        batch.totalAmount += parseFloat(amountMatch[0].replace(/,/g, ""));
      }

      const decision = r.fields["Foundation Decision"];
      if (decision === "Accepted") batch.accepted++;
      else if (decision === "Rejected") batch.rejected++;
      else batch.pending++;
    }

    // Compute status and add tokens
    const batches = Array.from(batchMap.values()).map((b) => {
      if (b.pending === 0) b.status = "reviewed";
      else if (b.accepted > 0 || b.rejected > 0) b.status = "partial";
      else b.status = "pending";

      return {
        ...b,
        token: generateFoundationToken(b.batchId),
      };
    });

    // Sort newest first
    batches.sort((a, b) => b.batchId.localeCompare(a.batchId));

    return NextResponse.json({ batches });
  } catch (error) {
    console.error("Foundation batches error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
