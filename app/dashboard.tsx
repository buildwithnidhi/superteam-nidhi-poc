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
  role: "host" | "guest";
  eventName: string;
  eventId: string;
  location: string;
}

interface LocationOption {
  city: string;
  country: string;
}

export default function Dashboard() {
  const [events, setEvents] = useState<LumaEvent[]>([]);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingPeople, setLoadingPeople] = useState(false);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(
    new Set()
  );

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

  const fetchPeople = useCallback(async () => {
    setLoadingPeople(true);
    try {
      const params = buildParams();
      if (selectedEventIds.size > 0) {
        params.set("eventIds", Array.from(selectedEventIds).join(","));
      }
      const res = await fetch(`/api/people?${params}`);
      const data = await res.json();
      setPeople(data.people || []);
    } catch (err) {
      console.error("Failed to fetch people:", err);
    } finally {
      setLoadingPeople(false);
    }
  }, [buildParams, selectedEventIds]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (activeTab === "people") {
      fetchPeople();
    }
  }, [activeTab, fetchPeople]);

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
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const uniqueCountries = Array.from(
    new Set(locations.map((l) => l.country))
  ).sort();
  const filteredCities = locations
    .filter((l) => !selectedCountry || l.country === selectedCountry)
    .map((l) => l.city);
  const uniqueCities = Array.from(new Set(filteredCities)).sort();

  const uniquePeople = new Map<string, PersonRow>();
  people.forEach((p) => {
    const existing = uniquePeople.get(p.email);
    if (!existing || p.role === "host") {
      uniquePeople.set(p.email, p);
    }
  });

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              Superteam Events Dashboard
            </h1>
            {lastRefreshed && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Last refreshed: {formatDateTime(lastRefreshed)}
              </p>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {refreshing ? "Refreshing..." : "Refresh Data"}
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Country
              </label>
              <select
                value={selectedCountry}
                onChange={(e) => {
                  setSelectedCountry(e.target.value);
                  setSelectedCity("");
                }}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="">All Countries</option>
                {uniqueCountries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                City
              </label>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="">All Cities</option>
                {uniqueCities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            {(startDate || endDate || selectedCity || selectedCountry) && (
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setSelectedCity("");
                  setSelectedCountry("");
                }}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mx-auto max-w-7xl px-6 pt-6">
        <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab("events")}
            className={`px-4 py-2 text-sm font-medium transition ${
              activeTab === "events"
                ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            }`}
          >
            Events ({events.length})
          </button>
          <button
            onClick={() => setActiveTab("people")}
            className={`px-4 py-2 text-sm font-medium transition ${
              activeTab === "people"
                ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            }`}
          >
            Hosts & Guests
            {people.length > 0 && ` (${uniquePeople.size})`}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-6 py-6">
        {activeTab === "events" && (
          <>
            {loading ? (
              <div className="py-20 text-center text-zinc-500">
                Loading events...
              </div>
            ) : events.length === 0 ? (
              <div className="py-20 text-center text-zinc-500">
                No events found matching your filters.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                      <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                        <input
                          type="checkbox"
                          checked={
                            selectedEventIds.size === events.length &&
                            events.length > 0
                          }
                          onChange={() => {
                            if (selectedEventIds.size === events.length) {
                              setSelectedEventIds(new Set());
                            } else {
                              setSelectedEventIds(
                                new Set(events.map((e) => e.api_id))
                              );
                            }
                          }}
                          className="rounded"
                        />
                      </th>
                      <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                        Event Name
                      </th>
                      <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                        Date
                      </th>
                      <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                        Location
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event) => (
                      <tr
                        key={event.api_id}
                        className="border-b border-zinc-100 transition hover:bg-zinc-50 dark:border-zinc-800/50 dark:hover:bg-zinc-800/30"
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedEventIds.has(event.api_id)}
                            onChange={() => toggleEvent(event.api_id)}
                            className="rounded"
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                          {event.url ? (
                            <a
                              href={event.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline"
                            >
                              {event.name}
                            </a>
                          ) : (
                            event.name
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                          {formatDate(event.start_at)}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                          {event.geo_address_json
                            ? [
                                event.geo_address_json.city,
                                event.geo_address_json.country,
                              ]
                                .filter(Boolean)
                                .join(", ") || "In-person"
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
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {selectedEventIds.size} event(s) selected
                </span>
                <button
                  onClick={() => setActiveTab("people")}
                  className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  View Hosts & Guests
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === "people" && (
          <>
            {loadingPeople ? (
              <div className="py-20 text-center text-zinc-500">
                Loading people...
              </div>
            ) : people.length === 0 ? (
              <div className="py-20 text-center text-zinc-500">
                {selectedEventIds.size > 0
                  ? "No people found for the selected events."
                  : "No people found. Try adjusting your filters or selecting specific events."}
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Showing {uniquePeople.size} unique people across{" "}
                    {people.length} registrations
                  </p>
                </div>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                      <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                        Name
                      </th>
                      <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                        Role
                      </th>
                      <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                        Email
                      </th>
                      <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                        Event
                      </th>
                      <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                        Location
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {people.map((person, i) => (
                      <tr
                        key={`${person.email}-${person.eventId}-${i}`}
                        className="border-b border-zinc-100 transition hover:bg-zinc-50 dark:border-zinc-800/50 dark:hover:bg-zinc-800/30"
                      >
                        <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                          {person.name || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                              person.role === "host"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                            }`}
                          >
                            {person.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                          {person.email}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                          {person.eventName}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                          {person.location}
                        </td>
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
