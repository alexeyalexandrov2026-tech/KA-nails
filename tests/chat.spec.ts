import { expect, test, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { approvedChatApiUrl } from "../lib/chat-api-url";
import { channelHref, studioFacts } from "../lib/studio-facts";

// The AI receptionist widget. The API (chat-api/, Azure) is replaced by a
// fake here: these tests check what the page sends and shows. They need a
// build made with NEXT_PUBLIC_CHAT_API_URL (CI's second pass sets it to the
// preview origin); without it only the "no button" check applies.

const CHAT = approvedChatApiUrl(process.env.NEXT_PUBLIC_CHAT_API_URL);
const WHATSAPP = studioFacts.channels
  .filter((c) => c.kind === "whatsapp")
  .map(channelHref)[0];

interface Sent {
  language: string;
  messages: { role: string; content: string }[];
  requestSent: boolean;
}

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
