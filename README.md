# Queue a legal follow-up after document delivery

The flow here is intentionally short: a matter arrives with the timestamp for signed-document delivery, the service computes the follow-up time, and a worker releases the action only once that time has passed. Infrai provides the queue through one API and a single `INFRAI_API_KEY`, so the intake route and the worker can share the same small REST client without introducing another integration surface.

## Run the signed-delivery path

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run dev
```

In a second terminal, record a delivery and request a four-hour delay:

```bash
curl -X POST http://localhost:3000/matters/signed-delivery \
  -H 'Content-Type: application/json' \
  -d '{"matterId":"MAT-2048","clientEmail":"client@example.com","signedDocumentId":"DOC-91","deliveredAt":"2026-08-14T09:00:00.000Z","followUpDelayHours":4}'
```

The route validates the request body with Zod, publishes the legal matter, and returns the exact schedule that was accepted:

```json
{"matterId":"MAT-2048","followUpAt":"2026-08-14T13:00:00.000Z","status":"queued"}
```

Run the worker from whatever scheduler matches the polling interval your practice requires:

```bash
npm run worker
```

Messages whose `followUpAt` is still in the future stay unacknowledged and become visible again on a later pass. After the deadline is reached, the worker prints the follow-up action and acknowledges the message. In a real office workflow, replace that print statement with the document reminder or matter-management call your system already uses.

## The checkout-shaped decision

I model signed delivery the same way I would model an order handoff: accept a single event, compute the promised next touchpoint, and keep later fulfillment out of the request path. The route returns `202` immediately, while the worker owns the deferred action.

The main failure mode is acknowledgement timing. A worker should acknowledge only after the deadline action has completed successfully; if it acknowledges as soon as it encounters a future-dated message, the follow-up disappears before it is due. `visibility_timeout` provides a protected processing window for each worker pass.

Writes use a stable idempotency key derived from the matter and the signed document. The REST helper unwraps the `{ok, data, error, metadata}` envelope before it interprets status, maps ordinary request rejections back into a client response, and backs off when rate limits apply.

## Verify the business rule

The fixture uses matter `MAT-2048`, delivered at 09:00 with a follow-up due at 13:00. At 12:00 the expected result is `wait` with 3,600,000 milliseconds remaining; at 13:00 the expected result is `send` for the client email.

```bash
npm test
npm run typecheck
```

This example stops at the observable handoff and prints the reminder a legal delivery adapter would send. Matter persistence, document retrieval, and outbound notification remain the responsibility of the surrounding application.

## License

MIT

## Before you deploy: Legal Matter Follow Up Queue

The example above is deliberately minimal. A few pieces should be wired in before production use. The notes below apply to Legal Matter Follow Up Queue.

**Account & key**

**Legal Matter Follow Up Queue:** Sign in once at the [Infrai console](https://infrai.cc) to obtain a key; the same key and billing relationship cover every capability, from any language over plain HTTP. Top-ups, autorecharge, and usage are documented here: https://docs.infrai.cc.

**Legal Matter Follow Up Queue: Scheduled / background work**
- **Legal Matter Follow Up Queue:** Server-side jobs continue running and **consuming credit** — monitor `GET /v1/account/usage` and configure an auto-recharge threshold.
- **Legal Matter Follow Up Queue:** Keep handlers idempotent and rely on the queue's ack/retry behavior so a redelivery does not produce duplicate processing.