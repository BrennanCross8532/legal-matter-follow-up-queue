import express from "express";
import { z } from "zod";
import { InfraiError, infrai } from "./infrai.js";

const signedDeliverySchema = z.object({
  matterId: z.string().min(1),
  clientEmail: z.string().email(),
  signedDocumentId: z.string().min(1),
  deliveredAt: z.string().datetime(),
  followUpDelayHours: z.number().int().min(1).max(168),
});

export const app = express();
app.use(express.json());

app.post("/matters/signed-delivery", async (request, response) => {
  const parsed = signedDeliverySchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid signed delivery", issues: parsed.error.issues });
    return;
  }

  const input = parsed.data;
  const deliveredAt = new Date(input.deliveredAt);
  const followUpAt = new Date(
    deliveredAt.getTime() + input.followUpDelayHours * 60 * 60 * 1_000,
  ).toISOString();

  try {
    await infrai.queue.publish(
      {
        payload: {
          matterId: input.matterId,
          clientEmail: input.clientEmail,
          signedDocumentId: input.signedDocumentId,
          deliveredAt: input.deliveredAt,
          followUpAt,
        },
      },
      `signed-delivery:${input.matterId}:${input.signedDocumentId}`,
    );
    response.status(202).json({ matterId: input.matterId, followUpAt, status: "queued" });
  } catch (error) {
    if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
      response.status(error.status).json({ error: error.code, message: error.message });
      return;
    }
    response.status(502).json({ error: "Queue request failed" });
  }
});

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => console.log(`Matter intake listening on http://localhost:${port}`));
}
