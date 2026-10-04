import AnthropicFoundry from "@anthropic-ai/foundry-sdk";
import type Anthropic from "@anthropic-ai/sdk";
import { EmailClient } from "@azure/communication-email";
import { TableClient } from "@azure/data-tables";
import { getBearerTokenProvider, type TokenCredential } from "@azure/identity";
import type { BookingRequest } from "./booking-request";
import type { RequestStore } from "./chat";
import type { DailyCounter } from "./limits";
import type { Notifier, NotifyResult } from "./notify";

// Azure services behind the receptionist. Every one is reached with the
// Function App's managed identity: no keys in code or settings.

/** Claude in Microsoft Foundry (Messages API), keyless via Entra ID. */
export function foundryMessages(
  resource: string,
  credential: TokenCredential,
): (
  params: Anthropic.MessageCreateParamsNonStreaming,
) => Promise<Anthropic.Message> {
  const client = new AnthropicFoundry({
    resource,
    azureADTokenProvider: getBearerTokenProvider(
      credential,
      "https://ai.azure.com/.default",
    ),
  });
  return (params) => client.messages.create(params);
}

async function ensureTable(client: TableClient, ready: { done: boolean }) {
  if (!ready.done) {
    await client.createTable();
    ready.done = true;
  }
}

/** Requests in Table Storage: one row per request, partitioned by UTC day. */
export function tableRequestStore(
  endpoint: string,
  credential: TokenCredential,
): RequestStore {
  const client = new TableClient(endpoint, "requests", credential);
  const ready = { done: false };
  return {
    async saveRequest(
      id: string,
      request: BookingRequest,
      receivedAt: Date,
      delivery: NotifyResult[],
    ) {
      await ensureTable(client, ready);
      await client.createEntity({
        partitionKey: receivedAt.toISOString().slice(0, 10),
        rowKey: id,
        receivedAt: receivedAt.toISOString(),
        serviceId: request.serviceId ?? "",
        addOnIds: request.addOnIds.join(","),
        preferredTime: request.preferredTime,
        name: request.name,
        phone: request.phone,
        notes: request.notes,
        language: request.language,
        delivery: JSON.stringify(delivery),
        status: "new",
      });
    },
  };
}

/** Messages per UTC day, shared by all instances (optimistic concurrency). */
export function tableDailyCounter(
  endpoint: string,
  credential: TokenCredential,
): DailyCounter {
  const client = new TableClient(endpoint, "usage", credential);
  const ready = { done: false };
  return {
    async increment(day: string) {
      await ensureTable(client, ready);
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const entity = await client.getEntity<{ count: number }>(
            "messages",
            day,
          );
          const count = (entity.count ?? 0) + 1;
          await client.updateEntity(
            { partitionKey: "messages", rowKey: day, count },
            "Replace",
            { etag: entity.etag },
          );
          return count;
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404) {
            try {
              await client.createEntity({
                partitionKey: "messages",
                rowKey: day,
                count: 1,
              });
              return 1;
            } catch (createError) {
              if ((createError as { statusCode?: number }).statusCode !== 409) {
                throw createError;
              }
            }
          } else if (status !== 412) {
            throw error;
          }
        }
      }
      throw new Error("usage counter is busy");
    },
  };
}

/** Email to the studio through Azure Communication Services. */
export function emailNotifier(
  endpoint: string,
  credential: TokenCredential,
  sender: string,
  to: string,
): Notifier {
  const client = new EmailClient(endpoint, credential);
  return {
    channel: "email",
    async send(subject, text) {
      const poller = await client.beginSend({
        senderAddress: sender,
        recipients: { to: [{ address: to }] },
        content: { subject, plainText: text },
      });
      const result = await poller.pollUntilDone();
      if (result.status !== "Succeeded") {
        throw new Error(`email ${result.status}`);
      }
    },
  };
}
