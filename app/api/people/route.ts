import { NextRequest, NextResponse } from "next/server";
import { getData } from "@/lib/luma";
import { LumaGuest } from "@/lib/types";

interface PersonRow {
  name: string;
  email: string;
  role: "host" | "guest";
  eventName: string;
  eventId: string;
  location: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const eventIds = searchParams.get("eventIds");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const city = searchParams.get("city");
    const country = searchParams.get("country");

    const data = await getData();
    let events = data.events;

    if (startDate) {
      const start = new Date(startDate);
      events = events.filter((e) => new Date(e.start_at) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      events = events.filter((e) => new Date(e.start_at) <= end);
    }
    if (city) {
      events = events.filter(
        (e) => e.geo_address_json?.city?.toLowerCase() === city.toLowerCase()
      );
    }
    if (country) {
      events = events.filter(
        (e) =>
          e.geo_address_json?.country?.toLowerCase() === country.toLowerCase()
      );
    }
    if (eventIds) {
      const ids = new Set(eventIds.split(","));
      events = events.filter((e) => ids.has(e.api_id));
    }

    const rows: PersonRow[] = [];
    const seen = new Set<string>();

    // Find hosts from calendar people with "Host" tag
    const hostEmails = new Set(
      data.people
        .filter((p) =>
          p.tags.some((t) => t.name.toLowerCase().includes("host"))
        )
        .map((p) => p.email.toLowerCase())
    );

    for (const event of events) {
      const guests: LumaGuest[] = data.eventGuests[event.api_id] || [];
      const location = event.geo_address_json
        ? [event.geo_address_json.city, event.geo_address_json.country]
            .filter(Boolean)
            .join(", ")
        : "Online";

      for (const guest of guests) {
        const key = `${guest.user_email}-${event.api_id}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const isHost = hostEmails.has(guest.user_email.toLowerCase());
        rows.push({
          name: guest.user_name,
          email: guest.user_email,
          role: isHost ? "host" : "guest",
          eventName: event.name,
          eventId: event.api_id,
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
