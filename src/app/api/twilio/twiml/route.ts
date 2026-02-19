import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

const VoiceResponse = twilio.twiml.VoiceResponse;

export async function POST(req: NextRequest) {
  try {
    // Create TwiML response
    const twiml = new VoiceResponse();

    // Play a greeting
    twiml.say(
      {
        voice: "woman",
      },
      "Hello! This is a call from our system. Thank you for your time."
    );

    // Hang up
    twiml.hangup();

    console.log("✓ TwiML response generated successfully");

    return new NextResponse(twiml.toString(), {
      headers: { "Content-Type": "application/xml" },
    });
  } catch (error) {
    console.error("TwiML generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate TwiML" },
      { status: 500 }
    );
  }
}
