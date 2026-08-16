import type { FollowUpPayload } from "./infrai.js";

export type FollowUpDecision =
  | { action: "wait"; remainingMs: number }
  | { action: "send"; matterId: string; clientEmail: string };

export function decideFollowUp(payload: FollowUpPayload, now: Date): FollowUpDecision {
  const remainingMs = new Date(payload.followUpAt).getTime() - now.getTime();
  if (remainingMs > 0) return { action: "wait", remainingMs };
  return {
    action: "send",
    matterId: payload.matterId,
    clientEmail: payload.clientEmail,
  };
}
