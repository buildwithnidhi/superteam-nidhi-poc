import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

export async function POST() {
  revalidateTag("luma-events", "max");
  return NextResponse.json({ success: true });
}
