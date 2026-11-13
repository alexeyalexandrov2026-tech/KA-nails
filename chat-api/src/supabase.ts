import type { RequestStore } from "./chat";

export function supabaseRpc(
  url: string,
  secret: string,
  fetchImpl: typeof fetch = fetch,
) {
  return async (name: string, args: object): Promise<unknown> => {
    const response = await fetchImpl(`${url}/rest/v1/rpc/ka_nails_${name}`, {
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
    });
    if (!response.ok) {
      const problem: unknown = await response.json().catch(() => null);
      const code =
        problem &&
        typeof problem === "object" &&
        "code" in problem &&
        typeof problem.code === "string"
          ? problem.code
          : undefined;
      throw new SupabaseError(response.status, code);
    }
    return response.status === 204 ? null : response.json();
  };
}

export function supabaseChat(
  url: string,
  secret: string,
  requestLimit: number,
  fetchImpl: typeof fetch = fetch,
) {
  const rpc = supabaseRpc(url, secret, fetchImpl);

  const store: RequestStore = {
    async beginRequest(id, request, receivedAt, accessHash) {
      const args = {
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
      };
      let storedWithoutAccess = false;
      let result: unknown;
      try {
        result = accessHash
          ? await rpc("chat_begin_request_with_access", {
              ...args,
              p_access_hash: accessHash,
            })
          : await rpc("chat_begin_request", args);
      } catch (error) {
        if (
          !accessHash ||
          !(error instanceof SupabaseError) ||
          error.status !== 404 ||
          error.code !== "PGRST202"
        )
          throw error;
        // PostgREST did not resolve the new RPC. No reservation was attempted.
        result = await rpc("chat_begin_request", args);
        storedWithoutAccess = true;
      }
      if (result === "created")
        return storedWithoutAccess ? "created-without-access" : result;
      if (
        result === "delivered" ||
        result === "pending" ||
        result === "limit"
      ) {
        return result;
      }
      throw new Error("Supabase returned an invalid booking state");
    },
    async finishRequest(id, receivedAt, delivery) {
      const result = await rpc("chat_finish_request", {
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
      const allowed = await rpc("chat_allow_message", { p_limit: limit });
      if (typeof allowed !== "boolean")
        throw new Error("Supabase returned an invalid quota result");
      return allowed;
    },
    async ready() {
      return (await rpc("chat_ready", {})) === true;
    },
  };
}

export class SupabaseError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super("Supabase rejected the request");
  }
}
