import { NextRequest, NextResponse } from "next/server";
import { getEvents } from "@/lib/luma";
import { db } from "@/lib/db";
import { lumaGuests } from "@/lib/schema";
import { eq, count, sum, sql, inArray } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const city = searchParams.get("city");
    const country = searchParams.get("country");

    const data = await getEvents();
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
        (e) =>
          e.geo_address_json?.city?.toLowerCase() === city.toLowerCase()
      );
    }
    if (country) {
      events = events.filter(
        (e) =>
          e.geo_address_json?.country?.toLowerCase() === country.toLowerCase()
      );
    }

    // Extract unique locations for filter options
    const locations = new Map<string, { city: string; country: string }>();
    data.events.forEach((e) => {
      const geo = e.geo_address_json;
      if (geo?.city && geo?.country) {
        locations.set(`${geo.city}-${geo.country}`, {
          city: geo.city,
          country: geo.country,
        });
      }
    });

    // Fetch guest counts from DB for all filtered events
    const eventIds = events.map((e) => e.api_id);
    let guestCounts: Record<string, { registered: number; approved: number }> = {};
    if (eventIds.length > 0) {
      const rows = await db
        .select({
          eventApiId: lumaGuests.eventApiId,
          registered: count(),
          approved: sum(sql`${lumaGuests.approvalStatus} = 'approved'`),
        })
        .from(lumaGuests)
        .where(inArray(lumaGuests.eventApiId, eventIds))
        .groupBy(lumaGuests.eventApiId);

      rows.forEach((r) => {
        guestCounts[r.eventApiId] = {
          registered: r.registered,
          approved: Number(r.approved) || 0,
        };
      });
    }

    return NextResponse.json({
      events: events.map((e) => ({ ...e, guestCounts: guestCounts[e.api_id] || null })),
      locations: Array.from(locations.values()),
      lastRefreshed: data.lastRefreshed,
    });
  } catch (error) {
    console.error("Failed to fetch events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}
