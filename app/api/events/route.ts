import { NextRequest, NextResponse } from "next/server";
import { getEvents } from "@/lib/luma";

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

    return NextResponse.json({
      events,
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
