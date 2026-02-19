import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { enqueue } from "@/lib/inboundCallQueue";

/**
 * Twilio calls this when someone dials your Twilio number.
 *
 * - Validates the request is genuinely from Twilio.
 * - Adds the caller to an in-memory queue.
 * - Returns TwiML that holds the caller in a named conference with hold music
 *   until an agent claims and joins the call.
 *
 * Set this as the Voice URL for your Twilio phone number.
 * Run POST /api/twilio/setup once to do it automatically.
 */
export async function POST(req: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  // ── Validate request is from Twilio ──────────────────────────────────────
  const twilioSignature = req.headers.get("x-twilio-signature") ?? "";
  const url = `${appUrl}/api/twilio/inbound`;
  const formData = await req.formData();
  const params: Record<string, string> = {};
  formData.forEach((v, k) => { params[k] = v.toString(); });

  if (!twilio.validateRequest(authToken, twilioSignature, url, params)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const callSid = params["CallSid"];
  const callerNumber = params["From"] ?? "Unknown";

  // ── Add to queue + generate conference name ───────────────────────────────
  const conferenceName = enqueue(callSid, callerNumber);

  // ── Return TwiML: hold caller in conference until agent joins ─────────────
  // startConferenceOnEnter=false → caller hears hold music until agent joins.
  // statusCallback → we clean up the queue when the conference ends.
  const twiml = `<Response><Dial><Conference startConferenceOnEnter="false" endConferenceOnExit="true" beep="false" statusCallbackEvent="end" statusCallback="${appUrl}/api/twilio/inbound-status" statusCallbackMethod="POST">${conferenceName}</Conference></Dial></Response>`;

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}
