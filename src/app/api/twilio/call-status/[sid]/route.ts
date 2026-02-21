import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import twilio from "twilio";

/**
 * GET /api/twilio/call-status/[sid]
 * Returns the live status of a Twilio call leg.
 * Used by the browser to poll whether the customer answered, declined, or timed out.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { sid: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sid } = params;
  if (!sid) return NextResponse.json({ error: "Missing call SID" }, { status: 400 });

  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  );

  try {
    const call = await client.calls(sid).fetch();
    // Possible statuses: queued | ringing | in-progress | completed | busy | failed | no-answer | canceled
    return NextResponse.json({ status: call.status, duration: call.duration });
  } catch (err: any) {
    // If the SID is gone (call cleaned up), treat as completed
    if (err.code === 20404) {
      return NextResponse.json({ status: "completed", duration: "0" });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
