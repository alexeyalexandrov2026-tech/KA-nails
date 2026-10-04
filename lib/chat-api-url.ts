/**
 * The AI receptionist's endpoint, from the build setting
 * NEXT_PUBLIC_CHAT_API_URL (the Function App's origin). Without a valid value
 * the chat button is not rendered. Loopback HTTP is allowed for local tests.
 */
export function approvedChatApiUrl(value: string | undefined): string | null {
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
      url.pathname !== "/"
    )
      return null;
    return `${url.origin}/api/chat`;
  } catch {
    return null;
  }
}
