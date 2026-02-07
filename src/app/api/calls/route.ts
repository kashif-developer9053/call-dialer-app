import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Call from "@/models/Call";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { leadId, twilioCallSid, status } = await req.json();

    await dbConnect();

    const call = await Call.create({
      lead: leadId,
      agent: session.user.id,
      twilioCallSid,
      status: status || "initiated",
      duration: 0,
    });

    return NextResponse.json({ call }, { status: 201 });
  } catch (error) {
    console.error("Call logging error:", error);
    return NextResponse.json(
      { error: "Failed to log call" },
      { status: 500 }
    );
  }
}