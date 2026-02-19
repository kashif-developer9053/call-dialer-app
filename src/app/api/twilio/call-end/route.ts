import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { callSid } = body;

    if (!callSid) {
      return NextResponse.json({ error: "Missing callSid" }, { status: 400 });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      console.error("Missing Twilio credentials");
      return NextResponse.json(
        { error: "Missing Twilio credentials" },
        { status: 500 }
      );
    }

    const client = twilio(accountSid, authToken);

    // End the call
    const call = await client.calls(callSid).update({ status: "completed" });

    console.log(`✅ Call ${callSid} ended successfully`);
    console.log(`Call status: ${call.status}`);

    return NextResponse.json({
      success: true,
      message: "Call terminated",
      callSid: call.sid,
      status: call.status,
    });
  } catch (error) {
    console.error("❌ Error ending call:", error);
    return NextResponse.json(
      { error: "Failed to end call", details: String(error) },
      { status: 500 }
    );
  }
}
