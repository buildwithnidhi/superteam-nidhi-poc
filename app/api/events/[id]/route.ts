import { NextRequest, NextResponse } from "next/server";
import { getEvents, getGuestsForEvents, getHostsForEvents } from "@/lib/luma";
import { LumaGuest } from "@/lib/types";

interface PersonRow {
  name: string;
  email: string;
  role: "host" | "guest";
  approvalStatus: string | null;
  avatar_url?: string | null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // getEvents uses cache — fast
    const eventsData = await getEvents();
    const event = eventsData.events.find((e) => e.api_id === id);

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Fetch guests + hosts in parallel (1 API call each max, cached after)
    const [eventGuestMap, eventHostMap] = await Promise.all([
      getGuestsForEvents([id]),
      getHostsForEvents([id]),
    ]);
    const guests: LumaGuest[] = eventGuestMap[id] || [];
    const eventHosts = eventHostMap[id] || [];

    // Hosts from /event/get endpoint (reliable — returns actual hosts with name/email/avatar)
    const hostEmails = new Set(eventHosts.map((h) => h.email.toLowerCase()).filter(Boolean));
    const hosts: PersonRow[] = eventHosts.map((h) => ({
      name: h.name,
      email: h.email,
      role: "host" as const,
      approvalStatus: null,
      avatar_url: h.avatar_url,
    }));

    const guestRows: PersonRow[] = guests
      .filter((g) => !hostEmails.has(g.user_email.toLowerCase()))
      .map((g) => ({
        name: g.user_name,
        email: g.user_email,
        role: "guest",
        approvalStatus: g.approval_status,
      }));

    const location = event.geo_address_json
      ? [event.geo_address_json.city, event.geo_address_json.country]
          .filter(Boolean)
          .join(", ")
      : "Online";

    return NextResponse.json({
      event: {
        api_id: event.api_id,
        name: event.name,
        start_at: event.start_at,
        end_at: event.end_at,
        url: event.url,
        cover_url: event.cover_url,
        location,
        full_address: event.geo_address_json?.full_address || null,
        timezone: event.timezone,
      },
      hosts,
      guests: guestRows,
    });
  } catch (error) {
    console.error("Failed to fetch event detail:", error);
    return NextResponse.json(
      { error: "Failed to fetch event details" },
      { status: 500 }
    );
  }
}
