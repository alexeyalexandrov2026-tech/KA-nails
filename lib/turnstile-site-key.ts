/**
 * The Cloudflare Turnstile site key for the chat's human check, from the
 * build setting NEXT_PUBLIC_TURNSTILE_SITE_KEY. Site keys use only letters,
 * digits, "-" and "_", so anything else (a space or line break pasted with
 * the key) is removed: Turnstile refuses a key with a space in it.
 */
export function turnstileSiteKey(
  value: string | undefined,
): string | undefined {
  return value?.replace(/[^0-9A-Za-z_-]/g, "") || undefined;
}
