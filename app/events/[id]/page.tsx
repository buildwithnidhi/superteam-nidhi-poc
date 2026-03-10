"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

/* ── Fonts ────────────────────────────────────────────────────────────────── */

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

interface EventDetail {
  api_id: string;
  name: string;
  start_at: string;
  end_at: string;
  url: string | null;
  cover_url: string | null;
  location: string;
  full_address: string | null;
  timezone: string | null;
}

interface PersonRow {
  name: string;
  email: string;
  role: "host" | "guest";
  approvalStatus: string | null;
}

/* ── Main ─────────────────────────────────────────────────────────────────── */

export default function EventDetailPage() {
  useFonts();

  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [hosts, setHosts] = useState<PersonRow[]>([]);
  const [guests, setGuests] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/events/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => {
        setEvent(data.event);
        setHosts(data.hosts || []);
        setGuests(data.guests || []);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

  const getInitials = (name: string) =>
    name
      ? name
          .split(" ")
          .map((n) => n[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()
      : "?";

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center" style={{ fontFamily: font.body }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-6 h-6 border-[1.5px] border-black/10 border-t-black/60 rounded-full animate-spin" />
          <p className="text-[12px] text-black/30 tracking-wide">Loading event</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center" style={{ fontFamily: font.body }}>
        <div className="text-center">
          <p className="text-[13px] text-black/30 tracking-wide mb-4">Event not found</p>
          <button
            onClick={() => router.push("/")}
            className="text-[11px] font-medium tracking-[0.08em] uppercase text-black/40 hover:text-black/70 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: font.body }}>
      {/* Header */}
      <div className="border-b border-black/[0.06] sticky top-0 z-40 bg-white/95 backdrop-blur-sm">
        <div className="max-w-[1200px] mx-auto px-8 py-4 flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-[11px] font-medium tracking-[0.08em] uppercase text-black/35 hover:text-black/60 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Events
          </button>
          <div className="w-[1px] h-4 bg-black/[0.08]" />
          <p className="text-[11px] text-black/30 tracking-wide truncate">{event.name}</p>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-8 py-10">
        {/* Cover + Event Info */}
        <div className="grid grid-cols-[1fr_360px] gap-10 mb-12">
          {/* Left: Cover image */}
          <div>
            {event.cover_url ? (
              <div className="relative overflow-hidden bg-black/[0.03]" style={{ aspectRatio: "16/9" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={event.cover_url}
                  alt={event.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div
                className="flex items-center justify-center bg-black/[0.03]"
                style={{ aspectRatio: "16/9" }}
              >
                <p className="text-[12px] text-black/15 tracking-wide">No cover image</p>
              </div>
            )}
          </div>

          {/* Right: Event details */}
          <div className="flex flex-col justify-between">
            <div>
              <h1
                style={{ fontFamily: font.display }}
                className="text-[28px] leading-tight text-black tracking-[-0.01em] mb-4"
              >
                {event.name}
              </h1>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <svg className="w-4 h-4 text-black/25 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                  <div>
                    <p className="text-[13px] font-medium text-black">{formatDate(event.start_at)}</p>
                    <p className="text-[11px] text-black/35 mt-0.5">
                      {formatTime(event.start_at)} — {formatTime(event.end_at)}
                      {event.timezone && <span className="ml-1 text-black/20">({event.timezone})</span>}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <svg className="w-4 h-4 text-black/25 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  <div>
                    <p className="text-[13px] font-medium text-black">{event.location}</p>
                    {event.full_address && (
                      <p className="text-[11px] text-black/35 mt-0.5">{event.full_address}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-[1px] bg-black/[0.06] mt-6">
              <div className="bg-white p-4">
                <div
                  style={{ fontFamily: font.display }}
                  className={`text-[28px] leading-none ${hosts.length > 0 ? "text-black/80" : "text-black/15"}`}
                >
                  {hosts.length}
                </div>
                <div
                  className="text-[9px] font-medium tracking-[0.15em] uppercase mt-1.5"
                  style={{ color: hosts.length > 0 ? "#92400e" : undefined, opacity: hosts.length > 0 ? 0.7 : 0.3 }}
                >
                  Hosts
                </div>
              </div>
              <div className="bg-white p-4">
                <div
                  style={{ fontFamily: font.display }}
                  className={`text-[28px] leading-none ${guests.length > 0 ? "text-black/80" : "text-black/15"}`}
                >
                  {guests.length}
                </div>
                <div
                  className="text-[9px] font-medium tracking-[0.15em] uppercase mt-1.5"
                  style={{ color: guests.length > 0 ? "#1d4ed8" : undefined, opacity: guests.length > 0 ? 0.7 : 0.3 }}
                >
                  Guests
                </div>
              </div>
            </div>

            {event.url && (
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex items-center justify-center gap-2 bg-black hover:bg-black/85 text-white text-[11px] font-medium tracking-[0.08em] uppercase px-5 py-3 transition-all duration-200"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
                View on Luma
              </a>
            )}
          </div>
        </div>

        {/* People Section */}
        <div className="border border-black/[0.06]">
          {/* Hosts */}
          <div className="border-b border-black/[0.06]">
            <div className="px-6 py-3 flex items-center gap-2" style={{ backgroundColor: "rgba(245,158,11,0.03)" }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#f59e0b" }} />
              <span className="text-[9px] font-medium tracking-[0.15em] uppercase" style={{ color: "#92400e" }}>
                Hosts
              </span>
              <span className="text-[9px] text-black/20 tracking-wide">{hosts.length}</span>
            </div>
            {hosts.length === 0 ? (
              <div className="px-6 py-6 text-center text-[12px] text-black/20 tracking-wide">
                No hosts identified for this event
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3">
                {hosts.map((host, i) => (
                  <div
                    key={`${host.email}-${i}`}
                    className="flex items-center gap-3 px-6 py-3 border-b border-r border-black/[0.03]"
                  >
                    <div
                      className="w-8 h-8 flex items-center justify-center text-[10px] font-semibold tracking-wide shrink-0"
                      style={{
                        backgroundColor: "rgba(245,158,11,0.08)",
                        color: "#92400e",
                      }}
                    >
                      {getInitials(host.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-black truncate">{host.name || "Unknown"}</p>
                      <p className="text-[10px] text-black/25 truncate">{host.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Guests */}
          <div>
            <div className="px-6 py-3 flex items-center gap-2" style={{ backgroundColor: "rgba(59,130,246,0.02)" }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#3b82f6" }} />
              <span className="text-[9px] font-medium tracking-[0.15em] uppercase" style={{ color: "#1d4ed8" }}>
                Guests
              </span>
              <span className="text-[9px] text-black/20 tracking-wide">{guests.length}</span>
            </div>
            {guests.length === 0 ? (
              <div className="px-6 py-6 text-center text-[12px] text-black/20 tracking-wide">
                No guests found for this event
              </div>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-black/[0.06]">
                    {["Name", "Email", "Status"].map((h) => (
                      <th
                        key={h}
                        className="px-6 py-2.5 text-left text-[9px] font-medium tracking-[0.15em] uppercase text-black/30"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {guests.map((guest, i) => (
                    <tr
                      key={`${guest.email}-${i}`}
                      className="border-b border-black/[0.03] hover:bg-black/[0.01] transition-colors"
                    >
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-7 h-7 flex items-center justify-center text-[10px] font-semibold tracking-wide shrink-0"
                            style={{
                              backgroundColor: "rgba(59,130,246,0.06)",
                              color: "#1d4ed8",
                            }}
                          >
                            {getInitials(guest.name)}
                          </div>
                          <span className="font-medium text-black truncate">{guest.name || "Unknown"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-black/35">{guest.email}</td>
                      <td className="px-6 py-3">
                        {guest.approvalStatus && (
                          <span
                            className="text-[9px] font-medium tracking-[0.08em] uppercase px-2 py-0.5"
                            style={
                              guest.approvalStatus === "approved"
                                ? { color: "#047857", backgroundColor: "rgba(16,185,129,0.06)" }
                                : guest.approvalStatus === "pending_approval"
                                  ? { color: "#92400e", backgroundColor: "rgba(245,158,11,0.05)" }
                                  : { color: "rgba(0,0,0,0.3)", backgroundColor: "rgba(0,0,0,0.03)" }
                            }
                          >
                            {guest.approvalStatus === "pending_approval" ? "pending" : guest.approvalStatus}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
