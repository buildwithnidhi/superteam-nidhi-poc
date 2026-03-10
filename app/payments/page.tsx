"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Check,
  X,
  AlertTriangle,
  Clock,
  Send,
  ChevronDown,
  ChevronUp,
  Globe,
  Tag,
  ExternalLink,
  RefreshCw,
  Loader2,
} from "lucide-react";

/* ── Fonts (shared with foundation) ──────────────────────────────────────── */

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

const clr = {
  accept: { bg: "rgba(16,185,129,0.06)", border: "rgba(16,185,129,0.15)", text: "#047857", dot: "#10b981" },
  reject: { bg: "rgba(239,68,68,0.05)", border: "rgba(239,68,68,0.12)", text: "#b91c1c", dot: "#ef4444" },
  pending: { bg: "rgba(245,158,11,0.05)", border: "rgba(245,158,11,0.12)", text: "#92400e", dot: "#f59e0b" },
  sent: { bg: "rgba(59,130,246,0.05)", border: "rgba(59,130,246,0.12)", text: "#1d4ed8", dot: "#3b82f6" },
};

/* ── Types ────────────────────────────────────────────────────────────────── */

interface Payment {
  id: string;
  name: string;
  email: string;
  wallet: string;
  amount: string;
  purpose: string;
  details: string;
  category: string;
  region: string;
  approver: string;
  analysis: string;
  waChars: boolean;
  status: string;
  paymentStatus: string;
  foundationDecision: string;
  rejectionReason: string;
  batchId: string;
  pendingSince: string;
  proofOfWork: string;
  discordUsername: string;
  dateAdded: string;
}

type FilterType = "all" | "pending" | "sent" | "accepted" | "rejected";

/* ── Main Component ──────────────────────────────────────────────────────── */

export default function PaymentsDashboard() {
  useFonts();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<FilterType>("pending");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [batchResult, setBatchResult] = useState<{ batchId: string; reviewUrl: string } | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payments");
      const data = await res.json();
      const mapped: Payment[] = (data.records || []).map((r: {
        id: string;
        fields: {
          Name?: string;
          Email?: string;
          "Wallet Address"?: string;
          Amount?: string;
          "Purpose of Payment"?: string;
          Details?: string;
          Category?: string;
          Region?: string;
          Approver?: string;
          Analysis?: string;
          "WA Chars"?: boolean;
          Status?: string;
          "Payment Status"?: string;
          "Foundation Decision"?: string;
          "Rejection Reason"?: string;
          "Batch Id"?: string;
          "Status - Details"?: string;
          "Proof of Work"?: string;
          "Discord / Earn Username"?: string;
          "Date Added"?: string;
        };
      }) => ({
        id: r.id,
        name: r.fields["Name"] || "—",
        email: r.fields["Email"] || "",
        wallet: r.fields["Wallet Address"] || "",
        amount: r.fields["Amount"] || "—",
        purpose: r.fields["Purpose of Payment"] || "",
        details: r.fields["Details"] || "",
        category: r.fields["Category"] || "—",
        region: r.fields["Region"] || "—",
        approver: r.fields["Approver"] || "—",
        analysis: r.fields["Analysis"] || "Clear",
        waChars: r.fields["WA Chars"] ?? false,
        status: r.fields["Status"] || "",
        paymentStatus: r.fields["Payment Status"] || "Pending Review",
        foundationDecision: r.fields["Foundation Decision"] || "",
        rejectionReason: r.fields["Rejection Reason"] || "",
        batchId: r.fields["Batch Id"] || "",
        pendingSince: r.fields["Status - Details"] || "",
        proofOfWork: r.fields["Proof of Work"] || "",
        discordUsername: r.fields["Discord / Earn Username"] || "",
        dateAdded: r.fields["Date Added"] || "",
      }));
      setPayments(mapped);
    } catch {
      showToast("error", "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const filtered = payments.filter((p) => {
    if (filter === "pending" && p.paymentStatus !== "Pending Review" && p.paymentStatus !== "") return false;
    if (filter === "sent" && p.paymentStatus !== "Sent to Foundation") return false;
    if (filter === "accepted" && p.paymentStatus !== "Accepted") return false;
    if (filter === "rejected" && p.paymentStatus !== "Rejected") return false;
    if (dateFrom || dateTo) {
      const added = p.dateAdded ? new Date(p.dateAdded) : null;
      if (!added) return false;
      if (dateFrom && added < new Date(dateFrom)) return false;
      if (dateTo && added > new Date(dateTo + "T23:59:59")) return false;
    }
    return true;
  });

  const pendingPayments = payments.filter((p) => !p.paymentStatus || p.paymentStatus === "Pending Review");
  const alertCount = pendingPayments.filter((p) => p.analysis === "Alert").length;
  const totalPendingUSDC = pendingPayments.reduce((sum, p) => {
    const match = p.amount.match(/[\d,]+/);
    return sum + (match ? parseInt(match[0].replace(/,/g, "")) : 0);
  }, 0);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const pendingIds = filtered
      .filter((p) => !p.paymentStatus || p.paymentStatus === "Pending Review")
      .filter((p) => p.analysis !== "Alert")
      .map((p) => p.id);
    setSelected(new Set(pendingIds));
  };

  const clearAll = () => setSelected(new Set());

  const sendBatch = async () => {
    if (selected.size === 0) return;
    setSending(true);
    try {
      const selectedPayments = payments.filter((p) => selected.has(p.id));
      const res = await fetch("/api/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordIds: Array.from(selected),
          records: selectedPayments.map((p) => ({
            name: p.name,
            amount: p.amount,
            wallet: p.wallet,
            purpose: p.purpose,
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBatchResult({ batchId: data.batchId, reviewUrl: data.reviewUrl });
        showToast("success", `Batch ${data.batchId} sent to foundation.`);
        setSelected(new Set());
        await loadPayments();
      } else {
        showToast("error", data.error || "Failed to send batch");
      }
    } catch {
      showToast("error", "Network error. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const isSelectable = (p: Payment) => !p.paymentStatus || p.paymentStatus === "Pending Review";

  const filterCounts = {
    all: payments.length,
    pending: payments.filter((p) => !p.paymentStatus || p.paymentStatus === "Pending Review").length,
    sent: payments.filter((p) => p.paymentStatus === "Sent to Foundation").length,
    accepted: payments.filter((p) => p.paymentStatus === "Accepted").length,
    rejected: payments.filter((p) => p.paymentStatus === "Rejected").length,
  };

  const getStatusStyle = (s: string) => {
    if (!s || s === "Pending Review") return { color: clr.pending.text, bg: clr.pending.bg, border: clr.pending.border, label: "Pending" };
    if (s === "Sent to Foundation") return { color: clr.sent.text, bg: clr.sent.bg, border: clr.sent.border, label: "Sent" };
    if (s === "Accepted") return { color: clr.accept.text, bg: clr.accept.bg, border: clr.accept.border, label: "Accepted" };
    if (s === "Rejected") return { color: clr.reject.text, bg: clr.reject.bg, border: clr.reject.border, label: "Rejected" };
    return { color: "rgba(0,0,0,0.4)", bg: "transparent", border: "rgba(0,0,0,0.1)", label: s };
  };

  const filterMeta: Record<FilterType, { label: string; color: string }> = {
    all: { label: "All", color: "rgba(0,0,0,0.7)" },
    pending: { label: "Pending", color: clr.pending.text },
    sent: { label: "Sent", color: clr.sent.text },
    accepted: { label: "Accepted", color: clr.accept.text },
    rejected: { label: "Rejected", color: clr.reject.text },
  };

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: font.body }}>
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 text-[13px] font-medium tracking-wide shadow-lg"
          style={{
            backgroundColor: toast.type === "success" ? clr.accept.dot : clr.reject.dot,
            color: "#fff",
          }}
        >
          {toast.type === "success" ? <Check className="w-4 h-4" strokeWidth={2} /> : <X className="w-4 h-4" strokeWidth={2} />}
          {toast.message}
        </div>
      )}

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
                Payments <span className="italic">Dashboard</span>
              </h1>
              <p className="text-[11px] text-black/30 tracking-wide mt-0.5">
                Superteam India
              </p>
            </div>
          </div>
          <button
            onClick={loadPayments}
            className="flex items-center gap-2 text-[11px] font-medium tracking-[0.1em] uppercase text-black/35 hover:text-black/60 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
            Refresh
          </button>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-8 py-10">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-[1px] bg-black/[0.06] mb-10">
          {[
            { label: "Awaiting Review", value: filterCounts.pending, color: clr.pending.text },
            { label: "Pending USDC", value: `$${totalPendingUSDC.toLocaleString()}`, color: "rgba(0,0,0,0.8)" },
            { label: "Flagged", value: alertCount, color: clr.pending.text },
            { label: "Accepted", value: filterCounts.accepted, color: clr.accept.text },
          ].map((stat) => (
            <div key={stat.label} className="bg-white p-6">
              <div
                style={{ fontFamily: font.display, color: typeof stat.value === "number" && stat.value > 0 ? stat.color : typeof stat.value === "string" ? stat.color : undefined }}
                className={`text-[32px] leading-none ${typeof stat.value === "number" && stat.value === 0 ? "text-black/15" : ""}`}
              >
                {stat.value}
              </div>
              <div
                className="text-[10px] font-medium tracking-[0.15em] uppercase mt-2"
                style={{ color: typeof stat.value === "number" && stat.value > 0 ? stat.color : undefined, opacity: (typeof stat.value === "number" && stat.value > 0) || typeof stat.value === "string" ? 0.6 : 0.3 }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Batch Result Banner */}
        {batchResult && (
          <div className="mb-8 border border-black/[0.06] px-6 py-4 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: clr.accept.dot }}>
                <Check className="w-3 h-3 text-white" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-[13px] font-medium text-black tracking-wide">
                  Batch <span style={{ fontFamily: font.mono }}>{batchResult.batchId}</span> sent to foundation
                </p>
                <p className="text-[11px] text-black/30 mt-1 tracking-wide">
                  Review link:{" "}
                  <a href={batchResult.reviewUrl} target="_blank" rel="noopener noreferrer" style={{ fontFamily: font.mono }} className="text-black/50 hover:text-black underline underline-offset-2">
                    {batchResult.reviewUrl}
                  </a>
                </p>
              </div>
            </div>
            <button onClick={() => setBatchResult(null)} className="text-black/20 hover:text-black/50 text-lg leading-none transition-colors">
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        )}

        {/* Table container */}
        <div className="border border-black/[0.06]">
          {/* Filter tabs + actions */}
          <div className="px-6 py-4 border-b border-black/[0.06] flex items-center justify-between gap-4">
            <div className="flex items-center gap-1">
              {(["pending", "sent", "accepted", "rejected", "all"] as FilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => { setFilter(f); setSelected(new Set()); }}
                  className="px-3 py-1.5 text-[11px] font-medium tracking-[0.08em] uppercase transition-all duration-200"
                  style={{
                    backgroundColor: filter === f ? "black" : "transparent",
                    color: filter === f ? "white" : filterMeta[f].color,
                    opacity: filter === f ? 1 : 0.6,
                  }}
                >
                  {filterMeta[f].label}
                  <span style={{ opacity: 0.5 }} className="ml-1">
                    {filterCounts[f]}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {filter === "pending" && (
                <>
                  <button
                    onClick={selectAll}
                    className="text-[11px] font-medium tracking-[0.08em] uppercase transition-colors hover:opacity-80 px-3 py-1.5"
                    style={{ color: clr.accept.text, backgroundColor: clr.accept.bg }}
                  >
                    Select safe ({filtered.filter((p) => isSelectable(p) && p.analysis !== "Alert").length})
                  </button>
                  <button
                    onClick={clearAll}
                    className="text-[11px] font-medium tracking-[0.08em] uppercase text-black/30 hover:text-black/60 transition-colors px-3 py-1.5"
                  >
                    Clear
                  </button>
                </>
              )}
              {selected.size > 0 && (
                <button
                  onClick={sendBatch}
                  disabled={sending}
                  className="flex items-center gap-2 bg-black hover:bg-black/85 disabled:bg-black/20 text-white text-[11px] font-medium tracking-[0.08em] uppercase px-5 py-2.5 transition-all duration-200"
                >
                  {sending ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />Sending...</>
                  ) : (
                    <><Send className="w-3.5 h-3.5" strokeWidth={1.5} />Send {selected.size} to Foundation</>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Date filter */}
          <div className="px-6 py-3 border-b border-black/[0.06] bg-black/[0.01] flex items-center gap-4">
            <span className="text-[10px] font-medium tracking-[0.15em] uppercase text-black/30">
              Date Added
            </span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{ fontFamily: font.mono }}
                className="text-[11px] border border-black/[0.08] px-3 py-1.5 text-black/60 bg-white focus:outline-none focus:border-black/20 transition-colors"
              />
              <span className="text-[10px] text-black/20">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={{ fontFamily: font.mono }}
                className="text-[11px] border border-black/[0.08] px-3 py-1.5 text-black/60 bg-white focus:outline-none focus:border-black/20 transition-colors"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(""); setDateTo(""); }}
                  className="text-[10px] text-black/25 hover:text-black/50 tracking-wide transition-colors ml-1"
                >
                  Clear
                </button>
              )}
            </div>
            {(dateFrom || dateTo) && (
              <span className="text-[11px] text-black/40 tracking-wide ml-auto">
                {filtered.length} result{filtered.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center gap-4">
                <div className="w-6 h-6 border-[1.5px] border-black/10 border-t-black/60 rounded-full animate-spin" />
                <p className="text-[12px] text-black/30 tracking-wide">Loading payments</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24">
              <Clock className="w-6 h-6 text-black/10 mb-3" strokeWidth={1.5} />
              <p className="text-[13px] text-black/25 tracking-wide">No payments in this category</p>
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-black/[0.06]">
                  <th className="px-6 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      className="rounded-sm border-black/20 accent-black"
                      checked={selected.size > 0 && filtered.filter(isSelectable).every((p) => selected.has(p.id))}
                      onChange={() => {
                        const selectableIds = filtered.filter(isSelectable).map((p) => p.id);
                        if (selectableIds.every((id) => selected.has(id))) clearAll();
                        else setSelected(new Set(selectableIds));
                      }}
                    />
                  </th>
                  {["Recipient", "Amount", "Project", "Region", "Category", "Flags", "Status", ""].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[9px] font-medium tracking-[0.15em] uppercase text-black/30"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const ss = getStatusStyle(p.paymentStatus);
                  const isExpanded = expandedRow === p.id;

                  return (
                    <>
                      <tr
                        key={p.id}
                        className="border-b border-black/[0.04] transition-colors hover:bg-black/[0.01]"
                        style={{
                          backgroundColor: selected.has(p.id) ? "rgba(0,0,0,0.02)" : undefined,
                          borderLeftWidth: p.analysis === "Alert" ? "2px" : undefined,
                          borderLeftColor: p.analysis === "Alert" ? clr.pending.dot : undefined,
                        }}
                      >
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            className="rounded-sm border-black/20 accent-black"
                            checked={selected.has(p.id)}
                            disabled={!isSelectable(p)}
                            onChange={() => toggleSelect(p.id)}
                          />
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-medium text-black">{p.name}</div>
                          <div className="text-[11px] text-black/25 mt-0.5">{p.discordUsername || p.email}</div>
                        </td>
                        <td className="px-4 py-4">
                          <span style={{ fontFamily: font.display }} className="text-[16px] text-black">
                            {p.amount}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="max-w-[180px] truncate text-black/50" title={p.details}>
                            {p.details}
                          </div>
                          {p.pendingSince && (
                            <div className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: clr.pending.text, opacity: 0.7 }}>
                              <Clock className="w-2.5 h-2.5" strokeWidth={1.5} />
                              {p.pendingSince}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span className="flex items-center gap-1.5 text-[11px] text-black/30 tracking-wide">
                            <Globe className="w-3 h-3" strokeWidth={1.5} />
                            {p.region}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="flex items-center gap-1.5 text-[11px] text-black/30 tracking-wide">
                            <Tag className="w-3 h-3" strokeWidth={1.5} />
                            {p.category}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1.5">
                            {p.analysis === "Alert" && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium tracking-wide"
                                style={{ color: clr.pending.text, backgroundColor: clr.pending.bg }}
                              >
                                <AlertTriangle className="w-2.5 h-2.5" strokeWidth={1.5} />
                                Alert
                              </span>
                            )}
                            {!p.waChars && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium tracking-wide"
                                style={{ color: clr.reject.text, backgroundColor: clr.reject.bg }}
                              >
                                <X className="w-2.5 h-2.5" strokeWidth={2} />
                                Wallet
                              </span>
                            )}
                            {p.analysis !== "Alert" && p.waChars && (
                              <span className="text-[11px] text-black/10">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium tracking-[0.08em] uppercase"
                            style={{ color: ss.color, backgroundColor: ss.bg }}
                          >
                            {ss.label}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <button
                            onClick={() => setExpandedRow(isExpanded ? null : p.id)}
                            className="text-black/20 hover:text-black/50 p-1 transition-colors"
                          >
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" strokeWidth={1.5} /> : <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.5} />}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded row */}
                      {isExpanded && (
                        <tr key={`${p.id}-expanded`} className="border-b border-black/[0.04]" style={{ backgroundColor: "rgba(0,0,0,0.015)" }}>
                          <td colSpan={9} className="px-6 py-5">
                            <div className="grid grid-cols-3 gap-8">
                              <div>
                                <p className="text-[9px] font-medium tracking-[0.15em] uppercase text-black/30 mb-2">Purpose</p>
                                <p className="text-[12px] text-black/50 leading-relaxed">{p.purpose || "—"}</p>
                              </div>
                              <div>
                                <p className="text-[9px] font-medium tracking-[0.15em] uppercase text-black/30 mb-2">Wallet Address</p>
                                <p style={{ fontFamily: font.mono }} className="text-[11px] text-black/40 break-all leading-relaxed">
                                  {p.wallet}
                                </p>
                                {p.proofOfWork && (
                                  <a
                                    href={p.proofOfWork}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] text-black/40 hover:text-black/70 mt-2 transition-colors tracking-wide"
                                  >
                                    <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
                                    Proof of Work
                                  </a>
                                )}
                              </div>
                              <div>
                                <p className="text-[9px] font-medium tracking-[0.15em] uppercase text-black/30 mb-2">Details</p>
                                <div className="space-y-1.5 text-[11px] text-black/40">
                                  <div><span className="text-black/25">Approver:</span> {p.approver}</div>
                                  <div><span className="text-black/25">Email:</span> {p.email}</div>
                                  {p.dateAdded && (
                                    <div>
                                      <span className="text-black/25">Date Added:</span>{" "}
                                      {new Date(p.dateAdded).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                                    </div>
                                  )}
                                  {p.batchId && (
                                    <div>
                                      <span className="text-black/25">Batch:</span>{" "}
                                      <span style={{ fontFamily: font.mono }}>{p.batchId}</span>
                                    </div>
                                  )}
                                  {p.rejectionReason && (
                                    <div
                                      className="mt-2 p-3 text-[12px]"
                                      style={{ backgroundColor: clr.reject.bg, color: clr.reject.text, border: `1px solid ${clr.reject.border}` }}
                                    >
                                      <span className="font-medium">Rejection:</span> {p.rejectionReason}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer note */}
        <p className="text-[11px] text-center text-black/20 mt-5 tracking-wide">
          Payments marked <span style={{ color: clr.pending.text }} className="font-medium">Alert</span> are automatically excluded from batch selection
        </p>
      </div>
    </div>
  );
}
