import assert from "node:assert/strict";
import test from "node:test";
import { decideFollowUp } from "../src/follow_up_decision.js";

const delivery = {
  matterId: "MAT-2048",
  clientEmail: "client@example.com",
  signedDocumentId: "DOC-91",
  deliveredAt: "2026-08-14T09:00:00.000Z",
  followUpAt: "2026-08-14T13:00:00.000Z",
};

test("keeps a signed-document follow-up queued before its deadline", () => {
  assert.deepEqual(decideFollowUp(delivery, new Date("2026-08-14T12:00:00.000Z")), {
    action: "wait",
    remainingMs: 3_600_000,
  });
});

test("releases the follow-up when its deadline arrives", () => {
  assert.deepEqual(decideFollowUp(delivery, new Date("2026-08-14T13:00:00.000Z")), {
    action: "send",
    matterId: "MAT-2048",
    clientEmail: "client@example.com",
  });
});
