/**
 * Tracks which inbound conference rooms have already been claimed by an agent.
 * Prevents two agents from both answering the same inbound call.
 *
 * Single-process safe (JavaScript is single-threaded).
 * For multi-server deployments, replace with a Redis SET with TTL.
 */

const claimed = new Map<string, string>(); // conferenceSid → agentIdentity

export function claimConference(conferenceSid: string, agentIdentity: string): boolean {
  if (claimed.has(conferenceSid)) return false;
  claimed.set(conferenceSid, agentIdentity);
  return true;
}

export function releaseConference(conferenceSid: string) {
  claimed.delete(conferenceSid);
}

export function isClaimed(conferenceSid: string): boolean {
  return claimed.has(conferenceSid);
}
