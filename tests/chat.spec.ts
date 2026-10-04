import { expect, test, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { approvedChatApiUrl } from "../lib/chat-api-url";
import { channelHref, studioFacts } from "../lib/studio-facts";
import { turnstileSiteKey } from "../lib/turnstile-site-key";

// The AI receptionist widget. The API (chat-api/, Azure) is replaced by a
// fake here: these tests check what the page sends and shows. They need a
// build made with NEXT_PUBLIC_CHAT_API_URL (CI's second pass sets it to the
// preview origin); without it only the "no button" check applies.

const CHAT = approvedChatApiUrl(process.env.NEXT_PUBLIC_CHAT_API_URL);
// CI's chat pass also sets a Turnstile site key; the script itself is faked.
const TURNSTILE = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const WHATSAPP = studioFacts.channels
  .filter((c) => c.kind === "whatsapp")
  .map(channelHref)[0];

interface Sent {
  language: string;
  messages: { role: string; content: string }[];
  requestSent: boolean;
  turnstileToken?: string;
}

// Stand-in for Cloudflare Turnstile: numbered tokens, and like the real one
// it cannot run a widget whose element has left the page. A test can set
// window.__turnstileError to make every check fail with that code.
const FAKE_TURNSTILE = `(() => {
  let widgets = 0;
  let tokens = 0;
  const live = new Map();
  window.__turnstileRenders = [];
  window.turnstile = {
    render(element, options) {
      const id = "widget-" + ++widgets;
      live.set(id, { element, options });
      window.__turnstileRenders.push({
        size: options.size,
        appearance: options.appearance,
        execution: options.execution,
      });
      return id;
    },
    reset() {},
    remove(id) {
      live.delete(id);
    },
    execute(id) {
      const widget = live.get(id);
      if (!widget || !widget.element.isConnected) {
        throw new Error("Turnstile: the widget is gone");
      }
      const error = window.__turnstileError;
      setTimeout(() => {
        if (error) widget.options["error-callback"](error);
        else widget.options.callback("token-" + ++tokens);
      }, 10);
    },
  };
})();`;

async function fakeApi(
  page: Page,
  reply: (body: Sent, route: Route) => Promise<void> | void,
) {
  const sent: Sent[] = [];
  await page.route(CHAT!, async (route) => {
    const body = route.request().postDataJSON() as Sent;
    sent.push(body);
    await reply(body, route);
  });
  return sent;
}

const answer = (route: Route, reply: string, requestSent = false) =>
  route.fulfill({ json: { reply, requestSent } });

test.describe("AI receptionist", () => {
  test("the chat address must be an approved https origin", () => {
    expect(approvedChatApiUrl(undefined)).toBeNull();
    expect(approvedChatApiUrl("https://kanails-chat.azurewebsites.net")).toBe(
      "https://kanails-chat.azurewebsites.net/api/chat",
    );
    expect(approvedChatApiUrl("http://127.0.0.1:4173")).toBe(
      "http://127.0.0.1:4173/api/chat",
    );
    for (const bad of [
      "http://kanails-chat.azurewebsites.net",
      "https://x.example/api/chat",
      "https://x.example/?tenant=1",
      "https://user:pass@x.example",
      "javascript:alert(1)",
    ]) {
      expect(approvedChatApiUrl(bad), bad).toBeNull();
    }
  });

  test("the Turnstile site key loses what was pasted with it", () => {
    expect(turnstileSiteKey(undefined)).toBeUndefined();
    expect(turnstileSiteKey(" \n")).toBeUndefined();
    expect(turnstileSiteKey("1x00000000000000000000AA")).toBe(
      "1x00000000000000000000AA",
    );
    // A space inside the key once made every chat message fail (403).
    expect(turnstileSiteKey(" 0x4 AAAAAAAbc-De_F12​\r\n")).toBe(
      "0x4AAAAAAAbc-De_F12",
    );
  });

  test("the chat button appears only when the API address is configured", async ({
    page,
  }) => {
    for (const url of ["/", "/ru/services/"]) {
      await page.goto(url);
      await expect(page.locator(".chat-launcher")).toHaveCount(CHAT ? 1 : 0);
    }
  });

  test.describe("with the API configured", () => {
    test.skip(!CHAT, "build without NEXT_PUBLIC_CHAT_API_URL");

    test.beforeEach(async ({ page }) => {
      if (!TURNSTILE) return;
      await page.route(
        /^https:\/\/challenges\.cloudflare\.com\/turnstile\//,
        (route) =>
          route.fulfill({
            contentType: "text/javascript",
            body: FAKE_TURNSTILE,
          }),
      );
    });

    test("a conversation sends the text history and shows the replies", async ({
      page,
    }) => {
      const sent = await fakeApi(page, (body, route) =>
        body.messages.length === 1
          ? answer(route, "A Classic Pedicure is $75.")
          : answer(route, "Sent! Karina will contact you.", true),
      );
      await page.goto("/");
      const launcher = page.locator(".chat-launcher");
      await expect(launcher).toHaveText("Ask or book");
      await launcher.click();
      await expect(launcher).toHaveAttribute("aria-expanded", "true");
      const panel = page.getByRole("dialog", { name: "KA Nails assistant" });
      await expect(panel).toBeVisible();
      const input = panel.getByLabel("Your message");
      await expect(input).toBeFocused();

      await input.fill("How much is a classic pedicure?");
      await input.press("Enter");
      await expect(panel.locator(".chat-message-assistant").last()).toHaveText(
        /A Classic Pedicure is \$75\./,
      );
      expect(sent[0]).toEqual({
        language: "en",
        messages: [
          { role: "user", content: "How much is a classic pedicure?" },
        ],
        requestSent: false,
        ...(TURNSTILE ? { turnstileToken: "token-1" } : {}),
      });

      await input.fill("Book me Saturday, Ann, 561 555 0100");
      await panel.getByRole("button", { name: "Send" }).click();
      await expect(panel.locator(".chat-message-assistant").last()).toHaveText(
        /Karina will contact you/,
      );
      expect(sent[1]!.messages.map((m) => m.role)).toEqual([
        "user",
        "assistant",
        "user",
      ]);

      // Once a request went to the master, the page says so on every turn.
      await input.fill("Thanks!");
      await input.press("Enter");
      await expect.poll(() => sent.length).toBe(3);
      expect(sent[2]!.requestSent).toBe(true);
    });

    test("the Russian page talks in Russian", async ({ page }) => {
      const sent = await fakeApi(page, (_body, route) =>
        answer(route, "Классический педикюр стоит 75 $."),
      );
      await page.goto("/ru/");
      await page.locator(".chat-launcher").click();
      const panel = page.getByRole("dialog", { name: "Ассистент KA Nails" });
      await expect(panel).toContainText("Здравствуйте!");
      await panel.getByLabel("Ваше сообщение").fill("Сколько стоит педикюр?");
      await panel.getByRole("button", { name: "Отправить" }).click();
      await expect(panel).toContainText("75 $");
      expect(sent[0]!.language).toBe("ru");
    });

    test("a failed message offers WhatsApp and is not sent as history", async ({
      page,
    }) => {
      let fail = true;
      const sent = await fakeApi(page, (_body, route) =>
        fail ? route.fulfill({ status: 503 }) : answer(route, "Hello!"),
      );
      await page.goto("/");
      await page.locator(".chat-launcher").click();
      const panel = page.getByRole("dialog");
      const input = panel.getByLabel("Your message");
      await input.fill("Hi");
      await input.press("Enter");
      const notice = panel.locator(".chat-message-notice");
      await expect(notice).toContainText("The message was not sent");
      if (WHATSAPP) {
        await expect(notice.getByRole("link")).toHaveAttribute(
          "href",
          WHATSAPP,
        );
      }
      // The draft comes back so the visitor can retry.
      await expect(input).toHaveValue("Hi");
      fail = false;
      await input.press("Enter");
      await expect(panel.locator(".chat-message-assistant").last()).toHaveText(
        /Hello!/,
      );
      expect(sent[1]!.messages).toEqual([{ role: "user", content: "Hi" }]);
    });

    test("every message gets a fresh human check, also after the chat is reopened", async ({
      page,
    }) => {
      test.skip(!TURNSTILE, "build without NEXT_PUBLIC_TURNSTILE_SITE_KEY");
      let replies = 0;
      const sent = await fakeApi(page, (_body, route) =>
        answer(route, `Answer ${++replies}.`),
      );
      await page.goto("/");
      const launcher = page.locator(".chat-launcher");

      await launcher.click();
      await page.getByLabel("Your message").fill("Hi");
      await page.getByLabel("Your message").press("Enter");
      await expect(page.getByText("Answer 1.")).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await launcher.click();
      await page.getByLabel("Your message").fill("Are you there?");
      await page.getByLabel("Your message").press("Enter");
      await expect(page.getByText("Answer 2.")).toBeVisible();

      expect(sent.map((body) => body.turnstileToken)).toEqual([
        "token-1",
        "token-2",
      ]);
      // A widget per opening; it stays out of sight unless a visitor must act.
      const check = {
        size: "compact",
        appearance: "interaction-only",
        execution: "execute",
      };
      expect(
        await page.evaluate(
          () =>
            (window as unknown as { __turnstileRenders: unknown[] })
              .__turnstileRenders,
        ),
      ).toEqual([check, check]);
    });

    test("a failed human check names Cloudflare's code in the console", async ({
      page,
    }) => {
      test.skip(!TURNSTILE, "build without NEXT_PUBLIC_TURNSTILE_SITE_KEY");
      const warnings: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "warning") warnings.push(message.text());
      });
      // Like the live API, refuse a message that comes without a token.
      const sent = await fakeApi(page, (_body, route) =>
        route.fulfill({ status: 403, json: { reason: "no-token" } }),
      );
      await page.addInitScript(() => {
        (window as unknown as { __turnstileError: string }).__turnstileError =
          "110200";
      });
      await page.goto("/");
      await page.locator(".chat-launcher").click();
      await page.getByLabel("Your message").fill("Hi");
      await page.getByLabel("Your message").press("Enter");
      await expect(page.locator(".chat-message-notice")).toContainText(
        "The message was not sent",
      );
      expect(sent[0]!.turnstileToken).toBeUndefined();
      expect(warnings).toContain("Turnstile error 110200");
    });

    test("Escape closes the chat and returns focus to the button", async ({
      page,
    }) => {
      await page.goto("/");
      const launcher = page.locator(".chat-launcher");
      await launcher.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(launcher).toBeFocused();
      await expect(launcher).toHaveAttribute("aria-expanded", "false");
    });

    test("the open chat is accessible and fits a small phone", async ({
      page,
    }) => {
      await fakeApi(page, (_body, route) => answer(route, "Hello!"));
      for (const url of ["/", "/ru/book/"]) {
        await page.setViewportSize({ width: 320, height: 640 });
        await page.goto(url);
        await page.locator(".chat-launcher").click();
        const panel = page.getByRole("dialog");
        await panel.getByRole("textbox").fill("Hi");
        await panel.getByRole("textbox").press("Enter");
        await expect(panel.locator(".chat-message-assistant")).toHaveCount(2);
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(results.violations, url).toEqual([]);
        const box = await panel.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(320);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
      }
    });
  });
});
