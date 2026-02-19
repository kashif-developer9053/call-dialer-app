"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Device, Call } from "@twilio/voice-sdk";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Phone,
  PhoneOff,
  PhoneIncoming,
  AlertCircle,
  Loader,
  CheckCircle,
  Mic,
  MicOff,
  Radio,
  PhoneMissed,
  Settings,
} from "lucide-react";

interface TwilioDialerProps {
  leadId: string;
  phoneNumber: string;
  onCallStart?: () => void;
  onCallEnd?: () => void;
}

interface CallStatus {
  state: "idle" | "dialing" | "ringing" | "connected";
  direction: "outbound" | "inbound" | null;
  duration: number;
  callSid: string | null;
}

interface InboundCall {
  callSid: string;
  conferenceName: string;
  callerNumber: string;
  receivedAt: string;
}

export default function TwilioDialer({
  leadId,
  phoneNumber,
  onCallStart,
  onCallEnd,
}: TwilioDialerProps) {
  const [callStatus, setCallStatus] = useState<CallStatus>({
    state: "idle",
    direction: null,
    duration: 0,
    callSid: null,
  });
  const [manualNumber, setManualNumber] = useState(phoneNumber);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [deviceReady, setDeviceReady] = useState(false);
  const [available, setAvailable] = useState(false);
  const [micPermission, setMicPermission] = useState<"granted" | "denied" | "unknown">("unknown");
  const [pendingInbound, setPendingInbound] = useState<InboundCall | null>(null);
  const [setupStatus, setSetupStatus] = useState<string | null>(null);

  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ─── Availability ─────────────────────────────────────────────────────────

  const setAvailability = useCallback(async (online: boolean) => {
    await fetch("/api/agents/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ available: online }),
    });
    setAvailable(online);
  }, []);

  // ─── Call lifecycle ────────────────────────────────────────────────────────

  const attachCallListeners = useCallback(
    (call: Call, direction: "inbound" | "outbound") => {
      call.on("accept", () => {
        setCallStatus((prev) => ({ ...prev, state: "connected", direction }));
        durationIntervalRef.current = setInterval(() => {
          setCallStatus((prev) => ({ ...prev, duration: prev.duration + 1 }));
        }, 1000);
        onCallStart?.();
      });

      call.on("disconnect", () => {
        if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
        callRef.current = null;
        setCallStatus({ state: "idle", direction: null, duration: 0, callSid: null });
        onCallEnd?.();
      });

      call.on("cancel", () => {
        if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
        callRef.current = null;
        setCallStatus({ state: "idle", direction: null, duration: 0, callSid: null });
      });

      call.on("error", (err) => setError(`Call error: ${err.message}`));
    },
    [onCallStart, onCallEnd]
  );

  // ─── Device init ───────────────────────────────────────────────────────────

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

      device.on("error", (err) => {
        console.error("Device error:", err);
        setError(`Device error: ${err.message}`);
      });

      // Server dials the agent's browser into the claimed conference
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
      console.error("Twilio init:", err);
      setError(`Initialization failed: ${err.message}`);
    });

    return () => {
      fetch("/api/agents/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: false }),
      }).catch(() => {});
      deviceRef.current?.destroy();
    };
  }, [attachCallListeners, setAvailability]);

  // ─── Inbound polling ───────────────────────────────────────────────────────
  // Polls Twilio REST API every 3s for callers waiting in a conference

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
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [available, callStatus.state]);

  // ─── Accept inbound call ───────────────────────────────────────────────────

  const acceptInbound = async () => {
    if (!pendingInbound) return;
    const call = pendingInbound;
    setPendingInbound(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/twilio/claim-inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callSid: call.callSid }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error);
      // device.on("incoming") fires once Twilio dials the agent's browser
    } catch (err) {
      setError(`Failed to accept: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Outbound dial ─────────────────────────────────────────────────────────

  const initiateCall = async (to: string) => {
    if (!deviceReady) { setError("Device not ready. Please wait."); return; }
    if (callStatus.state !== "idle") return;

    try {
      setIsLoading(true);
      setError(null);
      setCallStatus((prev) => ({ ...prev, state: "dialing", direction: "outbound" }));

      const res = await fetch("/api/twilio/initiate-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, leadId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to initiate call");

      setCallStatus((prev) => ({ ...prev, state: "ringing", callSid: data.customerCallSid }));
    } catch (err) {
      setError(`Failed to start call: ${(err as Error).message}`);
      setCallStatus({ state: "idle", direction: null, duration: 0, callSid: null });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndCall = () => callRef.current?.disconnect();

  const runSetup = async () => {
    setSetupStatus("Running...");
    try {
      const res = await fetch("/api/twilio/setup", { method: "POST" });
      const data = await res.json();
      setSetupStatus(res.ok ? `✓ ${data.message}` : `✗ ${data.error}`);
    } catch (err) {
      setSetupStatus(`✗ ${(err as Error).message}`);
    }
  };

  const toggleMic = () => {
    if (!callRef.current) return;
    const next = !micEnabled;
    callRef.current.mute(!next);
    setMicEnabled(next);
  };

  const isInCall = callStatus.state === "ringing" || callStatus.state === "connected";
  const canDial =
    deviceReady && micPermission === "granted" && callStatus.state === "idle" && !isLoading;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg">Live Voice Dialer</CardTitle>
        {deviceReady && (
          <button
            onClick={() => setAvailability(!available)}
            disabled={isInCall}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors disabled:opacity-40 ${
              available
                ? "bg-green-100 text-green-800 hover:bg-green-200"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            <Radio className="w-3 h-3" />
            {available ? "Online" : "Offline"}
          </button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">

        {/* One-time setup button — configures the Twilio phone number webhook */}
        <div className="flex items-center gap-2">
          <Button
            onClick={runSetup}
            variant="outline"
            size="sm"
            className="text-xs gap-1.5"
          >
            <Settings className="w-3 h-3" />
            Setup Inbound
          </Button>
          {setupStatus && (
            <span className={`text-xs ${setupStatus.startsWith("✓") ? "text-green-700" : "text-red-600"}`}>
              {setupStatus}
            </span>
          )}
        </div>

        {/* Status bar */}
        {micPermission === "denied" && (
          <Alert className="bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-800">
              Microphone permission denied. Enable it in browser settings.
            </AlertDescription>
          </Alert>
        )}
        {micPermission === "granted" && !deviceReady && (
          <Alert>
            <Loader className="h-4 w-4 animate-spin" />
            <AlertDescription>Connecting to Twilio...</AlertDescription>
          </Alert>
        )}
        {deviceReady && (
          <Alert className={available ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}>
            <CheckCircle className={`h-4 w-4 ${available ? "text-green-600" : "text-gray-400"}`} />
            <AlertDescription className={available ? "text-green-800" : "text-gray-500"}>
              {available
                ? "Online — receiving inbound calls."
                : "Offline — toggle Online to receive inbound calls."}
            </AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert className="bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {/* Inbound call notification */}
        {pendingInbound && callStatus.state === "idle" && (
          <div className="bg-blue-50 border-2 border-blue-400 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <PhoneIncoming className="w-5 h-5 text-blue-600 animate-bounce" />
              <div>
                <p className="font-bold text-blue-900">Incoming Call</p>
                <p className="text-sm text-blue-700 font-mono">{pendingInbound.callerNumber}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={acceptInbound}
                disabled={isLoading}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {isLoading
                  ? <><Loader className="w-4 h-4 mr-2 animate-spin" />Connecting...</>
                  : <><Phone className="w-4 h-4 mr-2" />Accept</>}
              </Button>
              <Button
                onClick={() => setPendingInbound(null)}
                disabled={isLoading}
                variant="outline"
                className="flex-1"
              >
                <PhoneMissed className="w-4 h-4 mr-2" />Ignore
              </Button>
            </div>
          </div>
        )}

        {/* Lead */}
        <div className="bg-gray-50 p-3 rounded border text-sm">
          <span className="text-gray-500">Lead: </span>
          <span className="font-mono">{leadId}</span>
        </div>

        {/* Auto dial */}
        <div className="space-y-2">
          <p className="text-sm font-semibold">Assigned Number</p>
          <div className="bg-blue-50 p-3 rounded border border-blue-200 font-mono text-blue-900">
            {phoneNumber}
          </div>
          <Button
            onClick={() => initiateCall(phoneNumber)}
            disabled={!canDial}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50"
          >
            {isLoading
              ? <><Loader className="w-4 h-4 mr-2 animate-spin" />Connecting...</>
              : <><Phone className="w-4 h-4 mr-2" />Auto Dial</>}
          </Button>
        </div>

        {/* Manual dial */}
        <div className="space-y-2">
          <p className="text-sm font-semibold">Manual Dial</p>
          <Input
            type="tel"
            placeholder="+1 (555) 000-0000"
            value={manualNumber}
            onChange={(e) => setManualNumber(e.target.value)}
            disabled={!canDial}
            className="font-mono"
          />
          <Button
            onClick={() => initiateCall(manualNumber)}
            disabled={!canDial || !manualNumber.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading
              ? <><Loader className="w-4 h-4 mr-2 animate-spin" />Connecting...</>
              : <><Phone className="w-4 h-4 mr-2" />Manual Dial</>}
          </Button>
        </div>

        {/* Call state */}
        {callStatus.state === "ringing" && (
          <div className="bg-yellow-50 p-4 rounded border-2 border-yellow-400 text-center animate-pulse">
            <p className="text-lg font-bold text-yellow-900">
              {callStatus.direction === "inbound" ? "Connecting..." : "Ringing..."}
            </p>
            <p className="text-xs text-yellow-600 mt-1">
              {callStatus.direction === "inbound"
                ? "Joining the call"
                : "Waiting for the other party to answer"}
            </p>
          </div>
        )}

        {callStatus.state === "connected" && (
          <div className="bg-green-50 p-4 rounded border-2 border-green-400 text-center">
            <p className="text-lg font-bold text-green-900">
              {callStatus.direction === "inbound" ? "Inbound" : "Outbound"} — Live
            </p>
            <p className="text-2xl font-mono text-green-700 mt-1">
              {String(Math.floor(callStatus.duration / 60)).padStart(2, "0")}:
              {String(callStatus.duration % 60).padStart(2, "0")}
            </p>
          </div>
        )}

        {/* In-call controls */}
        {isInCall && (
          <div className="flex gap-2">
            {callStatus.state === "connected" && (
              <Button
                onClick={toggleMic}
                className={`flex-1 ${
                  micEnabled ? "bg-gray-700 hover:bg-gray-800" : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {micEnabled
                  ? <><Mic className="w-4 h-4 mr-2" />Mute</>
                  : <><MicOff className="w-4 h-4 mr-2" />Unmute</>}
              </Button>
            )}
            <Button
              onClick={handleEndCall}
              className={`${callStatus.state === "connected" ? "flex-1" : "w-full"} bg-red-600 hover:bg-red-700`}
            >
              <PhoneOff className="w-4 h-4 mr-2" />End Call
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
