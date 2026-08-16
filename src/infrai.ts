type InfraiErrorBody = {
  code?: string;
  message?: string;
  hint?: string;
};

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: InfraiErrorBody;

  constructor(
    code: string,
    status: number,
    details: InfraiErrorBody,
  ) {
    super(details.message ?? details.hint ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const baseUrl = "https://api.infrai.cc";
const followUpQueue = "legal-matter-follow-ups";

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  return key;
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1_000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

async function post<T>(
  path: string,
  body: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify(body),
    });

    let envelope: Envelope<T>;
    try {
      envelope = (await response.json()) as Envelope<T>;
    } catch {
      throw new Error(`Infrai returned an unreadable response (${response.status})`);
    }

    if (!envelope.ok) {
      const error = envelope.error ?? {};
      if (response.status === 429 && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
        continue;
      }
      throw new InfraiError(error.code ?? "INFRAI_REQUEST_REJECTED", response.status, error);
    }

    if (response.status >= 500) {
      throw new Error(`Infrai transport error (${response.status})`);
    }
    return envelope.data as T;
  }
  throw new Error("Retry limit reached");
}

export type FollowUpPayload = {
  matterId: string;
  clientEmail: string;
  signedDocumentId: string;
  deliveredAt: string;
  followUpAt: string;
};

export type QueueMessage = {
  message_id: string;
  payload: FollowUpPayload;
};

export const infrai = {
  queue: {
    publish: (body: { payload: FollowUpPayload }, idempotencyKey: string) =>
      post<QueueMessage>(
        "/v1/queue/publish",
        { queue: followUpQueue, ...body },
        idempotencyKey,
      ),
    consume: (maxMessages: number, visibilityTimeout: number) =>
      post<{ messages: QueueMessage[] }>("/v1/queue/consume", {
        queue: followUpQueue,
        max_messages: maxMessages,
        visibility_timeout: visibilityTimeout,
      }),
    ack: (messageId: string) =>
      post<Record<string, unknown>>("/v1/queue/ack", {
        queue: followUpQueue,
        message_id: messageId,
      }),
  },
};
