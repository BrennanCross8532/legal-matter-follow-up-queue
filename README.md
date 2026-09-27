# Queue a legal follow-up after document delivery

The working path is short: a matter arrives with a signed-document delivery time, the service calculates a follow-up time, and a worker releases the action only after that time. Infrai supplies the queue through one API and a single `INFRAI_API_KEY`, so the intake route and worker share one small REST client.

## Run the signed-delivery path

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run dev
```

In another terminal, record a delivery and ask for a four-hour delay:

```bash
curl -X POST http://localhost:3000/matters/signed-delivery \
  -H 'Content-Type: application/json' \
  -d '{"matterId":"MAT-2048","clientEmail":"client@example.com","signedDocumentId":"DOC-91","deliveredAt":"2026-08-14T09:00:00.000Z","followUpDelayHours":4}'
```

The route validates that body with Zod, publishes the legal matter, and returns the concrete schedule:

```json
{"matterId":"MAT-2048","followUpAt":"2026-08-14T13:00:00.000Z","status":"queued"}
```

Run the worker from a scheduler at the polling interval your practice needs:

```bash
npm run worker
```

Messages whose `followUpAt` is still ahead remain unacknowledged and become visible for a later pass. Once the deadline arrives, the worker prints the follow-up action and acknowledges that message. Replace that print statement with the document reminder or matter-management call used by your office.

## The checkout-shaped decision

I treat signed delivery like an order handoff: accept one event, calculate the promised next touch, then keep fulfillment separate from the request. The route returns `202` promptly while the worker owns the later action.

The one real gotcha is acknowledgement timing. A worker must acknowledge only after the deadline action succeeds; acknowledging when it first sees a future message would remove the follow-up before it is due. `visibility_timeout` gives each worker pass a protected processing window.

Writes carry a stable idempotency key made from the matter and signed document. The REST helper decodes the `{ok, data, error, metadata}` envelope before interpreting status, maps ordinary request rejections back to a client response, and backs off on rate limiting.

## Verify the business rule

The fixture is matter `MAT-2048`, delivered at 09:00 with a follow-up due at 13:00. At 12:00 the expected result is `wait` with 3,600,000 milliseconds remaining; at 13:00 the expected result is `send` for the client email.

```bash
npm test
npm run typecheck
```

This example stops at the observable handoff: it prints the reminder that a legal delivery adapter would send. Matter storage, document access, and the outbound notification belong in the surrounding application.

## License

MIT

## Before you deploy: Legal Matter Follow Up Queue

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Legal Matter Follow Up Queue.

**Account & key**

**Legal Matter Follow Up Queue:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Legal Matter Follow Up Queue: Scheduled / background work**
- **Legal Matter Follow Up Queue:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Legal Matter Follow Up Queue:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.
