"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/* ── Fonts (shared with payments/foundation) ─────────────────────────────── */

const FONT_URL =
  "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap";

function useFonts() {
  useEffect(() => {
    if (document.querySelector(`link[href="${FONT_URL}"]`)) return;
    const p1 = document.createElement("link");
    p1.rel = "preconnect";
    p1.href = "https://fonts.googleapis.com";
    document.head.appendChild(p1);
    const p2 = document.createElement("link");
    p2.rel = "preconnect";
    p2.href = "https://fonts.gstatic.com";
    p2.crossOrigin = "anonymous";
    document.head.appendChild(p2);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONT_URL;
    document.head.appendChild(link);
  }, []);
}

const font = {
  display: "'Instrument Serif', Georgia, serif",
  body: "'Plus Jakarta Sans', system-ui, sans-serif",
  mono: "'IBM Plex Mono', monospace",
};

/* ── Types ────────────────────────────────────────────────────────────────── */

interface LumaEvent {
  api_id: string;
  name: string;
  start_at: string;
  end_at: string;
  url: string | null;
  cover_url: string | null;
  geo_address_json: {
    city?: string;
    country?: string;
    full_address?: string;
  } | null;
  guestCounts: { registered: number; approved: number } | null;
}

interface LocationOption {
  city: string;
  country: string;
}

/* ── Main Component ──────────────────────────────────────────────────────── */

export default function Dashboard() {
  useFonts();
  const router = useRouter();

  const [events, setEvents] = useState<LumaEvent[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [startDate, setStartDate] = useState("2026-01-01");
  const [endDate, setEndDate] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [sortBy, setSortBy] = useState("upcoming");

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (selectedCity) params.set("city", selectedCity);
    if (selectedCountry) params.set("country", selectedCountry);
    return params;
  }, [startDate, endDate, selectedCity, selectedCountry]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildParams();
      const res = await fetch(`/api/events?${params}`);
      const data = await res.json();
      setEvents(data.events || []);
      setLocations(data.locations || []);
      setLastRefreshed(data.lastRefreshed || "");
    } catch (err) {
      console.error("Failed to fetch events:", err);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/refresh", { method: "POST" });
      await fetchEvents();
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const now = new Date();
  const sortedEvents = [...events].sort((a, b) => {
    const aDate = new Date(a.start_at).getTime();
    const bDate = new Date(b.start_at).getTime();
    if (sortBy === "upcoming") {
      const aUpcoming = aDate >= now.getTime();
      const bUpcoming = bDate >= now.getTime();
      if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
      return aUpcoming ? aDate - bDate : bDate - aDate;
    }
    if (sortBy === "past") {
      const aPast = aDate < now.getTime();
      const bPast = bDate < now.getTime();
      if (aPast !== bPast) return aPast ? -1 : 1;
      return bDate - aDate;
    }
    if (sortBy === "asc") return aDate - bDate;
    return bDate - aDate; // desc
  });

  const uniqueCountries = Array.from(
    new Set(locations.map((l) => l.country))
  ).sort();
  const filteredCities = locations
    .filter((l) => !selectedCountry || l.country === selectedCountry)
    .map((l) => l.city);
  const uniqueCities = Array.from(new Set(filteredCities)).sort();

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getLocation = (event: LumaEvent) =>
    event.geo_address_json
      ? [event.geo_address_json.city, event.geo_address_json.country]
          .filter(Boolean)
          .join(", ") || "In-person"
      : "Online";

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: font.body }}>
      {/* Header */}
      <div className="border-b border-black/[0.06] sticky top-0 z-40 bg-white/95 backdrop-blur-sm">
        <div className="max-w-[1200px] mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-[6px] h-[6px] rounded-full bg-black" />
            <div>
              <h1
                style={{ fontFamily: font.display }}
                className="text-[22px] font-normal text-black tracking-[-0.01em]"
              >
                Events <span className="italic">Dashboard</span>
              </h1>
              {lastRefreshed && (
                <p className="text-[11px] text-black/30 tracking-wide mt-0.5">
                  Last refreshed {formatDate(lastRefreshed)}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 text-[11px] font-medium tracking-[0.1em] uppercase text-black/35 hover:text-black/60 transition-colors disabled:opacity-30"
          >
            <svg className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M20.015 4.356v4.992" />
            </svg>
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-8 py-10">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-[1px] bg-black/[0.06] mb-10">
          {[
            { label: "Total Events", value: events.length },
            {
              label: "Locations",
              value: new Set(events.map((e) => e.geo_address_json?.city).filter(Boolean)).size,
            },
            {
              label: "Countries",
              value: new Set(events.map((e) => e.geo_address_json?.country).filter(Boolean)).size,
            },
          ].map((stat) => (
            <div key={stat.label} className="bg-white p-6">
              <div
                style={{ fontFamily: font.display }}
                className={`text-[32px] leading-none ${stat.value === 0 ? "text-black/15" : "text-black/80"}`}
              >
                {stat.value}
              </div>
              <div
                className="text-[10px] font-medium tracking-[0.15em] uppercase mt-2"
                style={{ opacity: stat.value > 0 ? 0.4 : 0.2 }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Table container */}
        <div className="border border-black/[0.06]">
          {/* Filters */}
          <div className="px-6 py-3 border-b border-black/[0.06] bg-black/[0.01] flex items-center gap-4 flex-wrap">
            <span className="text-[10px] font-medium tracking-[0.15em] uppercase text-black/30">
              Date
            </span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ fontFamily: font.mono }}
                className="text-[11px] border border-black/[0.08] px-3 py-1.5 text-black/60 bg-white focus:outline-none focus:border-black/20 transition-colors"
              />
              <span className="text-[10px] text-black/20">to</span>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ fontFamily: font.mono }}
                className="text-[11px] border border-black/[0.08] px-3 py-1.5 text-black/60 bg-white focus:outline-none focus:border-black/20 transition-colors"
              />
            </div>

            <div className="w-[1px] h-4 bg-black/[0.08]" />

            <span className="text-[10px] font-medium tracking-[0.15em] uppercase text-black/30">
              Location
            </span>
            <select
              value={selectedCountry}
              onChange={(e) => {
                setSelectedCountry(e.target.value);
                setSelectedCity("");
              }}
              style={{ fontFamily: font.mono }}
              className="text-[11px] border border-black/[0.08] px-3 py-1.5 text-black/60 bg-white focus:outline-none focus:border-black/20 transition-colors"
            >
              <option value="">All Countries</option>
              {uniqueCountries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              style={{ fontFamily: font.mono }}
              className="text-[11px] border border-black/[0.08] px-3 py-1.5 text-black/60 bg-white focus:outline-none focus:border-black/20 transition-colors"
            >
              <option value="">All Cities</option>
              {uniqueCities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <div className="w-[1px] h-4 bg-black/[0.08]" />
            <span className="text-[10px] font-medium tracking-[0.15em] uppercase text-black/30">Sort</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ fontFamily: font.mono }}
              className="text-[11px] border border-black/[0.08] px-3 py-1.5 text-black/60 bg-white focus:outline-none focus:border-black/20 transition-colors"
            >
              <option value="upcoming">Upcoming first</option>
              <option value="past">Past first</option>
              <option value="asc">Date ↑</option>
              <option value="desc">Date ↓</option>
            </select>

            {(startDate || endDate || selectedCity || selectedCountry) && (
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setSelectedCity("");
                  setSelectedCountry("");
                }}
                className="text-[10px] text-black/25 hover:text-black/50 tracking-wide transition-colors ml-1"
              >
                Clear
              </button>
            )}

            <span className="text-[11px] text-black/40 tracking-wide ml-auto">
              {sortedEvents.length} event{sortedEvents.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center gap-4">
                <div className="w-6 h-6 border-[1.5px] border-black/10 border-t-black/60 rounded-full animate-spin" />
                <p className="text-[12px] text-black/30 tracking-wide">Loading events</p>
              </div>
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24">
              <p className="text-[13px] text-black/25 tracking-wide">No events found</p>
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-black/[0.06]">
                  {["Event", "Date", "Location", "Registered", "Approved"].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-3 text-left text-[9px] font-medium tracking-[0.15em] uppercase text-black/30"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedEvents.map((event) => (
                  <tr
                    key={event.api_id}
                    onClick={() => router.push(`/events/${event.api_id}`)}
                    className="border-b border-black/[0.04] transition-colors hover:bg-black/[0.015] cursor-pointer group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {event.cover_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={event.cover_url}
                            alt=""
                            className="w-10 h-10 object-cover shrink-0"
                            style={{ backgroundColor: "rgba(0,0,0,0.03)" }}
                          />
                        ) : (
                          <div className="w-10 h-10 shrink-0 bg-black/[0.03]" />
                        )}
                        <span className="font-medium text-black group-hover:underline underline-offset-2 decoration-black/20">
                          {event.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-black/40">{formatDate(event.start_at)}</td>
                    <td className="px-6 py-4 text-black/40">
                      <div className="flex items-center justify-between">
                        <span>{getLocation(event)}</span>
                        <svg className="w-3.5 h-3.5 text-black/15 group-hover:text-black/40 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-black/40 text-center">
                      {event.guestCounts ? event.guestCounts.registered : <span className="text-black/15">—</span>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {event.guestCounts ? (
                        <span className="text-emerald-600 font-medium">{event.guestCounts.approved}</span>
                      ) : <span className="text-black/15">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <p className="text-[11px] text-center text-black/20 mt-5 tracking-wide">
          Click any event to view hosts, guests & details
        </p>
      </div>
    </div>
  );
}
