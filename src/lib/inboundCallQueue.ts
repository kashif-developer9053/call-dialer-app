/**
 * In-memory queue of inbound calls waiting for an agent.
 *
 * Populated by /api/twilio/inbound (Twilio webhook).
 * Read by /api/twilio/inbound-poll (browser polling — no Twilio API calls).
 * Claimed by /api/twilio/claim-inbound (agent accepts the call).
 * Cleaned up by /api/twilio/inbound-status (Twilio conference-end callback).
 */

export interface WaitingCall {
  callSid: string;
  callerNumber: string;
  conferenceName: string;
  receivedAt: Date;
}

const queue = new Map<string, WaitingCall>();
const claimed = new Set<string>();

/** Called by the inbound webhook when a new call arrives. */
export function enqueue(callSid: string, callerNumber: string): string {
  const conferenceName = `inbound-${callSid}`;
  queue.set(callSid, { callSid, callerNumber, conferenceName, receivedAt: new Date() });
  return conferenceName;
}

/** Returns calls that haven't been claimed yet, drops stale ones (>10 min). */
export function getWaiting(): WaitingCall[] {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [sid, call] of queue) {
    if (call.receivedAt.getTime() < cutoff) queue.delete(sid);
  }
  return Array.from(queue.values()).filter((c) => !claimed.has(c.callSid));
}

/**
 * Atomically claim a call for an agent.
 * Returns the call if successful, null if already claimed or not found.
 */
export function claimCall(callSid: string): WaitingCall | null {
  if (claimed.has(callSid) || !queue.has(callSid)) return null;
  claimed.add(callSid);
  return queue.get(callSid)!;
}

/** Called when the conference ends — removes from queue entirely. */
export function dequeue(callSid: string) {
  queue.delete(callSid);
  claimed.delete(callSid);
}
