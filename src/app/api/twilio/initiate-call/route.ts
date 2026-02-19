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

    const { to, leadId } = await req.json();
    if (!to) {
      return NextResponse.json({ error: "Missing 'to' phone number" }, { status: 400 });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !twilioPhone) {
      return NextResponse.json({ error: "Missing Twilio configuration" }, { status: 500 });
    }

    const agentIdentity = session.user.email || `user-${(session.user as any).id}`;
    const conferenceRoom = `room-${Date.now()}`;
    const client = twilio(accountSid, authToken);

    // Leg 1: Dial the customer into the conference.
    // startConferenceOnEnter=false → customer hears hold music until agent joins.
    // endConferenceOnExit=true → conference ends if customer hangs up first.
    const customerCall = await client.calls.create({
      to,
      from: twilioPhone,
      twiml: `<Response><Dial><Conference startConferenceOnEnter="false" endConferenceOnExit="true" beep="false">${conferenceRoom}</Conference></Dial></Response>`,
    });

    // Leg 2: Dial the agent's browser into the same conference.
    // startConferenceOnEnter=true → conference starts (audio flows) when agent joins.
    // endConferenceOnExit=true → conference ends (drops customer) when agent hangs up.
    const agentCall = await client.calls.create({
      to: `client:${agentIdentity}`,
      from: twilioPhone,
      twiml: `<Response><Dial><Conference startConferenceOnEnter="true" endConferenceOnExit="true" beep="false">${conferenceRoom}</Conference></Dial></Response>`,
    });

    return NextResponse.json({
      conferenceRoom,
      customerCallSid: customerCall.sid,
      agentCallSid: agentCall.sid,
    });
  } catch (error: any) {
    console.error("Initiate call error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to initiate call" },
      { status: 500 }
    );
  }
}
