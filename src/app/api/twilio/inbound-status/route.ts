import { NextRequest, NextResponse } from "next/server";
import { dequeue } from "@/lib/inboundCallQueue";

/**
 * Twilio calls this when a conference ends (statusCallbackEvent=end).
 * Removes the call from the queue so agents stop seeing it.
 */
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  // FriendlyName is the conference name we set: "inbound-{CallSid}"
  const friendlyName = formData.get("FriendlyName") as string ?? "";
  const callSid = friendlyName.replace("inbound-", "");
  if (callSid) dequeue(callSid);
  return new NextResponse("OK");
}
