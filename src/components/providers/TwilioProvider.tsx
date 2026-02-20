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
  const [available, setAvailableState] = useState(false);
  const [deviceReady, setDeviceReady] = useState(false);
  const [micPermission, setMicPermission] = useState<"granted" | "denied" | "unknown">("unknown");
  const [micEnabled, setMicEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingInbound, setPendingInbound] = useState<InboundCall | null>(null);

  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const durationRef = useRef<NodeJS.Timeout | null>(null);

  const clearError = useCallback(() => setError(null), []);

  // ── Availability ──────────────────────────────────────────────────────────

  const setAvailability = useCallback(async (online: boolean) => {
    try {
      await fetch("/api/agents/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: online }),
      });
      setAvailableState(online);
    } catch {
      // network error — still update local state
      setAvailableState(online);
    }
  }, []);

  // ── Call event listeners ──────────────────────────────────────────────────

  const attachCallListeners = useCallback(
    (call: Call, direction: "inbound" | "outbound") => {
      call.on("accept", () => {
        setCallStatus((prev) => ({ ...prev, state: "connected", direction }));
        durationRef.current = setInterval(() => {
          setCallStatus((prev) => ({ ...prev, duration: prev.duration + 1 }));
        }, 1000);
      });

      call.on("disconnect", () => {
        if (durationRef.current) clearInterval(durationRef.current);
        callRef.current = null;
        setCallStatus({ state: "idle", direction: null, duration: 0, callSid: null });
      });

      call.on("cancel", () => {
        if (durationRef.current) clearInterval(durationRef.current);
        callRef.current = null;
        setCallStatus({ state: "idle", direction: null, duration: 0, callSid: null });
      });

      call.on("error", (err: Error) => setError(`Call error: ${err.message}`));
    },
    []
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

      // Server dials agent's browser into the claimed conference
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
      if (durationRef.current) clearInterval(durationRef.current);
      deviceRef.current?.destroy();
    };
  }, [attachCallListeners, setAvailability]);

  // ── Inbound polling ───────────────────────────────────────────────────────

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
      } catch {
        // silently ignore transient poll errors
      }
    };

    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [available, callStatus.state]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const initiateCall = useCallback(
    async (to: string, leadId?: string) => {
      if (!deviceReady) {
        setError("Device not ready. Please wait.");
        return;
      }
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
        setCallStatus((prev) => ({ ...prev, state: "ringing", callSid: data.customerCallSid }));
      } catch (err) {
        setError(`Failed to start call: ${(err as Error).message}`);
        setCallStatus({ state: "idle", direction: null, duration: 0, callSid: null });
      }
    },
    [deviceReady, callStatus.state]
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
      // device.on("incoming") fires once Twilio dials the agent's browser into the conference
    } catch (err) {
      setError(`Failed to accept: ${(err as Error).message}`);
    }
  }, [pendingInbound]);

  const dismissInbound = useCallback(() => setPendingInbound(null), []);

  const endCall = useCallback(() => callRef.current?.disconnect(), []);

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
