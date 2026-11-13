import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { DEPOSIT_TERMS_VERSION } from "../../lib/deposit";
import { handleDepositAdmin, parseStudioTime } from "../src/deposit-admin";
import { depositStore, type Deposit } from "../src/deposit-store";
import { depositService } from "../src/deposits";
import type { Gateway } from "../src/payment-gateways";

const db = new PGlite();
const rpcCalls: string[] = [];
const migrations = new URL("../../supabase/migrations/", import.meta.url);
const store = depositStore(
  "https://test.supabase.co",
  "local-secret",
  async (input, init) => {
    const fn = String(input).split("/").at(-1)!;
    assert.match(fn, /^ka_nails_[a-z_]+$/);
    const args: Record<string, unknown> = JSON.parse(String(init?.body));
    const keys = Object.keys(args);
    assert.ok(keys.every((key) => /^p_[a-z_]+$/.test(key)));
    const sql = `select * from public.${fn}(${keys.map((key, index) => `${key} => $${index + 1}`).join(", ")}) as value`;
    rpcCalls.push(fn);
    try {
      const result = await db.query<{ value: unknown }>(
        sql,
        Object.values(args),
      );
      if (fn.endsWith("_offer") || fn.endsWith("_observe"))
        return new Response(null, { status: 204 });
      return Response.json(
        fn.endsWith("_due")
          ? result.rows.map((row) => row.value)
          : (result.rows[0]?.value ?? null),
      );
    } catch (error) {
      if ((error as { code?: string }).code?.startsWith("23"))
        return new Response(null, { status: 409 });
      throw error;
    }
  },
);

before(async () => {
  await db.exec(
    "create role anon; create role authenticated; create role service_role bypassrls",
  );
  for (const migration of (await readdir(migrations)).sort()) {
    await db.exec(await readFile(new URL(migration, migrations), "utf8"));
  }
  await db.exec("set role service_role");
});

after(() => db.close());

const now = Date.now();
const iso = (minutes: number) => new Date(now + minutes * 60_000).toISOString();
const newHash = () => crypto.randomUUID().replaceAll("-", "").repeat(2);
const staff = "staff@example.test";

async function offer(
  start: number,
  holdUntil = iso(start - 30),
  hash = newHash(),
) {
  const id = crypto.randomUUID();
  await store.offer(
    {
      id,
      day: null,
      requestId: null,
      label: "Classic Pedicure",
      startsAt: iso(start),
      endsAt: iso(start + 60),
      holdUntil,
      total: 7555,
      shareHash: hash,
      mode: "sandbox",
    },
    staff,
  );
  return { id, hash };
}

async function attach(d: { id: string }, provider: "stripe" | "paypal") {
  const result = await store.reserve(
    d.id,
    provider,
    "sandbox",
    "en",
    DEPOSIT_TERMS_VERSION,
  );
  assert.ok(result?.attempt);
  const a = result.attempt;
  const session = await store.step(
    d.id,
    a.id,
    "attach",
    a.id,
    "https://checkout.stripe.com/c/pay/test",
  );
  assert.ok(session?.attempt);
  return session.attempt;
}

async function paid(d: { id: string }, attemptId: string, paidAt = iso(-1)) {
  await store.observe(
    d.id,
    attemptId,
    { state: "paid", paymentId: `payment-${attemptId}`, paidAt },
    `event-${attemptId}`,
  );
}

async function state(hash: string) {
  const d = await store.lookup(hash);
  assert.ok(d && d !== "waiting");
  return d;
}

test("migration is additive, access stays private and duplicate phone cannot inherit capability", async () => {
  const day = new Date(now).toISOString().slice(0, 10);
  const first = newHash();
  const duplicate = newHash();
  const request = crypto.randomUUID();
  const begin = (id: string, hash: string) =>
    db.query<{ value: string }>(
      "select public.ka_nails_chat_begin_request_with_access($1,$2,'classic',ARRAY[]::text[],'tomorrow','Test','+15550100101','','en',20,$3) as value",
      [id, iso(0), hash],
    );
  assert.equal((await begin(request, first)).rows[0]?.value, "created");
  assert.equal(
    (await begin(crypto.randomUUID(), duplicate)).rows[0]?.value,
    "pending",
  );
  assert.equal(await store.lookup(first), "waiting");
  assert.equal(await store.lookup(duplicate), null);
  const link = newHash();
  const id = crypto.randomUUID();
  await store.offer(
    {
      id,
      day,
      requestId: request,
      label: "Classic Pedicure",
      startsAt: iso(120),
      endsAt: iso(180),
      holdUntil: iso(75),
      total: 7555,
      shareHash: link,
      mode: "sandbox",
    },
    staff,
  );
  assert.equal((await state(first)).id, id);
  assert.equal((await state(link)).amount, 756);
  assert.equal(
    (await store.staffList()).deposits.find((d) => d.id === id)?.contact?.name,
    "Test",
  );
  await db.exec("set role anon");
  try {
    await assert.rejects(
      () => db.query("select public.ka_nails_deposit_lookup($1)", [first]),
      /permission denied/,
    );
    await assert.rejects(
      () => db.query("select * from ka_nails.deposits"),
      /permission denied/,
    );
  } finally {
    await db.exec("set role service_role");
  }
});

test("one active checkout, stale PayPal approval fenced, and duplicate paid events are stable", async () => {
  const d = await offer(240);
  assert.equal(
    await store.reserve(d.id, "stripe", "live", "en", DEPOSIT_TERMS_VERSION),
    null,
  );
  const attempts = await Promise.all([
    store.reserve(d.id, "paypal", "sandbox", "en", DEPOSIT_TERMS_VERSION),
    store.reserve(d.id, "stripe", "sandbox", "en", DEPOSIT_TERMS_VERSION),
  ]);
  assert.equal(attempts[0]?.attempt?.id, attempts[1]?.attempt?.id);
  const first = (await state(d.hash)).attempt!;
  assert.equal(first.provider, "paypal");
  await store.step(
    d.id,
    first.id,
    "attach",
    first.id,
    "https://www.sandbox.paypal.com/checkoutnow",
  );
  await store.step(d.id, first.id, "close");
  assert.equal(await store.step(d.id, first.id, "capture"), null);
  await store.observe(d.id, first.id, { state: "closed" });
  const stripe = await attach(d, "stripe");
  await paid(d, first.id);
  assert.equal((await state(d.hash)).state, "awaiting");
  await paid(d, stripe.id);
  await paid(d, stripe.id);
  await store.observe(d.id, stripe.id, { state: "closed" }, "evt_out_of_order");
  assert.equal((await state(d.hash)).state, "booked");
  const count = await db.query<{ count: number }>(
    "select count(*)::int from ka_nails.deposit_events where attempt_id = $1",
    [stripe.id],
  );
  assert.equal(count.rows[0]?.count, 2);
});

test("overlap is rejected, deposit survives a move, and exactly 60 minutes yields full refund", async () => {
  const d = await offer(360);
  await assert.rejects(() => offer(390), /Supabase rejected/);
  const a = await attach(d, "stripe");
  await paid(d, a.id);
  const moved = await store.staffUpdate(d.id, staff, "move", {
    at: iso(530),
    end: iso(600),
  });
  assert.equal(moved?.attempt?.payment_id, `payment-${a.id}`);
  // SQL rejects a future cancellation receipt. Move the test clock's slot backward
  // to exercise the policy using real database time and deterministic timestamps.
  await db.query(
    "update ka_nails.deposits set starts_at=$2, ends_at=$3, hold_until=$4 where id=$1",
    [d.id, iso(50), iso(60), iso(-20)],
  );
  const cancel = await store.staffUpdate(d.id, staff, "cancel", {
    at: iso(-10),
    reason: "client",
  });
  assert.equal(cancel?.state, "refund_due");
  assert.equal(
    (await store.staffUpdate(d.id, staff, "refund"))?.state,
    "refund_pending",
  );
  assert.equal(await store.staffUpdate(d.id, staff, "refund"), null);
  await store.observe(d.id, a.id, {
    state: "refunded",
    paymentId: a.id && `payment-${a.id}`,
    refundId: "refund-1",
  });
  await store.observe(d.id, a.id, {
    state: "review",
    paymentId: `payment-${a.id}`,
  });
  assert.equal((await state(d.hash)).state, "refunded");
});

test("59:59 cancellation keeps the deposit, but a studio cancellation calls for full refund", async () => {
  for (const [offset, reason, expected] of [
    [650, "client", "retained"],
    [750, "studio", "refund_due"],
  ] as const) {
    const d = await offer(offset);
    const a = await attach(d, "paypal");
    await paid(d, a.id, iso(-120));
    await db.query(
      "update ka_nails.deposits set starts_at=$2, ends_at=$3, hold_until=$4 where id=$1",
      [d.id, iso(45), iso(55), iso(-60)],
    );
    const at = new Date(now - 15 * 60_000 + 1000).toISOString();
    assert.equal(
      (await store.staffUpdate(d.id, staff, "cancel", { at, reason }))?.state,
      expected,
    );
  }
});

test("late capture goes to refund instead of securing a time, and opening switch stays fenced", async () => {
  const d = await offer(850);
  const a = await attach(d, "stripe");
  const inspection: Gateway["inspect"] = async () => ({ state: "open" });
  const fake: Gateway = {
    create: async () => {
      throw new Error("unexpected create");
    },
    refund: async () => {
      throw new Error("unexpected refund");
    },
    inspect: inspection,
    event: async () => null,
  };
  const service = depositService(
    store,
    {
      enabled: true,
      mode: "sandbox",
      siteOrigin: "https://example.test",
      gateways: { stripe: fake, paypal: fake },
    },
    () => {},
  );
  assert.equal(await service.checkout(d.hash, "paypal", "en"), null);
  assert.equal((await state(d.hash)).attempt?.state, "closing");
  await paid(d, a.id, iso(851));
  assert.equal((await state(d.hash)).state, "refund_due");
});

test("PayPal capture after deadline is inspected only, and early webhook dedup stays recoverable", async () => {
  const d = await offer(950);
  const a = await attach(d, "paypal");
  const claim = await store.step(d.id, a.id, "capture");
  assert.equal(claim?.attempt?.state, "capturing");
  assert.equal(await store.step(d.id, a.id, "capture"), null);
  await db.query("update ka_nails.deposits set hold_until=$2 where id=$1", [
    d.id,
    iso(-1),
  ]);
  let captures = 0;
  const fake: Gateway = {
    create: async () => {
      throw new Error("unexpected create");
    },
    refund: async () => {
      throw new Error("unexpected refund");
    },
    inspect: async () => ({ state: "approved" }),
    capture: async () => {
      captures++;
      return { state: "approved" };
    },
    event: async () => null,
  };
  const service = depositService(
    store,
    {
      enabled: true,
      mode: "sandbox",
      siteOrigin: "https://example.test",
      gateways: { stripe: fake, paypal: fake },
    },
    () => {},
  );
  await service.refresh(d.hash);
  assert.equal(captures, 0);
  assert.equal((await state(d.hash)).attempt?.state, "capturing");

  const d2 = await offer(1050);
  const b = (
    await store.reserve(d2.id, "stripe", "sandbox", "en", DEPOSIT_TERMS_VERSION)
  )?.attempt;
  assert.ok(b);
  await paid(d2, b.id);
  await store.step(
    d2.id,
    b.id,
    "attach",
    b.id,
    "https://checkout.stripe.com/c/pay/test",
  );
  await paid(d2, b.id);
  assert.equal((await state(d2.hash)).state, "booked");
});

test("foreign return references cannot reconcile a different deposit", async () => {
  const d = await offer(1150);
  await attach(d, "stripe");
  let inspections = 0;
  const fake: Gateway = {
    inspect: async () => {
      inspections++;
      return { state: "open" };
    },
    create: async () => {
      throw new Error("unexpected create");
    },
    refund: async () => {
      throw new Error("unexpected refund");
    },
    event: async () => null,
  };
  const service = depositService(
    store,
    {
      enabled: true,
      mode: "sandbox",
      siteOrigin: "https://example.test",
      gateways: { stripe: fake, paypal: fake },
    },
    () => {},
  );
  await service.refresh(d.hash, crypto.randomUUID());
  assert.equal(inspections, 0);
  await service.refresh(d.hash, (await state(d.hash)).attempt!.id);
  assert.equal(inspections, 1);
});

test("a verified pending refund can arrive before the first paid event", async () => {
  const d = await offer(1250);
  const a = await attach(d, "stripe");
  const paymentId = `payment-${a.id}`;
  await store.observe(
    d.id,
    a.id,
    { state: "refund_pending", paymentId, refundId: "refund-early" },
    "refund-first",
  );
  const pending = await state(d.hash);
  assert.equal(pending.state, "refund_pending");
  assert.equal(pending.attempt?.payment_id, paymentId);
  await paid(d, a.id);
  assert.equal((await state(d.hash)).state, "refund_pending");
  await store.observe(d.id, a.id, {
    state: "refunded",
    paymentId,
    refundId: "refund-early",
  });
  assert.equal((await state(d.hash)).state, "refunded");
});

test("staff Eastern time rejects DST gaps and requires an explicit offset at an overlap", () => {
  assert.equal(parseStudioTime("2027-03-14T02:30", ""), null);
  assert.equal(parseStudioTime("2027-11-07T01:30", ""), null);
  assert.equal(
    parseStudioTime("2027-11-07T01:30", "-05:00"),
    "2027-11-07T06:30:00.000Z",
  );
  assert.equal(
    parseStudioTime("2027-01-07T13:30", ""),
    "2027-01-07T18:30:00.000Z",
  );
  assert.equal(
    parseStudioTime("2027-01-07T13:30:01", ""),
    "2027-01-07T18:30:01.000Z",
  );
});

test("staff route requires the expected Access audience and exact identity", async () => {
  const url = "https://worker.example.test/staff/deposits";
  const config = {
    audience: "test-audience",
    emails: [staff],
    siteOrigin: "https://site.example.test",
    canOffer: true,
    mode: "sandbox" as const,
    async reconcile() {},
  };
  const access = (aud: string, email: string): CloudflareAccessContext => ({
    aud,
    async getIdentity() {
      return { email };
    },
  });
  for (const identity of [
    undefined,
    access("other", staff),
    access(config.audience, "visitor@example.test"),
  ]) {
    assert.equal(
      (await handleDepositAdmin(new Request(url), identity, store, config))
        .status,
      403,
    );
  }
  const owner = access(config.audience, staff.toUpperCase());
  const dashboard = await handleDepositAdmin(
    new Request(url),
    owner,
    store,
    config,
  );
  assert.equal(dashboard.status, 200);
  assert.match(await dashboard.text(), /Депозиты KA Nails/);
  const post = (origin: string) =>
    new Request(url, {
      method: "POST",
      headers: { origin },
      body: new URLSearchParams({ action: "offer" }),
    });
  assert.equal(
    (
      await handleDepositAdmin(
        post("https://other.example.test"),
        owner,
        store,
        config,
      )
    ).status,
    403,
  );
  assert.equal(
    (await handleDepositAdmin(post(new URL(url).origin), owner, store, config))
      .status,
    422,
  );
});
