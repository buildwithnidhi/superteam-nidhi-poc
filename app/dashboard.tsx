"use client";

import { useCallback, useEffect, useState } from "react";

interface LumaEvent {
  api_id: string;
  name: string;
  start_at: string;
  end_at: string;
  url: string | null;
  geo_address_json: {
    city?: string;
    country?: string;
    full_address?: string;
  } | null;
}

interface PersonRow {
  name: string;
  email: string;
  role: "attendee";
  eventName: string;
  eventId: string;
  location: string;
}

interface LocationOption {
  city: string;
  country: string;
}

// ── SVG Icons ──────────────────────────────────────────────────────────────────

function IconRefresh({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className ?? "w-4 h-4"}>
      <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M5.75 7.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM5 10.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0ZM10.25 7.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM9.5 10.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0ZM7.75 7.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM7 10.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0Z" />
      <path fillRule="evenodd" d="M4.75 1a.75.75 0 0 1 .75.75V3h5V1.75a.75.75 0 0 1 1.5 0V3h.75A2.25 2.25 0 0 1 15 5.25v7.5A2.25 2.25 0 0 1 12.75 15h-9.5A2.25 2.25 0 0 1 1 12.75v-7.5A2.25 2.25 0 0 1 3.25 3H4V1.75A.75.75 0 0 1 4.75 1ZM2.5 7v5.75c0 .414.336.75.75.75h9.5a.75.75 0 0 0 .75-.75V7h-11Z" clipRule="evenodd" />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1ZM3.873 6.176A5.501 5.501 0 0 1 7.5 2.645V5.5a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5v-.5c0-.286.126-.541.373-.824ZM2.5 8a5.502 5.502 0 0 0 3.94 5.262A.5.5 0 0 1 6 12.75v-.25a.5.5 0 0 0-.5-.5H4a.5.5 0 0 1-.5-.5V11a.5.5 0 0 0-.5-.5H2.537A5.517 5.517 0 0 0 2.5 8Zm5.5 5.5v-1.75a.5.5 0 0 0-.5-.5H6a.5.5 0 0 1-.5-.5V9a.5.5 0 0 1 .5-.5h1.5a.5.5 0 0 0 .5-.5V7a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1a.5.5 0 0 0 .5.5h.5a.5.5 0 0 1 .5.5v3.5a.5.5 0 0 1-.5.5H9a.5.5 0 0 0-.5.5v.5c-.334.05-.674.07-1 .05Zm3.127.762A5.5 5.5 0 0 0 13.5 8a5.517 5.517 0 0 0-.037-.5H13a.5.5 0 0 0-.5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 0-.5.5v2.25c0 .152-.068.285-.173.373Z" clipRule="evenodd" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 0 1 7 17a9.953 9.953 0 0 1-5.385-1.572ZM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 0 0-1.588-3.755 4.502 4.502 0 0 1 5.874 2.636.818.818 0 0 1-.36.98A7.465 7.465 0 0 1 14.5 16Z" />
    </svg>
  );
}

function IconCalendarGrid() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M5.25 12A.75.75 0 0 1 6 11.25h.01a.75.75 0 0 1 .75.75v.01a.75.75 0 0 1-.75.75H6a.75.75 0 0 1-.75-.75V12ZM6 13.25a.75.75 0 0 0-.75.75v.01c0 .414.336.75.75.75h.01a.75.75 0 0 0 .75-.75V14a.75.75 0 0 0-.75-.75H6ZM7.25 12a.75.75 0 0 1 .75-.75h.01a.75.75 0 0 1 .75.75v.01a.75.75 0 0 1-.75.75H8a.75.75 0 0 1-.75-.75V12ZM8 13.25a.75.75 0 0 0-.75.75v.01c0 .414.336.75.75.75h.01a.75.75 0 0 0 .75-.75V14a.75.75 0 0 0-.75-.75H8ZM9.25 10a.75.75 0 0 1 .75-.75h.01a.75.75 0 0 1 .75.75v.01a.75.75 0 0 1-.75.75H10a.75.75 0 0 1-.75-.75V10ZM10 11.25a.75.75 0 0 0-.75.75v.01c0 .414.336.75.75.75h.01a.75.75 0 0 0 .75-.75V12a.75.75 0 0 0-.75-.75H10ZM9.25 14a.75.75 0 0 1 .75-.75h.01a.75.75 0 0 1 .75.75v.01a.75.75 0 0 1-.75.75H10a.75.75 0 0 1-.75-.75V14ZM12 9.25a.75.75 0 0 0-.75.75v.01c0 .414.336.75.75.75h.01a.75.75 0 0 0 .75-.75V10a.75.75 0 0 0-.75-.75H12ZM11.25 12a.75.75 0 0 1 .75-.75h.01a.75.75 0 0 1 .75.75v.01a.75.75 0 0 1-.75.75H12a.75.75 0 0 1-.75-.75V12ZM12 13.25a.75.75 0 0 0-.75.75v.01c0 .414.336.75.75.75h.01a.75.75 0 0 0 .75-.75V14a.75.75 0 0 0-.75-.75H12Z" />
      <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
    </svg>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function SkeletonEventRow() {
  return (
    <tr className="border-b border-white/[0.03]">
      <td className="px-4 py-3.5"><div className="skeleton h-4 w-4" /></td>
      <td className="px-4 py-3.5"><div className="skeleton h-4 w-52" /></td>
      <td className="px-4 py-3.5"><div className="skeleton h-4 w-28" /></td>
      <td className="px-4 py-3.5"><div className="skeleton h-4 w-36" /></td>
    </tr>
  );
}

function SkeletonPeopleRow() {
  const widths = ["w-32", "w-16", "w-44", "w-36", "w-24"];
  return (
    <tr className="border-b border-white/[0.03]">
      {widths.map((w, i) => (
        <td key={i} className="px-4 py-3.5"><div className={`skeleton h-4 ${w}`} /></td>
      ))}
    </tr>
  );
}

// ── Filter input shared classes ────────────────────────────────────────────────

const inputCls =
  "rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-slate-200 outline-none transition-colors duration-150 focus:border-violet-500/50 placeholder:text-slate-600";

// ── Main Component ─────────────────────────────────────────────────────────────

export default function Dashboard({ defaultStartDate }: { defaultStartDate: string }) {
  const [events, setEvents] = useState<LumaEvent[]>([]);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingPeople, setLoadingPeople] = useState(false);

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"events" | "people">("events");

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
      const res = await fetch(`/api/events?${buildParams()}`);
      const data = await res.json();
      setEvents(data.events || []);
      setLocations(data.locations || []);
    } catch (err) {
      console.error("Failed to fetch events:", err);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  const fetchPeople = useCallback(async () => {
    setLoadingPeople(true);
    try {
      const params = buildParams();
      if (selectedEventIds.size > 0) params.set("eventIds", Array.from(selectedEventIds).join(","));
      const res = await fetch(`/api/people?${params}`);
      const data = await res.json();
      setPeople(data.people || []);
    } catch (err) {
      console.error("Failed to fetch people:", err);
    } finally {
      setLoadingPeople(false);
    }
  }, [buildParams, selectedEventIds]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useEffect(() => { if (activeTab === "people") fetchPeople(); }, [activeTab, fetchPeople]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/refresh", { method: "POST" });
      await fetchEvents();
      if (activeTab === "people") await fetchPeople();
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const toggleEvent = (id: string) => {
    setSelectedEventIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const uniqueCountries = Array.from(new Set(locations.map((l) => l.country))).sort();
  const uniqueCities = Array.from(
    new Set(locations.filter((l) => !selectedCountry || l.country === selectedCountry).map((l) => l.city))
  ).sort();

  const uniquePeople = new Map<string, PersonRow>();
  people.forEach((p) => { if (!uniquePeople.has(p.email)) uniquePeople.set(p.email, p); });

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  const hasFilters = startDate || endDate || selectedCity || selectedCountry;

  // ── Shared table header classes
  const thCls = "px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500";

  return (
    <div className="page-glow min-h-screen bg-[#07070f] text-slate-100">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#07070f]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="font-display text-xl font-bold leading-none tracking-tight">
              <span className="gradient-text">Superteam</span>
              <span className="ml-2 text-slate-300">Events</span>
            </h1>
            <p className="mt-0.5 text-xs text-slate-600">
              {lastRefreshed ? `Refreshed ${formatDateTime(lastRefreshed)}` : "Event attendance dashboard"}
            </p>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-primary flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white"
          >
            <IconRefresh className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {/* ── Filters ──────────────────────────────────────────────────────────── */}
      <div className="border-b border-white/[0.04] bg-white/[0.02]">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex flex-wrap items-end gap-3">

            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-600">
                <IconCalendar /> Start Date
              </label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-600">
                <IconCalendar /> End Date
              </label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-600">
                <IconGlobe /> Country
              </label>
              <select
                value={selectedCountry}
                onChange={(e) => { setSelectedCountry(e.target.value); setSelectedCity(""); }}
                className={`${inputCls} min-w-[140px] cursor-pointer`}
              >
                <option value="">All Countries</option>
                {uniqueCountries.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-600">
                <IconGlobe /> City
              </label>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className={`${inputCls} min-w-[140px] cursor-pointer`}
              >
                <option value="">All Cities</option>
                {uniqueCities.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {hasFilters && (
              <button
                onClick={() => { setStartDate(""); setEndDate(""); setSelectedCity(""); setSelectedCountry(""); }}
                className="self-end rounded-lg border border-white/[0.08] bg-transparent px-3 py-2 text-sm text-slate-500 transition-colors duration-150 hover:border-white/[0.15] hover:text-slate-300 cursor-pointer"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <div className="relative z-10 mx-auto max-w-7xl px-6 py-6">

        {/* Stats */}
        {!loading && (
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2.5 rounded-lg border border-violet-500/20 bg-violet-500/[0.07] px-4 py-2.5">
              <IconCalendarGrid />
              <span className="text-sm text-slate-400">
                <span className="font-display mr-1 text-lg font-semibold text-violet-300">{events.length}</span>
                events
              </span>
            </div>
            {selectedEventIds.size > 0 && (
              <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-2.5">
                <span className="text-sm text-slate-400">
                  <span className="font-display mr-1 text-lg font-semibold text-emerald-400">{selectedEventIds.size}</span>
                  selected
                </span>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-5 flex w-fit gap-1 rounded-xl bg-white/[0.04] p-1">
          {(["events", "people"] as const).map((tab) => {
            const isActive = activeTab === tab;
            const label = tab === "events" ? "Events" : "Hosts & Guests";
            const count = tab === "events" ? events.length : uniquePeople.size;
            const showCount = tab === "events" ? true : people.length > 0;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  isActive ? "text-white" : "text-slate-500 hover:text-slate-300"
                }`}
                style={
                  isActive
                    ? { background: "linear-gradient(135deg, rgba(124,58,237,0.9), rgba(109,40,217,0.9))", boxShadow: "0 0 16px rgba(124,58,237,0.25)" }
                    : {}
                }
              >
                {tab === "events" ? <IconCalendarGrid /> : <IconUsers />}
                {label}
                {showCount && (
                  <span className={`rounded-full px-1.5 py-0.5 text-xs font-mono ${isActive ? "bg-white/20 text-white" : "bg-white/[0.06] text-slate-600"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Events Table ─────────────────────────────────────────────────── */}
        {activeTab === "events" && (
          <>
            {loading ? (
              <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#0f0f1e]">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.05] bg-white/[0.02]">
                      <th className={`${thCls} w-10`} />
                      <th className={thCls}>Event</th>
                      <th className={thCls}>Date</th>
                      <th className={thCls}>Location</th>
                    </tr>
                  </thead>
                  <tbody>{Array.from({ length: 7 }).map((_, i) => <SkeletonEventRow key={i} />)}</tbody>
                </table>
              </div>
            ) : events.length === 0 ? (
              <div className="rounded-xl border border-white/[0.06] bg-[#0f0f1e] py-20 text-center">
                <p className="text-sm text-slate-600">No events found matching your filters.</p>
                {hasFilters && (
                  <button
                    onClick={() => { setStartDate(""); setEndDate(""); setSelectedCity(""); setSelectedCountry(""); }}
                    className="mt-3 cursor-pointer text-sm text-violet-400 transition-colors hover:text-violet-300"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#0f0f1e]">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.05] bg-white/[0.02]">
                      <th className={`${thCls} w-10`}>
                        <input
                          type="checkbox"
                          checked={selectedEventIds.size === events.length && events.length > 0}
                          onChange={() =>
                            selectedEventIds.size === events.length
                              ? setSelectedEventIds(new Set())
                              : setSelectedEventIds(new Set(events.map((e) => e.api_id)))
                          }
                        />
                      </th>
                      <th className={thCls}>Event</th>
                      <th className={thCls}>Date</th>
                      <th className={thCls}>Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event) => (
                      <tr
                        key={event.api_id}
                        className="group border-b border-white/[0.03] transition-colors duration-150 hover:bg-violet-500/[0.05]"
                      >
                        <td className="px-4 py-3.5">
                          <input type="checkbox" checked={selectedEventIds.has(event.api_id)} onChange={() => toggleEvent(event.api_id)} />
                        </td>
                        <td className="px-4 py-3.5 font-medium text-slate-200">
                          {event.url ? (
                            <a href={event.url} target="_blank" rel="noopener noreferrer" className="transition-colors duration-150 hover:text-violet-300">
                              {event.name}
                            </a>
                          ) : (
                            event.name
                          )}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs tabular-nums text-slate-500">
                          {formatDate(event.start_at)}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-500">
                          {event.geo_address_json
                            ? [event.geo_address_json.city, event.geo_address_json.country].filter(Boolean).join(", ") || "In-person"
                            : "Online"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {selectedEventIds.size > 0 && (
              <div className="mt-4 flex items-center gap-3">
                <span className="text-sm text-slate-600">
                  {selectedEventIds.size} event{selectedEventIds.size !== 1 ? "s" : ""} selected
                </span>
                <button
                  onClick={() => setActiveTab("people")}
                  className="btn-primary flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white"
                >
                  <IconUsers />
                  View Hosts &amp; Guests
                  <IconArrowRight />
                </button>
              </div>
            )}
          </>
        )}

        {/* ── People Table ──────────────────────────────────────────────────── */}
        {activeTab === "people" && (
          <>
            {loadingPeople ? (
              <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#0f0f1e]">
                <div className="border-b border-white/[0.05] px-4 py-3">
                  <div className="skeleton h-4 w-56" />
                </div>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.05] bg-white/[0.02]">
                      {["Name", "Role", "Email", "Event", "Location"].map((h) => (
                        <th key={h} className={thCls}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>{Array.from({ length: 8 }).map((_, i) => <SkeletonPeopleRow key={i} />)}</tbody>
                </table>
              </div>
            ) : people.length === 0 ? (
              <div className="rounded-xl border border-white/[0.06] bg-[#0f0f1e] py-20 text-center">
                <p className="text-sm text-slate-600">
                  {selectedEventIds.size > 0
                    ? "No people found for the selected events."
                    : "Select events on the Events tab to view their attendees."}
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#0f0f1e]">
                <div className="flex items-center border-b border-white/[0.05] bg-violet-500/[0.04] px-4 py-3">
                  <p className="text-sm text-slate-500">
                    <span className="font-semibold text-violet-300">{uniquePeople.size}</span> unique people
                    <span className="mx-2 text-slate-700">·</span>
                    {people.length} total registrations
                  </p>
                </div>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.05] bg-white/[0.02]">
                      {["Name", "Role", "Email", "Event", "Location"].map((h) => (
                        <th key={h} className={thCls}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {people.map((person, i) => (
                      <tr
                        key={`${person.email}-${person.eventId}-${i}`}
                        className="border-b border-white/[0.03] transition-colors duration-150 hover:bg-violet-500/[0.05]"
                      >
                        <td className="px-4 py-3.5 font-medium text-slate-200">
                          {person.name || <span className="text-slate-700">—</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-block rounded-full border border-violet-500/25 bg-violet-500/[0.12] px-2.5 py-0.5 text-xs font-medium text-violet-300">
                            {person.role}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs text-slate-500">{person.email}</td>
                        <td className="px-4 py-3.5 text-xs text-slate-400">{person.eventName}</td>
                        <td className="px-4 py-3.5 text-xs text-slate-500">{person.location}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
