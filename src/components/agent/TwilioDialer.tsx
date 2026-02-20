"use client";

import { useState, useEffect, useRef } from "react";
import { Phone, PhoneOff, Mic, MicOff, Delete, Settings, Radio, AlertCircle } from "lucide-react";
import { useTwilio } from "@/components/providers/TwilioProvider";

// ─── Types ─────────────────────────────────────────────────────────────────

interface TwilioDialerProps {
  leadId?: string;
  phoneNumber?: string;
  onCallStart?: () => void;
  onCallEnd?: () => void;
}

// ─── Keypad layout ─────────────────────────────────────────────────────────

const ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "#"],
] as const;

// Sub-labels shown below each key
const SUB: Record<string, string> = {
  "1": "",    "2": "ABC",  "3": "DEF",
  "4": "GHI", "5": "JKL",  "6": "MNO",
  "7": "PQRS","8": "TUV",  "9": "WXYZ",
  "*": "",    "0": "",      "#": "",
};

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function TwilioDialer({
  leadId,
  phoneNumber,
  onCallStart,
  onCallEnd,
}: TwilioDialerProps) {
  const {
    callStatus,
    available,
    deviceReady,
    micPermission,
    micEnabled,
    error,
    initiateCall,
    endCall,
    toggleMic,
    setAvailability,
    clearError,
    runSetup,
  } = useTwilio();

  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [manualNumber, setManualNumber] = useState("");
  const [dialing, setDialing] = useState(false);
  const [setupMsg, setSetupMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fire onCallStart / onCallEnd callbacks on state transitions
  const prevStateRef = useRef(callStatus.state);
  const onCallStartRef = useRef(onCallStart);
  const onCallEndRef = useRef(onCallEnd);
  useEffect(() => { onCallStartRef.current = onCallStart; }, [onCallStart]);
  useEffect(() => { onCallEndRef.current = onCallEnd; }, [onCallEnd]);
  useEffect(() => {
    const prev = prevStateRef.current;
    const curr = callStatus.state;
    prevStateRef.current = curr;
    if (prev === "idle" && curr !== "idle") onCallStartRef.current?.();
    if (prev !== "idle" && curr === "idle") onCallEndRef.current?.();
  }, [callStatus.state]);

  const isInCall = callStatus.state === "ringing" || callStatus.state === "connected";
  const canDial = deviceReady && micPermission === "granted" && callStatus.state === "idle" && !dialing;

  const handleDial = async () => {
    const number = mode === "auto" ? phoneNumber : manualNumber;
    if (!number?.trim()) return;
    setDialing(true);
    try {
      await initiateCall(number.trim(), leadId);
    } finally {
      setDialing(false);
    }
  };

  // Append a character to the manual number and keep input focused
  const pressKey = (key: string) => {
    if (isInCall) return;
    setManualNumber((prev) => prev + key);
    inputRef.current?.focus();
  };

  const handleBackspace = () => {
    setManualNumber((prev) => prev.slice(0, -1));
    inputRef.current?.focus();
  };

  const handleSetup = async () => {
    setSetupMsg("Running…");
    const msg = await runSetup();
    setSetupMsg(msg);
    setTimeout(() => setSetupMsg(null), 7000);
  };

  return (
    <div className="bg-gray-950 text-white rounded-2xl overflow-hidden shadow-2xl border border-gray-800 w-full max-w-sm mx-auto select-none">

      {/* ── Header ── */}
      <div className="px-5 py-3.5 flex items-center justify-between border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${deviceReady ? "bg-green-400 animate-pulse" : "bg-gray-600"}`} />
          <span className="text-sm font-semibold text-gray-200">Voice Dialer</span>
        </div>
        <div className="flex items-center gap-2">
          {deviceReady && (
            <button
              onClick={() => setAvailability(!available)}
              disabled={isInCall}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full transition-all disabled:opacity-40 ${
                available
                  ? "bg-green-500/20 text-green-400 ring-1 ring-green-500/50"
                  : "bg-gray-800 text-gray-500"
              }`}
            >
              <Radio className="w-3 h-3" />
              {available ? "Online" : "Offline"}
            </button>
          )}
          <button
            onClick={handleSetup}
            className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-gray-800 transition-colors"
            title="Setup inbound webhook"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Setup message ── */}
      {setupMsg && (
        <div className={`px-5 py-2 text-xs text-center border-b border-gray-800 ${
          setupMsg.startsWith("✓") ? "text-green-400 bg-green-900/20" : "text-red-400 bg-red-900/20"
        }`}>
          {setupMsg}
        </div>
      )}

      {/* ── Error bar ── */}
      {error && (
        <div className="px-4 py-2.5 bg-red-950/60 border-b border-red-900/40 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <p className="text-xs text-red-300 flex-1">{error}</p>
          <button onClick={clearError} className="text-red-500 hover:text-red-300 text-sm leading-none">✕</button>
        </div>
      )}

      {/* ── Connecting spinner ── */}
      {!deviceReady && micPermission !== "denied" && !error && (
        <div className="px-5 py-2.5 flex items-center justify-center gap-2 border-b border-gray-800">
          <span className="w-3.5 h-3.5 border-2 border-gray-700 border-t-gray-400 rounded-full animate-spin" />
          <span className="text-xs text-gray-500">Connecting to Twilio…</span>
        </div>
      )}

      {/* ══════════════════════ IN-CALL OVERLAY ══════════════════════════ */}
      {isInCall ? (
        <div className="px-5 py-8 flex flex-col items-center gap-5">

          {callStatus.state === "ringing" ? (
            <div className="relative flex items-center justify-center">
              <span className="absolute w-24 h-24 rounded-full bg-blue-500/10 animate-ping" />
              <div className="relative w-16 h-16 rounded-full bg-blue-600/20 ring-4 ring-blue-500/40 flex items-center justify-center">
                <Phone className="w-7 h-7 text-blue-400" />
              </div>
            </div>
          ) : (
            <div className="relative flex items-center justify-center">
              <span className="absolute w-24 h-24 rounded-full bg-green-500/10 animate-pulse" />
              <div className="relative w-16 h-16 rounded-full bg-green-600/20 ring-4 ring-green-500/40 flex items-center justify-center">
                <Phone className="w-7 h-7 text-green-400" />
              </div>
            </div>
          )}

          {callStatus.state === "ringing" ? (
            <p className="text-gray-400 text-sm">
              {callStatus.direction === "inbound" ? "Connecting…" : "Ringing…"}
            </p>
          ) : (
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest text-green-500/70 mb-0.5">
                {callStatus.direction === "inbound" ? "Inbound" : "Outbound"} — Live
              </p>
              <p className="text-4xl font-mono font-bold text-white tracking-wider">
                {fmt(callStatus.duration)}
              </p>
            </div>
          )}

          <div className="flex items-center gap-5">
            {callStatus.state === "connected" && (
              <button
                onClick={toggleMic}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-md ${
                  micEnabled ? "bg-gray-700 hover:bg-gray-600" : "bg-red-600 hover:bg-red-500 ring-2 ring-red-500/40"
                }`}
              >
                {micEnabled ? <Mic className="w-6 h-6 text-white" /> : <MicOff className="w-6 h-6 text-white" />}
              </button>
            )}
            <button
              onClick={endCall}
              className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-all shadow-md shadow-red-900/50"
            >
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

      ) : (
        <>
          {/* ══════════════════════ MODE TOGGLE ══════════════════════════ */}
          <div className="px-5 pt-4">
            <div className="flex bg-gray-900 rounded-xl p-1 gap-1">
              {(["auto", "manual"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 text-sm py-2 rounded-lg font-medium transition-all ${
                    mode === m ? "bg-purple-600 text-white shadow-md" : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {m === "auto" ? "Auto Lead" : "Manual"}
                </button>
              ))}
            </div>
          </div>

          {/* ══════════════════════ AUTO LEAD MODE ═══════════════════════ */}
          {mode === "auto" && (
            <div className="px-5 py-4">
              {phoneNumber ? (
                <>
                  <div className="bg-gray-900 rounded-xl px-5 py-4 mb-4 text-center">
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Lead Number</p>
                    <p className="text-2xl font-mono font-semibold text-white tracking-wider">{phoneNumber}</p>
                    {leadId && <p className="text-[10px] text-gray-700 mt-1 truncate">ID: {leadId}</p>}
                  </div>
                  <DialButton loading={dialing} disabled={!canDial} onClick={handleDial} label="Dial Lead" />
                </>
              ) : (
                <div className="text-center py-10 space-y-1">
                  <p className="text-sm text-gray-600">No lead selected</p>
                  <p className="text-xs text-gray-700">Switch to Manual to dial a custom number</p>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════ MANUAL MODE ══════════════════════════ */}
          {mode === "manual" && (
            <div className="px-5 py-4 space-y-3">

              {/* Number input — editable + populated by keypad */}
              <div className="flex items-center gap-1 bg-gray-900 rounded-xl pl-4 pr-2 min-h-[54px]">
                <input
                  ref={inputRef}
                  type="tel"
                  value={manualNumber}
                  onChange={(e) => setManualNumber(e.target.value)}
                  placeholder="Enter number…"
                  className="flex-1 bg-transparent text-2xl font-mono text-white tracking-widest outline-none placeholder-gray-700 min-w-0"
                />
                {manualNumber && (
                  <button
                    onClick={handleBackspace}
                    className="p-2 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-gray-800 transition-colors"
                  >
                    <Delete className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Standard keypad: 1-9, *, 0, # */}
              <div className="grid grid-cols-3 gap-2">
                {ROWS.flat().map((key) => (
                  <KeyButton key={key} digit={key} sub={SUB[key]} onClick={() => pressKey(key)} />
                ))}
              </div>

              {/* Bottom action row: + button · Dial button · clear */}
              <div className="flex items-center gap-2">
                {/* + button */}
                <button
                  onClick={() => pressKey("+")}
                  className="w-12 h-12 rounded-xl bg-gray-800 hover:bg-gray-700 active:bg-gray-600 flex flex-col items-center justify-center transition-all shrink-0"
                >
                  <span className="text-xl font-semibold text-white leading-none">+</span>
                </button>

                {/* Dial */}
                <DialButton
                  loading={dialing}
                  disabled={!canDial || !manualNumber.trim()}
                  onClick={handleDial}
                  label="Dial"
                  className="flex-1"
                />

                {/* Clear all */}
                <button
                  onClick={() => setManualNumber("")}
                  disabled={!manualNumber}
                  className="w-12 h-12 rounded-xl bg-gray-800 hover:bg-gray-700 active:bg-gray-600 disabled:opacity-30 flex items-center justify-center transition-all shrink-0"
                  title="Clear"
                >
                  <span className="text-gray-400 text-xs font-medium">CLR</span>
                </button>
              </div>

            </div>
          )}
        </>
      )}

      <div className="h-1" />
    </div>
  );
}

// ─── Reusable key button ────────────────────────────────────────────────────

function KeyButton({
  digit,
  sub,
  onClick,
}: {
  digit: string;
  sub?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-gray-800 hover:bg-gray-700 active:bg-gray-600 active:scale-95 rounded-xl py-3 flex flex-col items-center gap-0.5 transition-all"
    >
      <span className="text-xl font-semibold text-white leading-none">{digit}</span>
      {sub ? (
        <span className="text-[9px] text-gray-500 tracking-widest">{sub}</span>
      ) : (
        <span className="text-[9px] text-transparent">·</span>
      )}
    </button>
  );
}

// ─── Dial button ────────────────────────────────────────────────────────────

function DialButton({
  loading,
  disabled,
  onClick,
  label,
  className = "w-full",
}: {
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`py-3.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-base flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-950/50 active:scale-[0.98] ${className}`}
    >
      {loading ? (
        <>
          <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Connecting…
        </>
      ) : (
        <>
          <Phone className="w-5 h-5" />
          {label}
        </>
      )}
    </button>
  );
}
