"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Check,
  X,
  AlertTriangle,
  Globe,
  Tag,
  Loader2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ArrowLeft,
  Clock,
  ArrowUpRight,
} from "lucide-react";

/* ── Google Fonts loader ──────────────────────────────────────────────────── */

const FONT_URL =
  "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap";

function FontLoader() {
  useEffect(() => {
    if (document.querySelector(`link[href="${FONT_URL}"]`)) return;
    const preconnect1 = document.createElement("link");
    preconnect1.rel = "preconnect";
    preconnect1.href = "https://fonts.googleapis.com";
    document.head.appendChild(preconnect1);
    const preconnect2 = document.createElement("link");
    preconnect2.rel = "preconnect";
    preconnect2.href = "https://fonts.gstatic.com";
    preconnect2.crossOrigin = "anonymous";
    document.head.appendChild(preconnect2);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONT_URL;
    document.head.appendChild(link);
  }, []);
  return null;
}

/* ── Design tokens ───────────────────────────────────────────────────────── */

const font = {
  display: "'Instrument Serif', Georgia, serif",
  body: "'Plus Jakarta Sans', system-ui, sans-serif",
  mono: "'IBM Plex Mono', monospace",
};

/* Subtle palette — muted, sophisticated */
const clr = {
  accept: { bg: "rgba(16,185,129,0.06)", border: "rgba(16,185,129,0.15)", text: "#047857", dot: "#10b981" },
  reject: { bg: "rgba(239,68,68,0.05)", border: "rgba(239,68,68,0.12)", text: "#b91c1c", dot: "#ef4444" },
  pending: { bg: "rgba(245,158,11,0.05)", border: "rgba(245,158,11,0.12)", text: "#92400e", dot: "#f59e0b" },
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
  analysis: string;
  proofOfWork: string;
}

type Decision = "accepted" | "rejected" | "pending";

interface PaymentDecision {
  decision: Decision;
  reason: string;
}

interface BatchSummary {
  batchId: string;
  token: string;
  totalPayments: number;
  totalAmount: number;
  accepted: number;
  rejected: number;
  pending: number;
  status: "pending" | "reviewed" | "partial";
}

/* ── Shared loader ────────────────────────────────────────────────────────── */

function FullScreenLoader() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="flex flex-col items-center gap-5">
        <div className="w-8 h-8 border-[1.5px] border-black/10 border-t-black/80 rounded-full animate-spin" />
        <p style={{ fontFamily: font.body }} className="text-[13px] text-black/40 tracking-wide">
          Loading
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  PASSWORD GATE                                                             *
 * ═══════════════════════════════════════════════════════════════════════════ */

function PasswordGate({ onAuth }: { onAuth: (password: string) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/foundation-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) onAuth(password);
      else setError("Invalid credentials");
    } catch {
      setError("Connection failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top bar */}
      <div className="px-8 py-6 flex items-center justify-between border-b border-black/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-[6px] h-[6px] rounded-full bg-black" />
          <span
            style={{ fontFamily: font.body }}
            className="text-[11px] font-medium tracking-[0.15em] uppercase text-black/50"
          >
            Solana Foundation
          </span>
        </div>
        <span
          style={{ fontFamily: font.mono }}
          className="text-[10px] text-black/25 tracking-wider"
        >
          PRIVATE ACCESS
        </span>
      </div>

      {/* Center content */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-[380px]">
          {/* Title */}
          <div className="mb-12 text-center">
            <h1
              style={{ fontFamily: font.display }}
              className="text-[42px] font-light text-black leading-[1.1] tracking-[-0.02em]"
            >
              Foundation
              <br />
              <span className="italic font-normal">Portal</span>
            </h1>
            <p
              style={{ fontFamily: font.body }}
              className="text-[13px] text-black/35 mt-4 tracking-wide"
            >
              Payment review & approval dashboard
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <div
                className={`border-b-[1.5px] transition-colors duration-300 ${
                  focused ? "border-black" : "border-black/15"
                }`}
              >
                <label
                  style={{ fontFamily: font.body }}
                  className="block text-[10px] font-medium tracking-[0.15em] uppercase text-black/40 mb-2"
                >
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder="Enter access key"
                  autoFocus
                  style={{ fontFamily: font.body }}
                  className="w-full bg-transparent text-[15px] text-black pb-3 focus:outline-none placeholder:text-black/20 tracking-wide"
                />
              </div>
            </div>

            {error && (
              <p
                style={{ fontFamily: font.body }}
                className="text-[12px] text-black/60 mt-3 tracking-wide"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!password || loading}
              style={{ fontFamily: font.body }}
              className="w-full mt-8 bg-black hover:bg-black/85 disabled:bg-black/20 text-white text-[13px] font-medium tracking-[0.08em] py-4 transition-all duration-300 flex items-center justify-center gap-3 group"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-[1.5px] border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Verifying</span>
                </>
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-300" />
                </>
              )}
            </button>
          </form>

          {/* Footer accent */}
          <div className="mt-16 flex items-center gap-3 justify-center">
            <div className="h-px w-8 bg-black/10" />
            <span
              style={{ fontFamily: font.mono }}
              className="text-[9px] text-black/20 tracking-[0.2em] uppercase"
            >
              Encrypted & Secure
            </span>
            <div className="h-px w-8 bg-black/10" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  BATCH DASHBOARD                                                           *
 * ═══════════════════════════════════════════════════════════════════════════ */

function BatchDashboard({
  password,
  onSelectBatch,
}: {
  password: string;
  onSelectBatch: (batchId: string, token: string) => void;
}) {
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBatches = useCallback(async () => {
    try {
      const res = await fetch("/api/foundation-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.batches) setBatches(data.batches);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [password]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const totalPayments = batches.reduce((s, b) => s + b.totalPayments, 0);
  const totalAccepted = batches.reduce((s, b) => s + b.accepted, 0);
  const totalRejected = batches.reduce((s, b) => s + b.rejected, 0);
  const totalPending = batches.reduce((s, b) => s + b.pending, 0);

  if (loading) return <FullScreenLoader />;

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: font.body }}>
      {/* Header */}
      <div className="border-b border-black/[0.06] sticky top-0 z-40 bg-white/95 backdrop-blur-sm">
        <div className="max-w-[960px] mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-[6px] h-[6px] rounded-full bg-black" />
            <div>
              <h1
                style={{ fontFamily: font.display }}
                className="text-[22px] font-normal text-black tracking-[-0.01em]"
              >
                Foundation <span className="italic">Dashboard</span>
              </h1>
            </div>
          </div>
          <span
            style={{ fontFamily: font.mono }}
            className="text-[10px] text-black/25 tracking-wider"
          >
            SOLANA FOUNDATION
          </span>
        </div>
      </div>

      <div className="max-w-[960px] mx-auto px-8 py-10">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-[1px] bg-black/[0.06] mb-12">
          {[
            { label: "Total", value: totalPayments, color: "text-black/80", labelColor: "text-black/35" },
            { label: "Accepted", value: totalAccepted, color: clr.accept.text, labelColor: clr.accept.text },
            { label: "Rejected", value: totalRejected, color: clr.reject.text, labelColor: clr.reject.text },
            { label: "Pending", value: totalPending, color: clr.pending.text, labelColor: clr.pending.text },
          ].map((stat) => (
            <div key={stat.label} className="bg-white p-6">
              <div
                style={{ fontFamily: font.display, color: stat.value > 0 ? stat.color : undefined }}
                className={`text-[36px] leading-none ${stat.value === 0 ? "text-black/20" : ""}`}
              >
                {stat.value}
              </div>
              <div
                className="text-[10px] font-medium tracking-[0.15em] uppercase mt-2"
                style={{ color: stat.value > 0 ? stat.labelColor : undefined, opacity: stat.value > 0 ? 0.7 : 0.3 }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Section title */}
        <div className="flex items-center justify-between mb-6">
          <h2
            style={{ fontFamily: font.display }}
            className="text-[18px] font-normal text-black/70 italic"
          >
            Payment Batches
          </h2>
          <span className="text-[11px] text-black/30 tracking-wide">
            {batches.length} batch{batches.length !== 1 ? "es" : ""}
          </span>
        </div>

        {/* Batches list */}
        {batches.length === 0 ? (
          <div className="border border-black/[0.06] py-20 text-center">
            <Clock className="w-5 h-5 text-black/15 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-[13px] text-black/30 tracking-wide">
              No batches have been submitted yet
            </p>
          </div>
        ) : (
          <div className="border-t border-black/[0.06]">
            {batches.map((batch, i) => (
              <div
                key={batch.batchId}
                onClick={() => onSelectBatch(batch.batchId, batch.token)}
                className="border-b border-black/[0.06] py-5 px-1 cursor-pointer group hover:bg-black/[0.015] transition-colors duration-300 flex items-center justify-between"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-center gap-6">
                  {/* Status dot */}
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor:
                        batch.status === "reviewed"
                          ? clr.accept.dot
                          : batch.status === "partial"
                          ? clr.pending.dot
                          : "rgba(0,0,0,0.1)",
                    }}
                  />

                  <div>
                    <div className="flex items-baseline gap-3">
                      <span
                        style={{ fontFamily: font.mono }}
                        className="text-[13px] font-medium text-black tracking-wide"
                      >
                        {batch.batchId}
                      </span>
                      <span className="text-[11px] text-black/25 tracking-wide">
                        {batch.totalPayments} payment{batch.totalPayments !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5">
                      <span
                        style={{ fontFamily: font.display }}
                        className="text-[16px] font-normal text-black/60"
                      >
                        {batch.totalAmount.toLocaleString()} <span className="text-[12px] text-black/30">USDC</span>
                      </span>
                      <span className="text-[10px] tracking-[0.12em] uppercase text-black/30">
                        {batch.accepted > 0 && `${batch.accepted} accepted`}
                        {batch.accepted > 0 && batch.rejected > 0 && " · "}
                        {batch.rejected > 0 && `${batch.rejected} rejected`}
                        {(batch.accepted > 0 || batch.rejected > 0) && batch.pending > 0 && " · "}
                        {batch.pending > 0 && `${batch.pending} pending`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-5">
                  <span
                    className="text-[10px] font-medium tracking-[0.12em] uppercase px-3 py-1.5"
                    style={{
                      color:
                        batch.status === "reviewed"
                          ? clr.accept.text
                          : batch.status === "partial"
                          ? clr.pending.text
                          : "rgba(0,0,0,0.7)",
                      backgroundColor:
                        batch.status === "reviewed"
                          ? clr.accept.bg
                          : batch.status === "partial"
                          ? clr.pending.bg
                          : "rgba(0,0,0,0.04)",
                    }}
                  >
                    {batch.status === "reviewed"
                      ? "Reviewed"
                      : batch.status === "partial"
                      ? "In Progress"
                      : "Needs Review"}
                  </span>
                  <ArrowUpRight
                    className="w-4 h-4 text-black/15 group-hover:text-black/50 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    strokeWidth={1.5}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  BATCH REVIEW                                                              *
 * ═══════════════════════════════════════════════════════════════════════════ */

function BatchReview({
  batchId,
  token,
  onBack,
}: {
  batchId: string;
  token: string;
  onBack: () => void;
}) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [decisions, setDecisions] = useState<Record<string, PaymentDecision>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "reviewed">("pending");

  const loadBatch = useCallback(async () => {
    try {
      const res = await fetch(`/api/foundation-review?batchId=${batchId}&token=${token}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load batch");
        return;
      }

      const mapped: Payment[] = (data.records || []).map(
        (r: {
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
            Analysis?: string;
            "Proof of Work"?: string;
            "Foundation Decision"?: string;
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
          analysis: r.fields["Analysis"] || "Clear",
          proofOfWork: r.fields["Proof of Work"] || "",
        })
      );

      const allDecided = (data.records || []).every(
        (r: { fields: { "Foundation Decision"?: string } }) =>
          r.fields["Foundation Decision"] === "Accepted" ||
          r.fields["Foundation Decision"] === "Rejected"
      );

      setPayments(mapped);

      if (allDecided && mapped.length > 0) {
        setAlreadyReviewed(true);
        const existingDecisions: Record<string, PaymentDecision> = {};
        (data.records || []).forEach(
          (r: { id: string; fields: { "Foundation Decision"?: string; "Rejection Reason"?: string } }) => {
            const dec = r.fields["Foundation Decision"];
            existingDecisions[r.id] = {
              decision: dec === "Accepted" ? "accepted" : dec === "Rejected" ? "rejected" : "pending",
              reason: r.fields["Rejection Reason"] || "",
            };
          }
        );
        setDecisions(existingDecisions);
      } else {
        const initialDecisions: Record<string, PaymentDecision> = {};
        (data.records || []).forEach(
          (r: { id: string; fields: { "Foundation Decision"?: string; "Rejection Reason"?: string } }) => {
            const dec = r.fields["Foundation Decision"];
            if (dec === "Accepted" || dec === "Rejected") {
              initialDecisions[r.id] = {
                decision: dec === "Accepted" ? "accepted" : "rejected",
                reason: r.fields["Rejection Reason"] || "",
              };
            } else {
              initialDecisions[r.id] = { decision: "pending", reason: "" };
            }
          }
        );
        setDecisions(initialDecisions);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [batchId, token]);

  useEffect(() => {
    loadBatch();
  }, [loadBatch]);

  const setDecisionFn = (id: string, decision: Decision) => {
    if (alreadyReviewed) return;
    setDecisions((prev) => ({ ...prev, [id]: { ...prev[id], decision } }));
  };

  const setReason = (id: string, reason: string) => {
    if (alreadyReviewed) return;
    setDecisions((prev) => ({ ...prev, [id]: { ...prev[id], reason } }));
  };

  const acceptAll = () => {
    if (alreadyReviewed) return;
    const next: Record<string, PaymentDecision> = {};
    payments.forEach((p) => {
      next[p.id] = { decision: "accepted", reason: "" };
    });
    setDecisions(next);
  };

  const pendingCount = Object.values(decisions).filter((d) => d.decision === "pending").length;
  const acceptedCount = Object.values(decisions).filter((d) => d.decision === "accepted").length;
  const rejectedCount = Object.values(decisions).filter((d) => d.decision === "rejected").length;

  const canSubmit =
    !alreadyReviewed &&
    pendingCount === 0 &&
    Object.entries(decisions).every(([, d]) => {
      if (d.decision === "rejected") return d.reason.trim().length > 0;
      return true;
    });

  const submitDecisions = async () => {
    setSubmitting(true);
    try {
      const decisionsArr = payments.map((p) => ({
        recordId: p.id,
        decision: decisions[p.id]?.decision || "pending",
        reason: decisions[p.id]?.reason || "",
        name: p.name,
        email: p.email,
        amount: p.amount,
        projectName: p.details,
        walletAddress: p.wallet,
      }));

      const res = await fetch("/api/foundation-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId, token, decisions: decisionsArr }),
      });

      const data = await res.json();
      if (data.success) setSubmitted(true);
      else setError(data.error || "Submission failed");
    } catch {
      setError("Network error during submission.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <FullScreenLoader />;

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center" style={{ fontFamily: font.body }}>
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 border border-black/10 rounded-full flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="w-5 h-5 text-black/40" strokeWidth={1.5} />
          </div>
          <h2 style={{ fontFamily: font.display }} className="text-[22px] font-normal text-black mb-2">
            Unable to load
          </h2>
          <p className="text-[13px] text-black/40 mb-6 tracking-wide">{error}</p>
          <button
            onClick={onBack}
            className="text-[12px] font-medium tracking-[0.1em] uppercase text-black/50 hover:text-black transition-colors"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center" style={{ fontFamily: font.body }}>
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: clr.accept.dot }}>
            <Check className="w-6 h-6 text-white" strokeWidth={2} />
          </div>
          <h2
            style={{ fontFamily: font.display }}
            className="text-[32px] font-light text-black mb-2 tracking-[-0.01em]"
          >
            Review <span className="italic">submitted</span>
          </h2>
          <p className="text-[13px] text-black/35 mb-8 tracking-wide">
            Batch{" "}
            <span style={{ fontFamily: font.mono }} className="text-black/50">
              {batchId}
            </span>{" "}
            has been recorded
          </p>

          <div className="flex gap-[1px] bg-black/[0.06] max-w-[240px] mx-auto mb-10">
            <div className="bg-white flex-1 py-4">
              <div style={{ fontFamily: font.display }} className="text-[28px] font-light text-black">
                {acceptedCount}
              </div>
              <div className="text-[9px] font-medium tracking-[0.15em] uppercase text-black/30 mt-1">
                Accepted
              </div>
            </div>
            <div className="bg-white flex-1 py-4">
              <div style={{ fontFamily: font.display }} className="text-[28px] font-light text-black/60">
                {rejectedCount}
              </div>
              <div className="text-[9px] font-medium tracking-[0.15em] uppercase text-black/30 mt-1">
                Rejected
              </div>
            </div>
          </div>

          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-[12px] font-medium tracking-[0.1em] uppercase text-black/40 hover:text-black transition-colors duration-300"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
            Dashboard
          </button>

          <p className="text-[11px] text-black/20 mt-8 tracking-wide">
            Recipients will receive email updates shortly
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: font.body }}>
      {/* Header */}
      <div className="border-b border-black/[0.06] sticky top-0 z-40 bg-white/95 backdrop-blur-sm">
        <div className="max-w-[960px] mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="w-8 h-8 flex items-center justify-center hover:bg-black/[0.03] transition-colors rounded-full"
            >
              <ArrowLeft className="w-4 h-4 text-black/40" strokeWidth={1.5} />
            </button>
            <div>
              <h1
                style={{ fontFamily: font.display }}
                className="text-[20px] font-normal text-black tracking-[-0.01em]"
              >
                {alreadyReviewed ? (
                  <>Batch <span className="italic">Archive</span></>
                ) : (
                  <>Payment <span className="italic">Review</span></>
                )}
              </h1>
              <p style={{ fontFamily: font.mono }} className="text-[10px] text-black/25 tracking-wider mt-0.5">
                {batchId}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-5 text-[11px] tracking-wide">
            {!alreadyReviewed && pendingCount > 0 && (
              <span style={{ color: clr.pending.text }} className="opacity-70">{pendingCount} remaining</span>
            )}
            <span style={{ color: clr.accept.text }} className="opacity-80">{acceptedCount} accepted</span>
            <span style={{ color: clr.reject.text }} className="opacity-60">{rejectedCount} rejected</span>
          </div>
        </div>
      </div>

      <div className="max-w-[960px] mx-auto px-8 py-8">
        {/* Tabs + Action bar */}
        {(() => {
          const pendingPayments = payments.filter((p) => (decisions[p.id]?.decision || "pending") === "pending");
          const reviewedPayments = payments.filter((p) => {
            const d = decisions[p.id]?.decision || "pending";
            return d === "accepted" || d === "rejected";
          });

          // Auto-switch to reviewed tab when no pending items
          const effectiveTab = alreadyReviewed ? "reviewed" : (pendingPayments.length === 0 && activeTab === "pending" ? "reviewed" : activeTab);

          return (
            <>
              {!alreadyReviewed && (
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-0 border border-black/[0.08]" style={{ borderRadius: "2px" }}>
                    <button
                      onClick={() => setActiveTab("pending")}
                      className="px-5 py-2.5 text-[11px] font-medium tracking-[0.1em] uppercase transition-all duration-200"
                      style={{
                        backgroundColor: effectiveTab === "pending" ? "#111" : "transparent",
                        color: effectiveTab === "pending" ? "#fff" : "rgba(0,0,0,0.35)",
                      }}
                    >
                      Pending
                      {pendingPayments.length > 0 && (
                        <span className="ml-2 opacity-60">{pendingPayments.length}</span>
                      )}
                    </button>
                    <div className="w-px h-4 bg-black/[0.08]" />
                    <button
                      onClick={() => setActiveTab("reviewed")}
                      className="px-5 py-2.5 text-[11px] font-medium tracking-[0.1em] uppercase transition-all duration-200"
                      style={{
                        backgroundColor: effectiveTab === "reviewed" ? "#111" : "transparent",
                        color: effectiveTab === "reviewed" ? "#fff" : "rgba(0,0,0,0.35)",
                      }}
                    >
                      Reviewed
                      {reviewedPayments.length > 0 && (
                        <span className="ml-2 opacity-60">{reviewedPayments.length}</span>
                      )}
                    </button>
                  </div>

                  {effectiveTab === "pending" && pendingPayments.length > 0 && (
                    <button
                      onClick={acceptAll}
                      className="text-[11px] font-medium tracking-[0.1em] uppercase px-4 py-2 transition-all duration-300 hover:opacity-80"
                      style={{ color: clr.accept.text, border: `1px solid ${clr.accept.border}`, backgroundColor: clr.accept.bg }}
                    >
                      Accept all
                    </button>
                  )}
                </div>
              )}

              {alreadyReviewed && (
                <div className="border border-black/[0.06] px-6 py-4 mb-8 flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: clr.accept.dot }}>
                    <Check className="w-3 h-3 text-white" strokeWidth={2.5} />
                  </div>
                  <p className="text-[13px] text-black/50 tracking-wide">
                    This batch has been reviewed. Decisions are shown below.
                  </p>
                </div>
              )}

              {/* Empty state for current tab */}
              {effectiveTab === "pending" && pendingPayments.length === 0 && !alreadyReviewed && (
                <div className="border border-black/[0.06] py-12 text-center mb-6">
                  <Check className="w-5 h-5 text-black/15 mx-auto mb-3" strokeWidth={1.5} />
                  <p className="text-[13px] text-black/30 tracking-wide">
                    All payments have been reviewed
                  </p>
                  <button
                    onClick={() => setActiveTab("reviewed")}
                    className="text-[11px] font-medium tracking-[0.1em] uppercase text-black/40 hover:text-black mt-3 transition-colors"
                  >
                    View reviewed payments
                  </button>
                </div>
              )}

              {effectiveTab === "reviewed" && reviewedPayments.length === 0 && !alreadyReviewed && (
                <div className="border border-black/[0.06] py-12 text-center mb-6">
                  <Clock className="w-5 h-5 text-black/15 mx-auto mb-3" strokeWidth={1.5} />
                  <p className="text-[13px] text-black/30 tracking-wide">
                    No decisions made yet
                  </p>
                </div>
              )}
            </>
          );
        })()}

        {/* Payment cards */}
        <div className="space-y-0 border-t border-black/[0.06]">
          {payments
            .filter((p) => {
              if (alreadyReviewed) return true;
              const d = decisions[p.id]?.decision || "pending";
              const pendingPayments = payments.filter((pp) => (decisions[pp.id]?.decision || "pending") === "pending");
              const effectiveTab = pendingPayments.length === 0 && activeTab === "pending" ? "reviewed" : activeTab;
              if (effectiveTab === "pending") return d === "pending";
              return d === "accepted" || d === "rejected";
            })
            .map((p, i) => {
            const dec = decisions[p.id] || { decision: "pending", reason: "" };
            const isExpanded = expandedRow === p.id;

            return (
              <div
                key={p.id}
                className="border-b transition-all duration-300"
                style={{
                  animationDelay: `${i * 40}ms`,
                  borderColor:
                    dec.decision === "accepted"
                      ? clr.accept.border
                      : dec.decision === "rejected"
                      ? clr.reject.border
                      : "rgba(0,0,0,0.06)",
                  backgroundColor:
                    dec.decision === "accepted"
                      ? clr.accept.bg
                      : dec.decision === "rejected"
                      ? clr.reject.bg
                      : "transparent",
                }}
              >
                <div className="py-5 px-1">
                  <div className="flex-1 min-w-0">
                    {/* Top row: name, amount, action buttons */}
                    <div className="flex items-start justify-between gap-6">
                      <div className="min-w-0 flex-1">
                        <h3
                          style={{ fontFamily: font.display }}
                          className="text-[20px] font-normal text-black tracking-[-0.01em]"
                        >
                          {p.name}
                        </h3>
                        <p className="text-[12px] text-black/35 mt-1 leading-relaxed max-w-lg truncate">
                          {p.details}
                        </p>
                      </div>

                      <div className="flex items-center gap-5 flex-shrink-0">
                        {/* Amount */}
                        <div className="text-right">
                          <div
                            style={{ fontFamily: font.display }}
                            className="text-[24px] font-light text-black tracking-tight"
                          >
                            {p.amount}
                          </div>
                          <div className="text-[9px] font-medium tracking-[0.15em] uppercase text-black/25 mt-0.5">
                            USDC
                          </div>
                        </div>

                        {/* Decision buttons — horizontal pair */}
                        <div className="flex items-center gap-0 border border-black/[0.08] overflow-hidden" style={{ borderRadius: "2px" }}>
                          <button
                            onClick={() => setDecisionFn(p.id, "accepted")}
                            disabled={alreadyReviewed}
                            className={`w-10 h-10 flex items-center justify-center transition-all duration-200 ${alreadyReviewed ? "cursor-default" : "hover:bg-black/[0.03]"}`}
                            style={{
                              backgroundColor: dec.decision === "accepted" ? clr.accept.dot : "transparent",
                              color: dec.decision === "accepted" ? "#fff" : "rgba(0,0,0,0.25)",
                            }}
                            title="Approve"
                          >
                            <Check className="w-4 h-4" strokeWidth={2} />
                          </button>
                          <div className="w-px h-5 bg-black/[0.08]" />
                          <button
                            onClick={() => setDecisionFn(p.id, "rejected")}
                            disabled={alreadyReviewed}
                            className={`w-10 h-10 flex items-center justify-center transition-all duration-200 ${alreadyReviewed ? "cursor-default" : "hover:bg-black/[0.03]"}`}
                            style={{
                              backgroundColor: dec.decision === "rejected" ? clr.reject.dot : "transparent",
                              color: dec.decision === "rejected" ? "#fff" : "rgba(0,0,0,0.25)",
                            }}
                            title="Reject"
                          >
                            <X className="w-4 h-4" strokeWidth={2} />
                          </button>
                        </div>
                      </div>
                    </div>

                      <div className="flex items-center gap-4 mt-3">
                        <span className="flex items-center gap-1.5 text-[11px] text-black/30 tracking-wide">
                          <Globe className="w-3 h-3" strokeWidth={1.5} />
                          {p.region}
                        </span>
                        <span className="flex items-center gap-1.5 text-[11px] text-black/30 tracking-wide">
                          <Tag className="w-3 h-3" strokeWidth={1.5} />
                          {p.category}
                        </span>
                        {p.analysis === "Alert" && (
                          <span
                            className="flex items-center gap-1.5 text-[11px] tracking-wide px-2 py-0.5"
                            style={{ color: clr.pending.text, backgroundColor: clr.pending.bg }}
                          >
                            <AlertTriangle className="w-3 h-3" strokeWidth={1.5} />
                            Flagged
                          </span>
                        )}
                        <button
                          onClick={() => setExpandedRow(isExpanded ? null : p.id)}
                          className="flex items-center gap-1 text-[11px] text-black/30 hover:text-black/60 ml-auto transition-colors tracking-wide"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3 h-3" strokeWidth={1.5} />
                              Less
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3" strokeWidth={1.5} />
                              Details
                            </>
                          )}
                        </button>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="mt-5 pt-5 border-t border-black/[0.06] grid grid-cols-2 gap-6">
                          <div>
                            <p className="text-[9px] font-medium tracking-[0.15em] uppercase text-black/30 mb-2">
                              Wallet Address
                            </p>
                            <p style={{ fontFamily: font.mono }} className="text-[11px] text-black/50 break-all leading-relaxed">
                              {p.wallet}
                            </p>
                          </div>
                          <div>
                            <p className="text-[9px] font-medium tracking-[0.15em] uppercase text-black/30 mb-2">
                              Purpose
                            </p>
                            <p className="text-[12px] text-black/50 leading-relaxed">{p.purpose}</p>
                          </div>
                        </div>
                      )}

                      {/* Rejection reason */}
                      {dec.decision === "rejected" && (
                        <div className="mt-5 pt-5 border-t border-black/[0.06]">
                          <p className="text-[9px] font-medium tracking-[0.15em] uppercase mb-3" style={{ color: clr.reject.text, opacity: 0.7 }}>
                            Rejection Reason
                            {!alreadyReviewed && (
                              <span style={{ opacity: 0.5 }} className="ml-1">(required)</span>
                            )}
                          </p>
                          {alreadyReviewed ? (
                            <p className="text-[13px] text-black/50">{dec.reason || "—"}</p>
                          ) : (
                            <>
                              <div className="flex gap-2 flex-wrap">
                                {[
                                  "Wallet address discrepancy",
                                  "Amount exceeds grant limit",
                                  "Insufficient proof of work",
                                  "Duplicate submission",
                                  "KYC verification pending",
                                ].map((preset) => (
                                  <button
                                    key={preset}
                                    onClick={() => setReason(p.id, preset)}
                                    className="text-[11px] tracking-wide px-3 py-2 border transition-all duration-200"
                                    style={{
                                      backgroundColor: dec.reason === preset ? clr.reject.dot : "white",
                                      color: dec.reason === preset ? "#fff" : "rgba(0,0,0,0.4)",
                                      borderColor: dec.reason === preset ? clr.reject.dot : "rgba(0,0,0,0.1)",
                                    }}
                                  >
                                    {preset}
                                  </button>
                                ))}
                              </div>
                              <textarea
                                value={dec.reason}
                                onChange={(e) => setReason(p.id, e.target.value)}
                                placeholder="Or type a custom reason..."
                                rows={2}
                                style={{ borderColor: clr.reject.border }}
                                className="mt-3 w-full text-[13px] border px-4 py-3 focus:outline-none resize-none text-black/70 placeholder:text-black/15 tracking-wide transition-colors"
                              />
                            </>
                          )}
                        </div>
                      )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Submit bar */}
        {!alreadyReviewed && (
          <div className="sticky bottom-0 mt-0 -mx-8 px-8 pb-6 pt-4 bg-gradient-to-t from-white via-white to-white/0">
            <div className="border border-black/[0.08] bg-white p-5 flex items-center justify-between">
              <div className="text-[12px] tracking-wide">
                {pendingCount > 0 ? (
                  <span className="text-black/40">
                    {pendingCount} payment{pendingCount !== 1 ? "s" : ""} still need a decision
                  </span>
                ) : (
                  <span className="text-black/60">All payments reviewed</span>
                )}
                {rejectedCount > 0 &&
                  Object.entries(decisions).some(
                    ([, d]) => d.decision === "rejected" && !d.reason.trim()
                  ) && (
                    <span className="text-black/30 ml-3">
                      — Some rejections need a reason
                    </span>
                  )}
              </div>
              <button
                onClick={submitDecisions}
                disabled={!canSubmit || submitting}
                className="flex items-center gap-3 bg-black hover:bg-black/85 disabled:bg-black/15 disabled:text-black/30 text-white text-[12px] font-medium tracking-[0.08em] px-8 py-3.5 transition-all duration-300"
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-[1.5px] border-white/20 border-t-white rounded-full animate-spin" />
                    Submitting
                  </>
                ) : (
                  <>
                    Submit Decisions
                    <span className="text-white/40">
                      {acceptedCount}+{rejectedCount}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  MAIN PAGE                                                                 *
 * ═══════════════════════════════════════════════════════════════════════════ */

function FoundationInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const urlBatchId = searchParams.get("batchId");
  const urlToken = searchParams.get("token");

  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [activeBatch, setActiveBatch] = useState<{ batchId: string; token: string } | null>(
    urlBatchId && urlToken ? { batchId: urlBatchId, token: urlToken } : null
  );

  // Magic link → skip auth
  if (activeBatch && !authed && urlBatchId && urlToken) {
    return (
      <BatchReview
        batchId={activeBatch.batchId}
        token={activeBatch.token}
        onBack={() => {
          router.push("/foundation");
          setActiveBatch(null);
        }}
      />
    );
  }

  if (!authed) {
    return (
      <PasswordGate
        onAuth={(pw) => {
          setPassword(pw);
          setAuthed(true);
        }}
      />
    );
  }

  if (activeBatch) {
    return (
      <BatchReview
        batchId={activeBatch.batchId}
        token={activeBatch.token}
        onBack={() => setActiveBatch(null)}
      />
    );
  }

  return (
    <BatchDashboard
      password={password}
      onSelectBatch={(batchId, token) => setActiveBatch({ batchId, token })}
    />
  );
}

export default function FoundationPage() {
  return (
    <>
      <FontLoader />
      <Suspense fallback={<FullScreenLoader />}>
        <FoundationInner />
      </Suspense>
    </>
  );
}
