// Cloudflare Turnstile: a check that the visitor is a person. Required unless
// switched off (HUMAN_CHECK=off): without a secret every message is refused.

export interface HumanCheck {
  ok: boolean;
  /** Why it failed: Cloudflare's error codes or a local reason (no-token). */
  reason?: string;
}

export async function verifyTurnstile(
  secret: string | undefined,
  token: string | undefined,
  fetchImpl: typeof fetch = fetch,
  required = true,
  expectedHostname?: string,
): Promise<HumanCheck> {
  if (!secret) {
    return required ? { ok: false, reason: "no-secret" } : { ok: true };
  }
  if (!token) return { ok: false, reason: "no-token" };
  // No remoteip: a browser can reach Cloudflare and this API from different
  // addresses (IPv6 and IPv4), and the parameter is optional.
  const form = new URLSearchParams({ secret, response: token });
  try {
    const response = await fetchImpl(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: form, signal: AbortSignal.timeout(5_000) },
    );
    if (!response.ok) {
      return { ok: false, reason: `siteverify-http-${response.status}` };
    }
    const result = (await response.json()) as {
      success?: boolean;
      hostname?: string;
      "error-codes"?: string[];
    };
    if (result.success === true) {
      return expectedHostname && result.hostname !== expectedHostname
        ? { ok: false, reason: "hostname-mismatch" }
        : { ok: true };
    }
    return {
      ok: false,
      reason: (result["error-codes"] ?? []).join(",") || "rejected",
    };
  } catch {
    return { ok: false, reason: "siteverify-unreachable" };
  }
}
