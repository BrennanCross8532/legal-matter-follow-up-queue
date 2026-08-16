import { decideFollowUp } from "./follow_up_decision.js";
import { infrai } from "./infrai.js";

export async function runOnce(now = new Date()): Promise<void> {
  const batch = await infrai.queue.consume(10, 60);
  for (const message of batch.messages) {
    const decision = decideFollowUp(message.payload, now);
    if (decision.action === "wait") {
      console.log(`Matter ${message.payload.matterId} remains queued until ${message.payload.followUpAt}`);
      continue;
    }

    console.log(`Send deadline follow-up for ${decision.matterId} to ${decision.clientEmail}`);
    await infrai.queue.ack(message.message_id);
  }
}

if (process.env.NODE_ENV !== "test") {
  runOnce().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
