import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

const VoiceResponse = twilio.twiml.VoiceResponse;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const to = formData.get("To") as string;

    const twiml = new VoiceResponse();

    // Dial the number
    const dial = twiml.dial({
      callerId: process.env.TWILIO_PHONE_NUMBER!,
      record: "record-from-answer", // Record the call
      recordingStatusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/recording`,
    });

    dial.number(to);

    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: {
        "Content-Type": "text/xml",
      },
    });
  } catch (error) {
    console.error("Voice response error:", error);
    return NextResponse.json(
      { error: "Failed to generate voice response" },
      { status: 500 }
    );
  }
}