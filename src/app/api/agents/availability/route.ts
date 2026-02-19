import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  setAvailable,
  setUnavailable,
  isAvailable,
  getAvailableAgents,
} from "@/lib/agentAvailability";

function getIdentity(session: any): string {
  return session.user.email || `user-${session.user.id}`;
}

// GET  — returns current agent's availability + full online list
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const identity = getIdentity(session);
  return NextResponse.json({
    identity,
    available: isAvailable(identity),
    onlineAgents: getAvailableAgents(),
  });
}

// POST — set availability  { available: true | false }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { available } = await req.json();
  const identity = getIdentity(session);

  if (available) {
    setAvailable(identity);
  } else {
    setUnavailable(identity);
  }

  return NextResponse.json({ identity, available });
}
