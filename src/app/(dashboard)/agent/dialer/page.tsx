"use client";

import { useEffect, useState } from "react";
import {
  Phone,
  Users,
  ChevronRight,
  ChevronLeft,
  Mail,
  Building2,
  CheckCircle,
  PhoneCall,
} from "lucide-react";
import toast from "react-hot-toast";
import TwilioDialer from "@/components/agent/TwilioDialer";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Lead {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  company?: string;
  status: string;
  notes?: string;
}

// ─── Disposition config ──────────────────────────────────────────────────────

const DISPOSITIONS = [
  { status: "interested",    label: "Interested",     dot: "bg-green-500",  text: "text-green-700",  ring: "ring-green-200",  bg: "hover:bg-green-50" },
  { status: "not_interested",label: "Not Interested", dot: "bg-gray-400",   text: "text-gray-600",   ring: "ring-gray-200",   bg: "hover:bg-gray-50" },
  { status: "callback",      label: "Callback",       dot: "bg-yellow-400", text: "text-yellow-700", ring: "ring-yellow-200", bg: "hover:bg-yellow-50" },
  { status: "dnc",           label: "Do Not Call",    dot: "bg-red-500",    text: "text-red-700",    ring: "ring-red-200",    bg: "hover:bg-red-50" },
  { status: "invalid",       label: "Invalid Number", dot: "bg-orange-400", text: "text-orange-700", ring: "ring-orange-200", bg: "hover:bg-orange-50" },
  { status: "converted",     label: "Converted",      dot: "bg-emerald-500",text: "text-emerald-700",ring: "ring-emerald-200",bg: "hover:bg-emerald-50" },
] as const;

const STATUS_COLORS: Record<string, string> = {
  new:          "bg-blue-100 text-blue-700",
  callback:     "bg-yellow-100 text-yellow-700",
  interested:   "bg-green-100 text-green-700",
  not_interested:"bg-gray-100 text-gray-600",
  dnc:          "bg-red-100 text-red-700",
  invalid:      "bg-orange-100 text-orange-700",
  converted:    "bg-emerald-100 text-emerald-700",
};

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AgentDialer() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [currentLeadIndex, setCurrentLeadIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  const currentLead = leads[currentLeadIndex] ?? null;
  const progress = leads.length > 0 ? Math.round((currentLeadIndex / leads.length) * 100) : 0;
  const remaining = leads.length - currentLeadIndex;

  const fetchLeads = async () => {
    try {
      const res = await fetch("/api/leads");
      const data = await res.json();
      const dialable = (data.leads as Lead[]).filter(
        (l) => l.status === "new" || l.status === "callback"
      );
      setLeads(dialable);
    } catch {
      toast.error("Failed to fetch leads");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeads(); }, []);
  useEffect(() => { setNotes(currentLead?.notes ?? ""); }, [currentLead]);

  const handleUpdateStatus = async (status: string) => {
    if (!currentLead) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/leads/${currentLead._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes }),
      });
      if (!res.ok) throw new Error("Failed to update lead");

      const label = DISPOSITIONS.find((d) => d.status === status)?.label ?? status;
      toast.success(`Marked as "${label}"`);

      if (currentLeadIndex < leads.length - 1) {
        setCurrentLeadIndex((i) => i + 1);
      } else {
        toast.success("All leads completed!");
        await fetchLeads();
        setCurrentLeadIndex(0);
      }
      setNotes("");
    } catch (err: any) {
      toast.error(err.message || "Failed to update lead");
    } finally {
      setUpdating(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-500">
          <span className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          Loading leads…
        </div>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────

  if (!currentLead) {
    return (
      <div className="flex flex-col items-center justify-center h-72 gap-4">
        <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-emerald-500" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">All caught up!</h2>
          <p className="text-gray-500 text-sm mt-1">You&apos;ve completed all assigned leads.</p>
        </div>
      </div>
    );
  }

  // ── Main view ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <PhoneCall className="w-6 h-6 text-purple-600" />
            Dialer
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Work through your assigned leads</p>
        </div>

        {/* Compact stats */}
        <div className="flex items-center gap-4 flex-wrap">
          <Stat icon={<Users className="w-4 h-4 text-blue-500" />}  label="Total"     value={leads.length} />
          <Stat icon={<Phone  className="w-4 h-4 text-green-500" />} label="Remaining" value={remaining} />
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm">
            <div className="text-right">
              <p className="text-xs text-gray-500">Progress</p>
              <p className="text-sm font-bold text-gray-900">{progress}%</p>
            </div>
            <div className="w-20 h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5 items-start">

        {/* ══════════════════════════ LEFT COLUMN ══════════════════════════ */}
        <div className="space-y-4">

          {/* Lead card */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

            {/* Card header — dark gradient */}
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
                  {initials(currentLead.name)}
                </div>
                <div>
                  <h2 className="text-white text-lg font-bold leading-tight">{currentLead.name}</h2>
                  <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mt-0.5 ${STATUS_COLORS[currentLead.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {currentLead.status.replace("_", " ")}
                  </span>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">
                  {currentLeadIndex + 1} / {leads.length}
                </span>
                <button
                  onClick={() => setCurrentLeadIndex((i) => Math.max(0, i - 1))}
                  disabled={currentLeadIndex === 0}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={() => setCurrentLeadIndex((i) => Math.min(leads.length - 1, i + 1))}
                  disabled={currentLeadIndex === leads.length - 1}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {/* Lead details grid */}
            <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoField
                icon={<Phone className="w-4 h-4 text-purple-500" />}
                label="Phone"
                value={currentLead.phone}
                mono
              />
              {currentLead.email && (
                <InfoField
                  icon={<Mail className="w-4 h-4 text-blue-500" />}
                  label="Email"
                  value={currentLead.email}
                />
              )}
              {currentLead.company && (
                <InfoField
                  icon={<Building2 className="w-4 h-4 text-gray-400" />}
                  label="Company"
                  value={currentLead.company}
                />
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Call Notes
            </label>
            <textarea
              placeholder="Type your notes about this call…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full px-3.5 py-3 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none resize-none transition-all text-gray-800 placeholder-gray-400"
            />
          </div>

          {/* Disposition */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">Call Outcome</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DISPOSITIONS.map((d) => (
                <button
                  key={d.status}
                  onClick={() => handleUpdateStatus(d.status)}
                  disabled={updating}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 ring-1 ring-transparent hover:ring-1 ${d.ring} ${d.bg} transition-all disabled:opacity-50 disabled:cursor-not-allowed text-left`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${d.dot}`} />
                  <span className={`text-sm font-medium ${d.text}`}>{d.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ══════════════════════════ RIGHT COLUMN ════════════════════════ */}
        <div className="xl:sticky xl:top-20">
          <TwilioDialer
            leadId={currentLead._id}
            phoneNumber={currentLead.phone}
            onCallStart={() => toast.success("Call connected")}
            onCallEnd={() => toast("Call ended", { icon: "📞" })}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm">
      {icon}
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-bold text-gray-900 leading-none">{value}</p>
      </div>
    </div>
  );
}

function InfoField({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] text-gray-400 uppercase tracking-wider">{label}</p>
        <p className={`text-sm font-semibold text-gray-900 truncate ${mono ? "font-mono" : ""}`}>
          {value}
        </p>
      </div>
    </div>
  );
}
