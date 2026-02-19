import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const params = new URLSearchParams(body);

    const callSid = params.get("CallSid");
    const callStatus = params.get("CallStatus");
    const from = params.get("From");
    const to = params.get("To");

    console.log(
      `📞 Call Status: ${callSid} | Status: ${callStatus} | From: ${from} | To: ${to}`
    );

    // Log call status for debugging
    switch (callStatus) {
      case "initiated":
        console.log(`✓ Call initiated: ${callSid}`);
        break;
      case "ringing":
        console.log(`📱 Call ringing: ${callSid}`);
        break;
      case "answered":
        console.log(`🎧 Call answered: ${callSid}`);
        break;
      case "completed":
        console.log(`✓ Call completed: ${callSid}`);
        const duration = params.get("CallDuration");
        console.log(`   Duration: ${duration}s`);
        break;
      case "failed":
        console.log(`❌ Call failed: ${callSid}`);
        break;
      case "no-answer":
        console.log(`⏱️ Call not answered: ${callSid}`);
        break;
      case "canceled":
        console.log(`❌ Call canceled: ${callSid}`);
        break;
      default:
        console.log(`❓ Unknown status: ${callStatus}`);
    }

    // Return 200 OK to acknowledge receipt
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Status callback error:", error);
    return NextResponse.json(
      { error: "Failed to process status" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const callSid = req.nextUrl.searchParams.get("CallSid");
    const callStatus = req.nextUrl.searchParams.get("CallStatus");

    console.log(`📞 Call Status (GET): ${callSid} - ${callStatus}`);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Status callback error:", error);
    return NextResponse.json(
      { error: "Failed to process status" },
      { status: 500 }
    );
  }
}
