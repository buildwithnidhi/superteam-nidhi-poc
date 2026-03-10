import { NextRequest, NextResponse } from "next/server";
import { fetchBatchPayments, updateRecord } from "@/lib/airtable";
import { verifyFoundationToken } from "@/lib/batch";
import { sendRejectionEmail, sendAcceptanceEmail } from "@/lib/email";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get("batchId");
  const token = searchParams.get("token");

  if (!batchId || !token) {
    return NextResponse.json({ error: "Missing batchId or token" }, { status: 400 });
  }

  if (!verifyFoundationToken(batchId, token)) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  try {
    const records = await fetchBatchPayments(batchId);
    return NextResponse.json({ records, batchId });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { batchId, token, decisions } = await req.json();

    if (!verifyFoundationToken(batchId, token)) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const results = { accepted: 0, rejected: 0, emails: [] as string[] };

    for (const decision of decisions) {
      const { recordId, decision: dec, reason, name, email, amount, projectName, walletAddress } = decision;

      await updateRecord(recordId, {
        "Foundation Decision": dec === "accepted" ? "Accepted" : "Rejected",
        "Payment Status": dec === "accepted" ? "Accepted" : "Rejected",
        "Rejection Reason": dec === "rejected" ? reason : "",
      });

      if (dec === "accepted") {
        results.accepted++;
        // Send acceptance email — override to demo email for now
        const toEmail = email || "pratik.dholani1@gmail.com";
        await sendAcceptanceEmail({
          recipientEmail: "pratik.dholani1@gmail.com",
          recipientName: name,
          amount,
          projectName,
          walletAddress,
          batchId,
        });
        results.emails.push(toEmail);
      } else {
        results.rejected++;
        // Send rejection email — override to demo email
        await sendRejectionEmail({
          recipientEmail: "nidhiajain2003@gmail.com",
          recipientName: name,
          amount,
          reason: reason || "Payment could not be processed at this time.",
          projectName,
          batchId,
        });
        results.emails.push(email || "nidhiajain2003@gmail.com");
      }
    }

    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    console.error("Foundation review error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
