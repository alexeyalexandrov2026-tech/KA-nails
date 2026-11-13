import type { RequestStore } from "./chat";

export function supabaseChat(
  url: string,
  secret: string,
  requestLimit: number,
  fetchImpl: typeof fetch = fetch,
) {
  async function rpc(name: string, args: object): Promise<unknown> {
    const response = await fetchImpl(
      `${url}/rest/v1/rpc/ka_nails_chat_${name}`,
      {
        method: "POST",
        headers: {
          apikey: secret,
          ...(secret.startsWith("eyJ")
            ? { authorization: `Bearer ${secret}` }
            : {}),
          "content-type": "application/json",
          "user-agent": "KA-Nails-Worker/1.0",
        },
        body: JSON.stringify(args),
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (!response.ok) throw new SupabaseError(response.status);
    return response.json();
  }

  const store: RequestStore = {
    async beginRequest(id, request, receivedAt) {
      const result = await rpc("begin_request", {
        p_id: id,
        p_received_at: receivedAt.toISOString(),
        p_service_id: request.serviceId,
        p_add_on_ids: request.addOnIds,
        p_preferred_time: request.preferredTime,
        p_name: request.name,
        p_phone: request.phone,
        p_notes: request.notes,
        p_language: request.language,
        p_limit: requestLimit,
      });
      if (
        result === "created" ||
        result === "delivered" ||
        result === "pending" ||
        result === "limit"
      ) {
        return result;
      }
      throw new Error("Supabase returned an invalid booking state");
    },
    async finishRequest(id, receivedAt, delivery) {
      const result = await rpc("finish_request", {
        p_id: id,
        p_received_at: receivedAt.toISOString(),
        p_delivery: delivery,
      });
      if (result !== true)
        throw new Error("Supabase could not record booking delivery");
    },
  };
  return {
    store,
    async allowMessage(limit: number) {
      const allowed = await rpc("allow_message", { p_limit: limit });
      if (typeof allowed !== "boolean")
        throw new Error("Supabase returned an invalid quota result");
      return allowed;
    },
    async ready() {
      return (await rpc("ready", {})) === true;
    },
  };
}

export class SupabaseError extends Error {
  constructor(readonly status: number) {
    super("Supabase rejected the request");
  }
}
