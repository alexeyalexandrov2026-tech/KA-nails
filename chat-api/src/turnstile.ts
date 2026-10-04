// Cloudflare Turnstile: a check that the visitor is a person. Required unless
// switched off (HUMAN_CHECK=off): without a secret every message is refused.

export async function verifyTurnstile(
  secret: string | undefined,
  token: string | undefined,
  remoteIp: string | undefined,
  fetchImpl: typeof fetch = fetch,
  required = true,
): Promise<boolean> {
  if (!secret) return !required;
  if (!token) return false;
  const form = new URLSearchParams({ secret, response: token });
  if (remoteIp) form.set("remoteip", remoteIp);
  try {
    const response = await fetchImpl(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: form },
    );
    if (!response.ok) return false;
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}
