import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const params = new URLSearchParams(body);

    const conferenceSid = params.get("ConferenceSid");
    const callSid = params.get("CallSid");
    const statusCallbackEvent = params.get("StatusCallbackEvent");
    const friendlyName = params.get("FriendlyName");

    console.log(`📞 Conference Event: ${statusCallbackEvent}`);
    console.log(`   Conference SID: ${conferenceSid}`);
    console.log(`   Call SID: ${callSid}`);
    console.log(`   Conference Name: ${friendlyName}`);

    switch (statusCallbackEvent) {
      case "conference-start":
        console.log(`✅ Conference Started`);
        break;
      case "conference-end":
        console.log(`✅ Conference Ended`);
        break;
      case "participant-join":
        console.log(`👤 Participant Joined Conference`);
        break;
      case "participant-leave":
        console.log(`👤 Participant Left Conference`);
        break;
      default:
        console.log(`Event: ${statusCallbackEvent}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Conference status error:", error);
    return NextResponse.json(
      { error: "Failed to process conference status" },
      { status: 500 }
    );
  }
}
