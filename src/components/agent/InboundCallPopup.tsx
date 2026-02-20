"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Phone, PhoneMissed, PhoneIncoming } from "lucide-react";
import { useTwilio } from "@/components/providers/TwilioProvider";

export default function InboundCallPopup() {
  const { data: session } = useSession();
  const { pendingInbound, callStatus, acceptInbound, dismissInbound } = useTwilio();
  const [accepting, setAccepting] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const isAgent = session?.user?.role === "agent";
  const show = isAgent && !!pendingInbound && callStatus.state === "idle";

  // Live elapsed timer since call arrived
  useEffect(() => {
    if (!pendingInbound) {
      setElapsed(0);
      return;
    }
    const start = new Date(pendingInbound.receivedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [pendingInbound]);

  if (!show) return null;

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await acceptInbound();
    } finally {
      setAccepting(false);
    }
  };

  const formatElapsed = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

      {/* Card */}
      <div className="relative z-10 flex flex-col items-center text-center bg-gray-950 border border-white/10 rounded-3xl shadow-2xl px-8 py-10 w-[340px] max-w-[90vw]">

        {/* Animated ring icon */}
        <div className="relative flex items-center justify-center mb-6">
          <span className="absolute w-32 h-32 rounded-full bg-green-500/10 animate-ping" />
          <span className="absolute w-24 h-24 rounded-full bg-green-500/20 animate-pulse" />
          <div className="relative w-20 h-20 rounded-full bg-green-600 shadow-lg shadow-green-900/60 flex items-center justify-center">
            <PhoneIncoming className="w-9 h-9 text-white" />
          </div>
        </div>

        {/* Labels */}
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Incoming Call</p>
        <p className="text-white text-3xl font-bold font-mono mb-1 tracking-wide">
          {pendingInbound?.callerNumber ?? "Unknown"}
        </p>
        <p className="text-gray-500 text-xs mb-8">
          Waiting {formatElapsed(elapsed)}
        </p>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-8">
          {/* Decline */}
          <button
            onClick={dismissInbound}
            disabled={accepting}
            className="flex flex-col items-center gap-2 group disabled:opacity-40"
          >
            <div className="w-16 h-16 rounded-full bg-red-600 group-hover:bg-red-700 transition-colors flex items-center justify-center shadow-lg">
              <PhoneMissed className="w-7 h-7 text-white" />
            </div>
            <span className="text-gray-400 text-xs">Decline</span>
          </button>

          {/* Accept */}
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="flex flex-col items-center gap-2 group disabled:opacity-40"
          >
            <div className="w-16 h-16 rounded-full bg-green-500 group-hover:bg-green-600 transition-colors flex items-center justify-center shadow-lg shadow-green-900/50">
              {accepting ? (
                <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Phone className="w-7 h-7 text-white" />
              )}
            </div>
            <span className="text-gray-300 text-xs">
              {accepting ? "Connecting…" : "Accept"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
