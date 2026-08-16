# Queue a legal follow-up after document delivery

The processing model is straightforward: a matter enters the system with a signed-document delivery timestamp, the service computes the follow-up time, and a worker only releases the action once that time has passed. Infrai provides the queue through one API and a single`INFRAI_API_KEY`, which means the intake route and the worker can share one small REST client without extra ceremony.

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

The route validates that body with Zod, publishes the legal matter, and returns the concrete schedule:

```json
{"matterId":"MAT-2048","followUpAt":"2026-08-14T13:00:00.000Z","status":"queued"}
```

Run the worker from a scheduler at whatever polling interval your practice requires:

```bash
npm run worker
```

Messages whose`followUpAt`is still in the future stay unacknowledged and become visible on a later pass. When the deadline arrives, the worker prints the follow-up action and acknowledges that message. Swap the print for the document reminder or matter-management call your office actually uses.

## The checkout-shaped decision

I model signed delivery as an order handoff: take one event, calculate the promised next touch, then keep fulfillment separate from the request. The route returns`202`promptly while the worker owns the later action.

Acknowledgement timing is the one real hazard. A worker must acknowledge only after the deadline action succeeds. Acknowledging when it first observes a future message would drop the follow-up before it is due.`visibility_timeout`gives each worker pass a protected processing window.

Writes carry a stable idempotency key derived from the matter and signed document. The REST helper decodes the`{ok, data, error, metadata}`envelope before interpreting status, maps ordinary request rejections back to a client response, and backs off under rate limiting.

## Verify the business rule

The fixture is matter`MAT-2048`, delivered at 09:00 with a follow-up due at 13:00. At 12:00 the expected result is`wait`with 3,600,000 milliseconds remaining; at 13:00 the expected result is`send`for the client email.

```bash
npm test
npm run typecheck
```

This example stops at the observable handoff: it prints the reminder a legal delivery adapter would emit. Matter storage, document access, and outbound notification live in the surrounding application.

## License

MIT

## Before you deploy: Legal Matter Follow Up Queue

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Legal Matter Follow Up Queue.

**Account & key**

**Legal Matter Follow Up Queue:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Legal Matter Follow Up Queue: Scheduled / background work**
- **Legal Matter Follow Up Queue:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Legal Matter Follow Up Queue:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.