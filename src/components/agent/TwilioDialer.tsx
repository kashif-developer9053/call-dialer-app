"use client";

import { useEffect, useState, useRef } from "react";
import { Phone, PhoneOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import toast from "react-hot-toast";

// Import Twilio Device SDK
declare global {
  interface Window {
    Twilio: any;
  }
}

interface TwilioDialerProps {
  leadId: string;
  phoneNumber: string;
  onCallStart?: () => void;
  onCallEnd?: () => void;
}

export default function TwilioDialer({
  leadId,
  phoneNumber,
  onCallStart,
  onCallEnd,
}: TwilioDialerProps) {
  const [device, setDevice] = useState<any>(null);
  const [connection, setConnection] = useState<any>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Load Twilio SDK
    const script = document.createElement("script");
    script.src = "https://sdk.twilio.com/js/client/releases/1.14.1/twilio.min.js";
    script.async = true;
    script.onload = initializeDevice;
    document.body.appendChild(script);

    return () => {
      if (device) {
        device.destroy();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const initializeDevice = async () => {
    try {
      // Get Twilio token
      const response = await fetch("/api/twilio/token");
      const data = await response.json();

      if (!data.token) {
        throw new Error("Failed to get token");
      }

      // Initialize Twilio Device
      const twilioDevice = new window.Twilio.Device(data.token);

      twilioDevice.on("ready", () => {
        console.log("Twilio Device is ready");
        toast.success("Dialer ready!");
      });

      twilioDevice.on("error", (error: any) => {
        console.error("Twilio Device error:", error);
        toast.error("Dialer error: " + error.message);
      });

      twilioDevice.on("connect", (conn: any) => {
        console.log("Call connected");
        setConnection(conn);
        setIsCalling(true);
        startTimer();
        onCallStart?.();
      });

      twilioDevice.on("disconnect", () => {
        console.log("Call disconnected");
        setConnection(null);
        setIsCalling(false);
        stopTimer();
        onCallEnd?.();
      });

      setDevice(twilioDevice);
    } catch (error: any) {
      console.error("Device initialization error:", error);
      toast.error("Failed to initialize dialer");
    }
  };

  const startTimer = () => {
    setCallDuration(0);
    timerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleCall = async () => {
    if (!device) {
      toast.error("Dialer not ready");
      return;
    }

    try {
      // Log call in database
      await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          status: "initiated",
        }),
      });

      // Make call
      const conn = await device.connect({
        To: phoneNumber,
      });

      setConnection(conn);
      toast.success("Calling...");
    } catch (error: any) {
      console.error("Call error:", error);
      toast.error("Failed to make call");
    }
  };

  const handleHangup = () => {
    if (connection) {
      connection.disconnect();
    }
  };

  const handleMute = () => {
    if (connection) {
      connection.mute(!isMuted);
      setIsMuted(!isMuted);
      toast.success(isMuted ? "Unmuted" : "Muted");
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Card className="border-2 border-purple-200">
      <CardContent className="pt-6">
        <div className="text-center space-y-4">
          {isCalling && (
            <div className="text-2xl font-mono font-bold text-purple-600">
              {formatDuration(callDuration)}
            </div>
          )}

          <div className="flex justify-center gap-4">
            {!isCalling ? (
              <Button
                onClick={handleCall}
                disabled={!device}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 w-16 h-16 rounded-full"
              >
                <Phone className="h-6 w-6" />
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleMute}
                  variant="outline"
                  className="w-12 h-12 rounded-full"
                >
                  {isMuted ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </Button>

                <Button
                  onClick={handleHangup}
                  className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 w-16 h-16 rounded-full"
                >
                  <PhoneOff className="h-6 w-6" />
                </Button>
              </>
            )}
          </div>

          {!device && (
            <p className="text-sm text-gray-500">Initializing dialer...</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}