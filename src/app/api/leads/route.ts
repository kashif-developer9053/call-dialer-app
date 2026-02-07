import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Lead from "@/models/Lead";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    let leads;

    // Admin sees all leads
    if (session.user.role === "admin") {
      leads = await Lead.find({})
        .populate("assignedTo", "name email")
        .sort({ createdAt: -1 });
    } else {
      // Agents see only their assigned leads
      leads = await Lead.find({ assignedTo: session.user.id })
        .populate("assignedTo", "name email")
        .sort({ createdAt: -1 });
    }

    return NextResponse.json({ leads }, { status: 200 });
  } catch (error) {
    console.error("Get leads error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}