import { NextResponse } from "next/server";
import { getEvents } from "@/lib/luma";

export async function POST() {
  try {
    const data = await getEvents(true);
    return NextResponse.json({
      success: true,
      lastRefreshed: data.lastRefreshed,
      eventCount: data.events.length,
    });
  } catch (error) {
    console.error("Failed to refresh data:", error);
    return NextResponse.json(
      { error: "Failed to refresh data" },
      { status: 500 }
    );
  }
}
