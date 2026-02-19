import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import twilio from "twilio";

/**
 * One-time setup: points your Twilio phone number's Voice URL at this app.
 * Call this once after deploying (or after changing NEXT_PUBLIC_APP_URL).
 *
 * POST /api/twilio/setup
 */
export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER!;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (!appUrl || appUrl.includes("localhost")) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL must be a public HTTPS URL, not localhost." },
      { status: 400 }
    );
  }

  const client = twilio(accountSid, authToken);

  // Find the phone number resource by number
  const numbers = await client.incomingPhoneNumbers.list({ phoneNumber: twilioPhone });
  if (numbers.length === 0) {
    return NextResponse.json({ error: `Phone number ${twilioPhone} not found in your Twilio account.` }, { status: 404 });
  }

  const inboundUrl = `${appUrl}/api/twilio/inbound`;

  await client.incomingPhoneNumbers(numbers[0].sid).update({
    voiceUrl: inboundUrl,
    voiceMethod: "POST",
  });

  return NextResponse.json({
    success: true,
    message: `Voice URL set to ${inboundUrl}`,
  });
}
