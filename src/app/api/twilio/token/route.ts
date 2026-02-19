import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import twilio from "twilio";

const { AccessToken } = twilio.jwt;
const { VoiceGrant } = AccessToken;

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKeySid = process.env.TWILIO_API_KEY_SID;
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;

    if (!accountSid || !apiKeySid || !apiKeySecret) {
      return NextResponse.json({ error: "Missing Twilio credentials" }, { status: 500 });
    }

    const identity = (session.user as any).email || `user-${(session.user as any).id}`;

    const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
      identity,
      ttl: 3600,
    });

    // incomingAllow=true lets the server call this browser client via client:identity
    token.addGrant(new VoiceGrant({ incomingAllow: true }));

    return NextResponse.json({ token: token.toJwt(), identity });
  } catch (error) {
    console.error("Token error:", error);
    return NextResponse.json({ error: "Failed to generate token" }, { status: 500 });
  }
}
