import { STUDIO_TIME_ZONE, depositHref } from "../../lib/deposit";
import { studioFacts } from "../../lib/studio-facts";
import {
  hashDepositToken,
  newDepositToken,
  uuid,
  type Deposit,
  type DepositStore,
  type PaymentMode,
  type StaffRequest,
} from "./deposit-store";
import { SupabaseError } from "./supabase";
import { BodyTooLarge, readBoundedText } from "./http";

const adminPath = "/staff/deposits";
const staffHeaders = {
  "cache-control": "no-store",
  "content-type": "text/html; charset=utf-8",
  "content-security-policy":
    "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow",
  "referrer-policy": "same-origin",
};

function escape(value: string | number) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char]!,
  );
}

function html(body: string, status = 200) {
  return new Response(
    `<!doctype html><html lang="ru"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Депозиты KA Nails</title></head><body><main>
    <h1>Депозиты KA Nails</h1>${body}
    </main></body></html>`,
    { status, headers: staffHeaders },
  );
}

function back() {
  return `<p><a href="${adminPath}">Вернуться к записям</a></p>`;
}

function form(
  action: string,
  content: string,
  label: string,
  depositId?: string,
) {
  return `<form method="post" action="${adminPath}"><input type="hidden" name="action" value="${action}">
    ${depositId ? `<input type="hidden" name="id" value="${escape(depositId)}">` : ""}
    ${content}<button type="submit">${label}</button></form>`;
}

const localFormat = new Intl.DateTimeFormat("sv-SE", {
  timeZone: STUDIO_TIME_ZONE,
  dateStyle: "short",
  timeStyle: "short",
});
const receiptFormat = new Intl.DateTimeFormat("sv-SE", {
  timeZone: STUDIO_TIME_ZONE,
  dateStyle: "short",
  timeStyle: "medium",
});

export function parseStudioTime(value: string, offset: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) return null;
  const formatter = value.length === 19 ? receiptFormat : localFormat;
  const candidates = ["-04:00", "-05:00"]
    .filter((candidate) => offset === "" || offset === candidate)
    .map((candidate) => new Date(`${value}${candidate}`))
    .filter(
      (date) =>
        Number.isFinite(date.getTime()) &&
        formatter.format(date).replace(" ", "T") === value,
    );
  return candidates.length === 1 ? candidates[0]!.toISOString() : null;
}

function timeFields(name: string, label: string, optional = false) {
  return `<p><label>${label} <input type="datetime-local" name="${name}" ${optional ? 'step="1"' : "required"}></label>
    <label> Смещение при переводе часов <select name="${name}_offset"><option value="">Авто</option>
    <option value="-04:00">EDT (−04:00)</option><option value="-05:00">EST (−05:00)</option></select></label></p>`;
}

const dates =
  timeFields("start", "Начало визита") + timeFields("end", "Конец визита");

function offerForm(request?: StaffRequest) {
  const service = studioFacts.services.find(
    (s) => s.id === request?.service_id,
  );
  const defaultLabel = service?.name.ru ?? "";
  const details = request
    ? `<p>${escape(request.name)} · ${escape(request.phone)} ·
    ${escape(request.preferred_time)} · ${escape(request.language.toUpperCase())}</p>
    <input type="hidden" name="day" value="${escape(request.day)}">
    <input type="hidden" name="request" value="${escape(request.id)}">`
    : "";
  return form(
    "offer",
    `${details}
    <p><label>Услуга или пометка <input name="label" maxlength="150" value="${escape(defaultLabel)}" required></label></p>
    <p><label>Итог в USD <input name="total" type="number" min="5" max="10000" step="0.01" required></label></p>
    ${dates}${timeFields("hold", "Оплатить до")}`,
    "Согласовать время и создать ссылку",
  );
}

const staffStates: Record<Deposit["state"], string> = {
  awaiting: "Ожидает депозит",
  booked: "Запись закреплена",
  expired: "Срок оплаты истёк",
  cancelled: "Отменена",
  retained: "Депозит удержан",
  refund_due: "Требуется возврат",
  refund_pending: "Возврат обрабатывается",
  refunded: "Депозит возвращён",
  review: "Требуется сверка",
};

function depositEntry(
  d: Deposit & { contact: { name: string; phone: string } | null },
) {
  const canChange =
    !d.cancel_at && (d.state === "booked" || d.state === "awaiting");
  const format = (value: string) => escape(localFormat.format(new Date(value)));
  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  });
  return `<li><details><summary>${escape(d.label)} · ${format(d.starts_at)} · ${staffStates[d.state]}</summary>
    ${d.contact ? `<p>${escape(d.contact.name)} · ${escape(d.contact.phone)}</p>` : ""}
    <p>Визит до ${format(d.ends_at)}. Оплатить до ${format(d.hold_until)}. Депозит ${money.format(d.amount / 100)} из ${money.format(d.total / 100)}.</p>
    ${d.cancel_at ? `<p>Уведомление об отмене получено ${format(d.cancel_at)}.</p>` : ""}
    ${
      d.attempt
        ? `<p>${escape(d.attempt.provider)} · ${escape(d.attempt.mode)} · ${escape(d.attempt.state)}
      ${d.attempt.payment_id ? ` · ${escape(d.attempt.payment_id)}` : ""}</p>`
        : ""
    }
    ${form("share", "", "Получить новую ссылку", d.id)}
    ${d.state === "booked" ? form("move", dates, "Перенести с депозитом", d.id) : ""}
    ${
      canChange
        ? form(
            "cancel",
            `<p><label>Причина <select name="reason">
      <option value="client">Отмена клиентом</option><option value="studio">Отмена студией</option>
      <option value="no_show">Неявка</option></select></label></p>
      ${timeFields("received", "Когда студия получила уведомление (пусто — сейчас)", true)}`,
            "Записать отмену",
            d.id,
          )
        : ""
    }
    ${
      d.state === "refund_due"
        ? form(
            "refund",
            `<p><label><input type="checkbox" name="confirm" value="yes" required>
      Подтверждаю полный возврат ${money.format(d.amount / 100)}</label></p>`,
            "Оформить возврат",
            d.id,
          )
        : ""
    }
    ${d.attempt && d.attempt.state !== "closed" ? form("reconcile", "", "Сверить с платёжной системой", d.id) : ""}
    </details></li>`;
}

interface StaffConfig {
  audience: string;
  emails: string[];
  siteOrigin: string;
  canOffer: boolean;
  mode: PaymentMode;
  reconcile(deposit: Deposit): Promise<void>;
}

export async function handleDepositAdmin(
  request: Request,
  access: CloudflareAccessContext | undefined,
  store: DepositStore,
  config: StaffConfig,
) {
  const url = new URL(request.url);
  if (url.pathname !== adminPath) return new Response(null, { status: 404 });
  if (!access || access.aud !== config.audience)
    return html("<p>Требуется вход мастера.</p>", 403);
  const email = (await access.getIdentity())?.email?.toLowerCase();
  if (!email || !config.emails.includes(email))
    return html("<p>Доступ закрыт.</p>", 403);

  if (request.method === "GET") {
    const items = await store.staffList();
    return html(`<p>Время студии — Нью-Йорк. Согласуйте время и стоимость с клиентом перед отправкой ссылки.</p>
      ${
        config.canOffer
          ? `<details><summary>Запись из WhatsApp или по телефону</summary>${offerForm()}</details>
      <h2>Заявки из чата</h2><ul>${items.requests
        .map(
          (r) =>
            `<li><details><summary>${escape(r.name)} · ${escape(r.preferred_time)}</summary>${offerForm(r)}</details></li>`,
        )
        .join("")}</ul>`
          : "<p>Создание новых депозитов приостановлено.</p>"
      }
      <h2>Согласованные записи</h2><ul>${items.deposits.map(depositEntry).join("")}</ul>`);
  }
  if (request.method !== "POST")
    return new Response(null, { status: 405, headers: { Allow: "GET, POST" } });
  if (
    request.headers.get("origin") !== url.origin ||
    !request.headers
      .get("content-type")
      ?.startsWith("application/x-www-form-urlencoded")
  )
    return html("<p>Запрос отклонён.</p>", 403);

  let fields: URLSearchParams;
  try {
    fields = new URLSearchParams(await readBoundedText(request, 8192));
  } catch (error) {
    return error instanceof BodyTooLarge
      ? html("<p>Запрос слишком большой.</p>", 413)
      : html("<p>Запрос отклонён.</p>", 400);
  }
  const field = (name: string) => fields.get(name)?.trim() ?? "";
  const time = (name: string) =>
    parseStudioTime(field(name), field(`${name}_offset`));
  const error = (message = "Проверьте заполненные поля.") =>
    html(`<p>${message}</p>${back()}`, 422);
  const share = (token: string) =>
    html(`<p>Отправьте клиенту ссылку в согласованном канале.</p>
    <p><a href="${escape(config.siteOrigin + depositHref("ru", token))}">Ссылка на русском</a></p>
    <p><a href="${escape(config.siteOrigin + depositHref("en", token))}">Link in English</a></p>${back()}`);

  try {
    const action = field("action");
    if (action === "offer") {
      if (!config.canOffer)
        return error("Создание новых депозитов приостановлено.");
      const [whole, fraction = ""] = field("total").split(".");
      const total = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
      const start = time("start");
      const end = time("end");
      const hold = time("hold");
      const label = field("label");
      const day = field("day");
      const requestId = field("request");
      if (
        !/^\d{1,5}(?:\.\d{1,2})?$/.test(field("total")) ||
        total < 500 ||
        total > 1_000_000 ||
        !start ||
        !end ||
        !hold ||
        end <= start ||
        hold > start ||
        !label ||
        label.length > 150 ||
        ((day || requestId) &&
          (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !uuid(requestId)))
      )
        return error();
      const token = newDepositToken();
      await store.offer(
        {
          id: crypto.randomUUID(),
          day: day || null,
          requestId: requestId || null,
          label,
          startsAt: start,
          endsAt: end,
          holdUntil: hold,
          total,
          shareHash: await hashDepositToken(token),
          mode: config.mode,
        },
        email,
      );
      return share(token);
    }

    const id = field("id");
    if (!uuid(id)) return error();
    if (action === "reconcile") {
      const d = await store.staffRecord(id);
      if (!d) return error("Запись недоступна.");
      await config.reconcile(d);
      return new Response(null, {
        status: 303,
        headers: { ...staffHeaders, location: adminPath },
      });
    }
    if (action === "share") {
      const token = newDepositToken();
      const d = await store.staffUpdate(id, email, "share", {
        shareHash: await hashDepositToken(token),
      });
      return d ? share(token) : error("Запись недоступна.");
    }
    let changed: Deposit | null;
    if (action === "move") {
      const start = time("start");
      const end = time("end");
      if (!start || !end || end <= start) return error();
      changed = await store.staffUpdate(id, email, "move", { at: start, end });
    } else if (action === "cancel") {
      const reason = field("reason");
      const at = time("received");
      if (
        !["client", "studio", "no_show"].includes(reason) ||
        (field("received") && !at)
      )
        return error();
      changed = await store.staffUpdate(id, email, "cancel", {
        at: at ?? undefined,
        reason,
      });
    } else if (action === "refund" && field("confirm") === "yes") {
      changed = await store.staffUpdate(id, email, "refund");
    } else {
      return error();
    }
    if (changed && action === "refund") {
      try {
        await config.reconcile(changed);
      } catch {
        // The database retains the refund intent for scheduled retry.
      }
    }
    return changed
      ? new Response(null, {
          status: 303,
          headers: { ...staffHeaders, location: adminPath },
        })
      : error("Эта операция недоступна для текущего состояния записи.");
  } catch (cause) {
    if (
      cause instanceof SupabaseError &&
      (cause.status === 409 || cause.code === "23P01")
    ) {
      return error("Запись уже существует или это время занято.");
    }
    if (cause instanceof SupabaseError && cause.status === 400) return error();
    throw cause;
  }
}
