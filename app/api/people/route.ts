import { NextRequest, NextResponse, connection } from "next/server";
import { fetchEvents, fetchGuestsForEvent } from "@/lib/luma";
import { LumaGuest } from "@/lib/types";


const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: NextRequest) {
  await connection(); // opts out of prerendering
  try {
    const { searchParams } = request.nextUrl;
    const eventIds = searchParams.get("eventIds");

    if (!eventIds) {
      return NextResponse.json({ people: [] });
    }

    const ids = eventIds.split(",").filter(Boolean);
    const allEvents = await fetchEvents(); // hits cache — no extra API calls
    const eventMap = new Map(allEvents.map((e) => [e.api_id, e]));

    // Fetch guests for each selected event sequentially to stay under rate limit
    const rows: {
      name: string;
      email: string;
      role: "attendee";
      eventName: string;
      eventId: string;
      location: string;
    }[] = [];

    for (let i = 0; i < ids.length; i++) {
      if (i > 0) await sleep(300);
      const id = ids[i];
      const event = eventMap.get(id);
      if (!event) continue;

      const location = event.geo_address_json
        ? [event.geo_address_json.city, event.geo_address_json.country]
            .filter(Boolean)
            .join(", ") || "In-person"
        : "Online";

      const guests: LumaGuest[] = await fetchGuestsForEvent(id);
      for (const g of guests) {
        rows.push({
          name: g.user_name,
          email: g.user_email,
          role: "attendee",
          eventName: event.name,
          eventId: id,
          location,
        });
      }
    }

    return NextResponse.json({ people: rows });
  } catch (error) {
    console.error("Failed to fetch people:", error);
    return NextResponse.json(
      { error: "Failed to fetch people" },
      { status: 500 }
    );
  }
}
