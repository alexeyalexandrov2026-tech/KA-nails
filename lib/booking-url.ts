/** A deployment setting, never a tenant ID or URL taken from the visitor. */
export function approvedBookingUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
    if (
      !(url.protocol === "https:" || (url.protocol === "http:" && loopback)) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/book/"
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
