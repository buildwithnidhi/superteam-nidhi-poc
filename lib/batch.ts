import crypto from "crypto";

export function generateBatchId(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  return `BATCH-${dateStr}`;
}

export function generateFoundationToken(batchId: string): string {
  const secret = process.env.FOUNDATION_SECRET || "superteam-secret";
  return crypto
    .createHmac("sha256", secret)
    .update(batchId)
    .digest("hex")
    .slice(0, 32);
}

export function verifyFoundationToken(batchId: string, token: string): boolean {
  const expected = generateFoundationToken(batchId);
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(token, "hex")
  );
}

export function parseAmount(amountStr: string): number {
  const match = amountStr.match(/[\d,]+\.?\d*/);
  if (!match) return 0;
  return parseFloat(match[0].replace(/,/g, ""));
}
