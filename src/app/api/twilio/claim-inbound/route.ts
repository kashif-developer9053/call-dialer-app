import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import twilio from "twilio";
import { claimCall } from "@/lib/inboundCallQueue";

/**
 * Agent claims a waiting inbound call.
 * First agent to POST wins — others get 409.
 * On success, dials the agent's browser into the conference.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { callSid } = await req.json();
  if (!callSid) return NextResponse.json({ error: "Missing callSid" }, { status: 400 });

  const call = claimCall(callSid);
  if (!call) {
    return NextResponse.json(
      { error: "Call already answered by another agent." },
      { status: 409 }
    );
  }

  const agentIdentity = (session.user as any).email || `user-${(session.user as any).id}`;

  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    // Dial the agent's browser into the conference.
    // startConferenceOnEnter=true → conference starts, caller hears the agent.
    // endConferenceOnExit=true → agent hanging up drops the caller too.
    await client.calls.create({
      to: `client:${agentIdentity}`,
      from: process.env.TWILIO_PHONE_NUMBER!,
      twiml: `<Response><Dial><Conference startConferenceOnEnter="true" endConferenceOnExit="true" beep="false">${call.conferenceName}</Conference></Dial></Response>`,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    // Dial failed (e.g. caller hung up before agent answered) — release the claim
    const { dequeue } = await import("@/lib/inboundCallQueue");
    dequeue(callSid);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
