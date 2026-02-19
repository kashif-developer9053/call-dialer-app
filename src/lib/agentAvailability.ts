/**
 * In-memory agent availability store.
 * Agents register here when their Twilio device comes online
 * and deregister when they go offline or close the tab.
 *
 * For multi-server / production deployments, swap this with
 * a Redis SET or a MongoDB collection with TTL indexes.
 */

const available = new Map<string, number>(); // identity → timestamp

export function setAvailable(identity: string) {
  available.set(identity, Date.now());
}

export function setUnavailable(identity: string) {
  available.delete(identity);
}

export function getAvailableAgents(): string[] {
  return Array.from(available.keys());
}

export function isAvailable(identity: string): boolean {
  return available.has(identity);
}
