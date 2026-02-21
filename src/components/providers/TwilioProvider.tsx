"use client";

import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { Device, Call } from "@twilio/voice-sdk";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface CallStatus {
  state: "idle" | "dialing" | "ringing" | "connected";
  direction: "outbound" | "inbound" | null;
  duration: number;
  callSid: string | null;
}

export interface InboundCall {
  callSid: string;
  conferenceName: string;
  callerNumber: string;
  receivedAt: string;
}

interface TwilioContextValue {
  callStatus: CallStatus;
  callEndReason: string | null; // e.g. "No answer", "Busy", "Declined"
  pendingInbound: InboundCall | null;
  available: boolean;
  deviceReady: boolean;
  micPermission: "granted" | "denied" | "unknown";
  micEnabled: boolean;
  error: string | null;
  initiateCall: (to: string, leadId?: string) => Promise<void>;
  acceptInbound: () => Promise<void>;
  dismissInbound: () => void;
  endCall: () => void;
  toggleMic: () => void;
  setAvailability: (online: boolean) => Promise<void>;
  clearError: () => void;
  runSetup: () => Promise<string>;
}

// ─── Twilio call status → human label ──────────────────────────────────────

const END_REASON: Record<string, string> = {
  busy:      "Line busy",
  "no-answer": "No answer",
  canceled:  "Call cancelled",
  failed:    "Call failed",
  completed: "Call ended",
};

const TERMINAL_STATUSES = new Set(["busy", "no-answer", "canceled", "failed", "completed"]);

// ─── Context ───────────────────────────────────────────────────────────────

const TwilioContext = createContext<TwilioContextValue | null>(null);

export function useTwilio(): TwilioContextValue {
  const ctx = useContext(TwilioContext);
  if (!ctx) throw new Error("useTwilio must be used within <TwilioProvider>");
  return ctx;
}

// ─── Provider ──────────────────────────────────────────────────────────────

export function TwilioProvider({ children }: { children: ReactNode }) {
  const [callStatus, setCallStatus] = useState<CallStatus>({
    state: "idle",
    direction: null,
    duration: 0,
    callSid: null,
  });
  const [callEndReason, setCallEndReason] = useState<string | null>(null);
  const [available, setAvailableState] = useState(false);
  const [deviceReady, setDeviceReady] = useState(false);
  const [micPermission, setMicPermission] = useState<"granted" | "denied" | "unknown">("unknown");
  const [micEnabled, setMicEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingInbound, setPendingInbound] = useState<InboundCall | null>(null);

  const deviceRef     = useRef<Device | null>(null);
  const callRef       = useRef<Call | null>(null);
  const durationRef   = useRef<NodeJS.Timeout | null>(null);
  const endReasonTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Outbound call tracking ─────────────────────────────────────────────────
  // For outbound: agent's browser leg fires "accept" almost immediately (server
  // dials it), but the customer phone is still ringing. We must NOT transition
  // to "connected" until we confirm the customer actually answered via Twilio's
  // call-status API. We poll that endpoint and react accordingly.

  const customerPollRef  = useRef<NodeJS.Timeout | null>(null);
  const customerSidRef   = useRef<string | null>(null);
  // True while we are waiting for the customer to answer (outbound pending)
  const outboundPendingRef = useRef(false);

  const clearError = useCallback(() => setError(null), []);

  // ── Reset to idle ──────────────────────────────────────────────────────────

  const resetToIdle = useCallback(() => {
    if (durationRef.current)  clearInterval(durationRef.current);
    if (customerPollRef.current) clearInterval(customerPollRef.current);
    customerPollRef.current  = null;
    customerSidRef.current   = null;
    outboundPendingRef.current = false;
    callRef.current = null;
    setCallStatus({ state: "idle", direction: null, duration: 0, callSid: null });
  }, []);

  // ── Show end reason briefly ───────────────────────────────────────────────

  const showEndReason = useCallback((reason: string) => {
    if (endReasonTimerRef.current) clearTimeout(endReasonTimerRef.current);
    setCallEndReason(reason);
    endReasonTimerRef.current = setTimeout(() => setCallEndReason(null), 4000);
  }, []);

  // ── Stop customer status polling ──────────────────────────────────────────

  const stopCustomerPoll = useCallback(() => {
    if (customerPollRef.current) {
      clearInterval(customerPollRef.current);
      customerPollRef.current = null;
    }
    customerSidRef.current = null;
    outboundPendingRef.current = false;
  }, []);

  // ── Start customer status polling ─────────────────────────────────────────

  const startCustomerPoll = useCallback(
    (callSid: string) => {
      stopCustomerPoll();
      customerSidRef.current   = callSid;
      outboundPendingRef.current = true;

      const poll = async () => {
        const sid = customerSidRef.current;
        if (!sid) return;

        try {
          const res = await fetch(`/api/twilio/call-status/${sid}`);
          if (!res.ok) return;
          const { status } = await res.json() as { status: string };

          if (status === "in-progress") {
            // Customer answered — now we're truly connected
            stopCustomerPoll();
            setCallStatus((prev) => ({ ...prev, state: "connected" }));
            durationRef.current = setInterval(() => {
              setCallStatus((prev) => ({ ...prev, duration: prev.duration + 1 }));
            }, 1000);

          } else if (TERMINAL_STATUSES.has(status) && status !== "in-progress") {
            // Customer declined / no-answer / busy / failed
            stopCustomerPoll();
            showEndReason(END_REASON[status] ?? "Call ended");
            // Hang up agent's conference leg too
            callRef.current?.disconnect();
            resetToIdle();
          }
          // For "ringing" / "queued" / "initiated" → keep polling
        } catch {
          // ignore transient network errors
        }
      };

      // Poll immediately, then every 2 s
      poll();
      customerPollRef.current = setInterval(poll, 2000);
    },
    [stopCustomerPoll, showEndReason, resetToIdle]
  );

  // ── Availability ──────────────────────────────────────────────────────────

  const setAvailability = useCallback(async (online: boolean) => {
    try {
      await fetch("/api/agents/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: online }),
      });
    } catch { /* ignore */ }
    setAvailableState(online);
  }, []);

  // ── Call event listeners ──────────────────────────────────────────────────
  // Key fix: for OUTBOUND calls, the agent's browser leg fires "accept" the
  // moment the server dials it — before the customer answers. So we must NOT
  // start the timer then. We stay in "ringing" and wait for the customer poll.
  // For INBOUND, the customer is already in the conference, so "accept" = connected.

  const attachCallListeners = useCallback(
    (call: Call, direction: "inbound" | "outbound") => {
      call.on("accept", () => {
        if (outboundPendingRef.current) {
          // Outbound: agent leg joined conference, customer still ringing — wait
          return;
        }
        // Inbound: customer is already in the conference → we're live
        setCallStatus((prev) => ({ ...prev, state: "connected", direction }));
        durationRef.current = setInterval(() => {
          setCallStatus((prev) => ({ ...prev, duration: prev.duration + 1 }));
        }, 1000);
      });

      call.on("disconnect", () => {
        stopCustomerPoll();
        resetToIdle();
      });

      call.on("cancel", () => {
        stopCustomerPoll();
        resetToIdle();
      });

      call.on("error", (err: Error) => {
        stopCustomerPoll();
        setError(`Call error: ${err.message}`);
        resetToIdle();
      });
    },
    [stopCustomerPoll, resetToIdle]
  );

  // ── Device initialization ─────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMicPermission("denied");
        setError("Microphone requires a secure connection (https:// or localhost).");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMicPermission("granted");
        stream.getTracks().forEach((t) => t.stop());
      } catch (err) {
        if ((err as Error).name === "NotAllowedError") {
          setMicPermission("denied");
          setError("Microphone permission denied. Enable it in browser settings.");
          return;
        }
        throw err;
      }

      const res = await fetch("/api/twilio/token");
      if (!res.ok) throw new Error("Failed to fetch Twilio token");
      const { token } = await res.json();

      const device = new Device(token, {
        codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
      });

      device.on("registered", async () => {
        setDeviceReady(true);
        await setAvailability(true);
      });

      device.on("error", (err: Error) => {
        console.error("[Twilio] Device error:", err);
        setError(`Device error: ${err.message}`);
      });

      // Server dials agent's browser into the conference
      // direction: "inbound" → customer is waiting in conference already
      device.on("incoming", (call: Call) => {
        callRef.current = call;
        attachCallListeners(call, "inbound");
        setCallStatus({ state: "ringing", direction: "inbound", duration: 0, callSid: null });
        call.accept();
      });

      await device.register();
      deviceRef.current = device;
    };

    init().catch((err) => {
      console.error("[Twilio] Init error:", err);
      setError(`Initialization failed: ${err.message}`);
    });

    return () => {
      fetch("/api/agents/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: false }),
      }).catch(() => {});
      stopCustomerPoll();
      if (durationRef.current) clearInterval(durationRef.current);
      if (endReasonTimerRef.current) clearTimeout(endReasonTimerRef.current);
      deviceRef.current?.destroy();
    };
  }, [attachCallListeners, setAvailability, stopCustomerPoll]);

  // ── Inbound queue polling ─────────────────────────────────────────────────

  useEffect(() => {
    if (!available || callStatus.state !== "idle") {
      setPendingInbound(null);
      return;
    }
    const poll = async () => {
      try {
        const res = await fetch("/api/twilio/inbound-poll");
        if (!res.ok) return;
        const { waitingCalls } = await res.json();
        setPendingInbound(waitingCalls.length > 0 ? waitingCalls[0] : null);
      } catch { /* ignore */ }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [available, callStatus.state]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const initiateCall = useCallback(
    async (to: string, leadId?: string) => {
      if (!deviceReady) { setError("Device not ready. Please wait."); return; }
      if (callStatus.state !== "idle") return;

      setError(null);
      setCallStatus((prev) => ({ ...prev, state: "dialing", direction: "outbound" }));

      try {
        const res = await fetch("/api/twilio/initiate-call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to, leadId }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to initiate call");
          setCallStatus({ state: "idle", direction: null, duration: 0, callSid: null });
          return;
        }

        // State = ringing (customer phone is now ringing)
        setCallStatus((prev) => ({
          ...prev,
          state: "ringing",
          callSid: data.customerCallSid,
        }));

        // Poll customer call status so we know when they answer / decline
        startCustomerPoll(data.customerCallSid);

      } catch (err) {
        setError(`Failed to start call: ${(err as Error).message}`);
        setCallStatus({ state: "idle", direction: null, duration: 0, callSid: null });
      }
    },
    [deviceReady, callStatus.state, startCustomerPoll]
  );

  const acceptInbound = useCallback(async () => {
    if (!pendingInbound) return;
    const call = pendingInbound;
    setPendingInbound(null);
    try {
      const res = await fetch("/api/twilio/claim-inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callSid: call.callSid }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Failed to claim call");
    } catch (err) {
      setError(`Failed to accept: ${(err as Error).message}`);
    }
  }, [pendingInbound]);

  const dismissInbound = useCallback(() => setPendingInbound(null), []);

  const endCall = useCallback(() => {
    stopCustomerPoll();
    callRef.current?.disconnect();
  }, [stopCustomerPoll]);

  const toggleMic = useCallback(() => {
    if (!callRef.current) return;
    const next = !micEnabled;
    callRef.current.mute(!next);
    setMicEnabled(next);
  }, [micEnabled]);

  const runSetup = useCallback(async (): Promise<string> => {
    try {
      const res = await fetch("/api/twilio/setup", { method: "POST" });
      const data = await res.json();
      return res.ok ? `✓ ${data.message}` : `✗ ${data.error}`;
    } catch (err) {
      return `✗ ${(err as Error).message}`;
    }
  }, []);

  return (
    <TwilioContext.Provider
      value={{
        callStatus,
        callEndReason,
        pendingInbound,
        available,
        deviceReady,
        micPermission,
        micEnabled,
        error,
        initiateCall,
        acceptInbound,
        dismissInbound,
        endCall,
        toggleMic,
        setAvailability,
        clearError,
        runSetup,
      }}
    >
      {children}
    </TwilioContext.Provider>
  );
}
