import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getWaiting } from "@/lib/inboundCallQueue";

/**
 * Returns calls currently waiting for an agent.
 * Reads from in-memory queue — zero Twilio API calls, sub-millisecond response.
 */
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ waitingCalls: getWaiting() });
}
