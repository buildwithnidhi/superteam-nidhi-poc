import { NextResponse } from "next/server";
import { getData } from "@/lib/luma";

export async function POST() {
  try {
    const data = await getData(true);
    return NextResponse.json({
      success: true,
      lastRefreshed: data.lastRefreshed,
      eventCount: data.events.length,
      peopleCount: data.people.length,
    });
  } catch (error) {
    console.error("Failed to refresh data:", error);
    return NextResponse.json(
      { error: "Failed to refresh data" },
      { status: 500 }
    );
  }
}
