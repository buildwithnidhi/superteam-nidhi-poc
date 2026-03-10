import { NextRequest, NextResponse } from "next/server";
import { getData, getGuestsForEvents } from "@/lib/luma";
import { LumaGuest } from "@/lib/types";

interface PersonRow {
  name: string;
  email: string;
  role: "host" | "guest";
  approvalStatus: string | null;
  eventName: string;
  eventId: string;
  location: string;
}

interface EventPeopleGroup {
  eventId: string;
  eventName: string;
  eventDate: string;
  location: string;
  eventUrl: string | null;
  hosts: PersonRow[];
  guests: PersonRow[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const eventIds = searchParams.get("eventIds");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const city = searchParams.get("city");
    const country = searchParams.get("country");

    // getData uses cache — fetches people too if not cached yet (needed for host identification)
    const cacheData = await getData();
    let events = cacheData.events;

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

    // Cap at 50 events to avoid rate limiting
    if (events.length > 50) {
      events = events.slice(0, 50);
    }

    const eventIdList = events.map((e) => e.api_id);
    const eventGuestMap = await getGuestsForEvents(eventIdList);

    const hostEmailsFromTags = new Set(
      cacheData.people
        .filter((p) =>
          p.tags.some((t) => t.name.toLowerCase().includes("host"))
        )
        .map((p) => p.email.toLowerCase())
    );

    const groups: EventPeopleGroup[] = [];

    for (const event of events) {
      const guests: LumaGuest[] = eventGuestMap[event.api_id] || [];
      const location = event.geo_address_json
        ? [event.geo_address_json.city, event.geo_address_json.country]
            .filter(Boolean)
            .join(", ")
        : "Online";

      const hostEmails = new Set<string>();
      const hostRows: PersonRow[] = [];

      for (const g of guests) {
        const isHost =
          hostEmailsFromTags.has(g.user_email.toLowerCase());
        if (isHost) {
          hostEmails.add(g.user_email.toLowerCase());
          hostRows.push({
            name: g.user_name,
            email: g.user_email,
            role: "host",
            approvalStatus: null,
            eventName: event.name,
            eventId: event.api_id,
            location,
          });
        }
      }

      const guestRows: PersonRow[] = guests
        .filter((g) => !hostEmails.has(g.user_email.toLowerCase()))
        .map((g) => ({
          name: g.user_name,
          email: g.user_email,
          role: "guest",
          approvalStatus: g.approval_status,
          eventName: event.name,
          eventId: event.api_id,
          location,
        }));

      groups.push({
        eventId: event.api_id,
        eventName: event.name,
        eventDate: event.start_at,
        location,
        eventUrl: event.url,
        hosts: hostRows,
        guests: guestRows,
      });
    }

    const people: PersonRow[] = groups.flatMap((g) => [...g.hosts, ...g.guests]);

    return NextResponse.json({ people, groups });
  } catch (error) {
    console.error("Failed to fetch people:", error);
    return NextResponse.json(
      { error: "Failed to fetch people" },
      { status: 500 }
    );
  }
}
