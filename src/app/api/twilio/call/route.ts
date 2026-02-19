import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import twilio from "twilio";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { to, leadId, type } = await req.json();

    if (!to || !leadId) {
      return NextResponse.json(
        { error: "Missing 'to' or 'leadId' parameter" },
        { status: 400 }
      );
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      console.error("Missing Twilio configuration:", {
        accountSid: !!accountSid,
        authToken: !!authToken,
        fromNumber: !!fromNumber,
      });
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Initialize Twilio client
    const client = twilio(accountSid, authToken);

    console.log(`📞 Initiating ${type} call...`);
    console.log(`   From: ${fromNumber}`);
    console.log(`   To: ${to}`);
    console.log(`   Lead ID: ${leadId}`);

    // Create outgoing call - Direct connection without intermediary
    const call = await client.calls.create({
      from: fromNumber,
      to: to,
      // Simple connection - the called party will hear the agent directly
      twiml: `<Response>
        <Gather timeout="60" numDigits="1" method="POST" action="/api/twilio/gather-response">
          <Say voice="woman" language="en-US">You are connected to an agent. Press any key or stay on the line.</Say>
        </Gather>
        <Say voice="woman" language="en-US">Thank you for calling.</Say>
      </Response>`,
    });

    console.log(`✅ Call successfully initiated!`);
    console.log(`   Call SID: ${call.sid}`);
    console.log(`   To: ${to}`);
    console.log(`   Status: ${call.status}`);

    return NextResponse.json({
      success: true,
      callSid: call.sid,
      status: call.status,
      message: `Call initiated to ${to} - ringing...`,
    });
  } catch (error) {
    console.error("❌ Call initiation error:", error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to initiate call: ${errorMsg}` },
      { status: 500 }
    );
  }
}
