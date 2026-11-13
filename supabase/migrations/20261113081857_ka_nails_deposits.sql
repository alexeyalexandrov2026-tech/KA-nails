alter table ka_nails.booking_requests
  add column deposit_access_hash text unique,
  add constraint booking_request_access_hash_format
    check (deposit_access_hash ~ '^[0-9a-f]{64}$');

create table ka_nails.deposits (
  id uuid primary key,
  request_day date,
  request_id text,
  label text not null check (length(label) between 1 and 150),
  mode text not null check (mode in ('sandbox', 'live')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  hold_until timestamptz not null,
  total integer not null check (total between 500 and 1000000),
  amount integer generated always as ((total + 5) / 10) stored,
  state text not null default 'awaiting' check (state in
    ('awaiting', 'booked', 'expired', 'cancelled', 'retained', 'refund_due',
      'refund_pending', 'refunded', 'review')),
  share_hash text not null unique check (share_hash ~ '^[0-9a-f]{64}$'),
  share_until timestamptz not null,
  cancel_at timestamptz,
  cancel_reason text check (cancel_reason in ('client', 'studio', 'no_show', 'late_payment')),
  created_at timestamptz not null default now(),
  checked_at timestamptz not null default '-infinity',
  foreign key (request_day, request_id) references ka_nails.booking_requests(day, id) match full,
  check (starts_at < ends_at and hold_until <= starts_at),
  check ((cancel_at is null) = (cancel_reason is null)),
  exclude using gist (tstzrange(starts_at, ends_at, '[)') with &&)
    where (state in ('awaiting', 'booked') or (state = 'review' and cancel_at is null))
);

create unique index deposit_open_request on ka_nails.deposits (request_day, request_id)
  where state in ('awaiting', 'booked') or (state = 'review' and cancel_at is null);

create table ka_nails.deposit_attempts (
  id uuid primary key,
  deposit_id uuid not null references ka_nails.deposits(id),
  provider text not null check (provider in ('paypal', 'stripe')),
  mode text not null check (mode in ('sandbox', 'live')),
  terms text not null,
  locale text not null check (locale in ('en', 'ru')),
  state text not null default 'creating' check (state in
    ('creating', 'open', 'closing', 'capturing', 'processing', 'closed', 'paid')),
  provider_id text,
  checkout_url text,
  payment_id text,
  refund_id text,
  capture_started_at timestamptz,
  capture_claimed_at timestamptz,
  refund_started_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  unique (provider, mode, provider_id),
  unique (provider, mode, payment_id),
  unique (provider, mode, refund_id),
  check ((provider_id is null) = (checkout_url is null))
);

create unique index deposit_one_attempt on ka_nails.deposit_attempts (deposit_id)
  where state <> 'closed';
create index deposit_attempt_history on ka_nails.deposit_attempts (deposit_id, created_at desc);

create table ka_nails.deposit_events (
  provider text not null check (provider in ('paypal', 'stripe')),
  mode text not null check (mode in ('sandbox', 'live')),
  event_id text not null,
  attempt_id uuid not null references ka_nails.deposit_attempts(id),
  received_at timestamptz not null default now(),
  primary key (provider, mode, event_id)
);

create table ka_nails.deposit_actions (
  id bigint generated always as identity primary key,
  deposit_id uuid not null references ka_nails.deposits(id),
  actor text not null,
  action text not null,
  acted_at timestamptz not null default now()
);

alter table ka_nails.deposits enable row level security;
alter table ka_nails.deposit_attempts enable row level security;
alter table ka_nails.deposit_events enable row level security;
alter table ka_nails.deposit_actions enable row level security;
grant select, insert, update on ka_nails.deposits, ka_nails.deposit_attempts to service_role;
grant select, insert on ka_nails.deposit_events, ka_nails.deposit_actions to service_role;

create function ka_nails.deposit_record(p_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select to_jsonb(d) || jsonb_build_object('attempt', (
    select to_jsonb(a) from ka_nails.deposit_attempts a where a.deposit_id = d.id
    order by (a.state <> 'closed') desc, a.created_at desc, a.id desc limit 1
  ))
  from ka_nails.deposits d where d.id = p_id;
$$;

create function public.ka_nails_chat_begin_request_with_access(
  p_id text, p_received_at timestamptz, p_service_id text, p_add_on_ids text[],
  p_preferred_time text, p_name text, p_phone text, p_notes text, p_language text,
  p_limit integer, p_access_hash text
) returns text language plpgsql security invoker set search_path = '' as $$
declare
  result text;
begin
  result := public.ka_nails_chat_begin_request(p_id, p_received_at, p_service_id,
    p_add_on_ids, p_preferred_time, p_name, p_phone, p_notes, p_language, p_limit);
  if result = 'created' then
    update ka_nails.booking_requests set deposit_access_hash = p_access_hash
      where day = (p_received_at at time zone 'UTC')::date and id = p_id;
  end if;
  return result;
end;
$$;

create function public.ka_nails_deposit_lookup(p_hash text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with matches as (
    select id, created_at from ka_nails.deposits
      where share_hash = p_hash and share_until > now()
    union
    select d.id, d.created_at from ka_nails.deposits d
      join ka_nails.booking_requests r on (r.day, r.id) = (d.request_day, d.request_id)
      where r.deposit_access_hash = p_hash and r.received_at > now() - interval '7 days'
  )
  select coalesce(
    (select ka_nails.deposit_record(id) from matches order by created_at desc, id desc limit 1),
    (select '{"waiting":true}'::jsonb from ka_nails.booking_requests
      where deposit_access_hash = p_hash and received_at > now() - interval '7 days')
  );
$$;

create function public.ka_nails_deposit_provider_ref(
  p_provider text, p_mode text, p_provider_id text, p_payment_id text, p_attempt_id uuid
) returns jsonb language sql stable security invoker set search_path = '' as $$
  select ka_nails.deposit_record(a.deposit_id) from ka_nails.deposit_attempts a
  where a.provider = p_provider and a.mode = p_mode
    and (a.provider_id = p_provider_id or a.payment_id = p_payment_id or a.id = p_attempt_id)
    and a.state <> 'closed'
  limit 1;
$$;

create function public.ka_nails_deposit_offer(
  p_id uuid, p_request_day date, p_request_id text, p_label text, p_starts_at timestamptz,
  p_ends_at timestamptz, p_hold_until timestamptz, p_total integer, p_share_hash text, p_actor text, p_mode text
) returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_hold_until <= clock_timestamp() then
    raise exception 'Payment deadline has passed' using errcode = '22023';
  end if;
  insert into ka_nails.deposits (
    id, request_day, request_id, label, mode, starts_at, ends_at, hold_until, total, share_hash, share_until
  ) values (p_id, p_request_day, p_request_id, p_label, p_mode, p_starts_at, p_ends_at,
    p_hold_until, p_total, p_share_hash, p_starts_at + interval '7 days');
  insert into ka_nails.deposit_actions (deposit_id, actor, action)
    values (p_id, p_actor, 'offer');
end;
$$;

create function public.ka_nails_deposit_staff_list()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'deposits', (select coalesce(jsonb_agg(item), '[]') from (
      select ka_nails.deposit_record(d.id) || jsonb_build_object('contact',
        case when r.id is not null then jsonb_build_object('name', r.name, 'phone', r.phone) end) as item
      from ka_nails.deposits d
      left join ka_nails.booking_requests r on (r.day, r.id) = (d.request_day, d.request_id)
      where d.starts_at > now() - interval '30 days' or d.state in ('review', 'refund_due', 'refund_pending')
      order by (d.state in ('review', 'refund_due', 'refund_pending')) desc, d.starts_at desc limit 100
    ) entries),
    'requests', (select coalesce(jsonb_agg(to_jsonb(item)), '[]') from (
      select r.day, r.id, r.name, r.phone, r.preferred_time, r.service_id, r.add_on_ids, r.language
      from ka_nails.booking_requests r where r.received_at > now() - interval '14 days'
        and not exists (select 1 from ka_nails.deposits d
          where (d.request_day, d.request_id) = (r.day, r.id)
            and (d.state in ('awaiting', 'booked') or (d.state = 'review' and d.cancel_at is null)))
      order by r.received_at desc limit 100
    ) item)
  );
$$;

create function public.ka_nails_deposit_staff_update(
  p_id uuid, p_action text, p_actor text, p_at timestamptz, p_end timestamptz,
  p_reason text, p_share_hash text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  d ka_nails.deposits%rowtype;
  effective_at timestamptz := coalesce(p_at, clock_timestamp());
begin
  select * into d from ka_nails.deposits where id = p_id for update;
  if not found then return null; end if;
  if p_action = 'share' then
    update ka_nails.deposits set share_hash = p_share_hash,
      share_until = greatest(starts_at, clock_timestamp()) + interval '7 days' where id = p_id;
  elsif p_action = 'move' and d.state = 'booked' and p_at > clock_timestamp() then
    update ka_nails.deposits set starts_at = p_at, ends_at = p_end,
      hold_until = least(hold_until, p_at), share_until = greatest(share_until, p_at + interval '7 days')
      where id = p_id;
  elsif p_action = 'cancel' and d.state in ('awaiting', 'booked') and d.cancel_at is null
    and p_reason in ('client', 'studio', 'no_show') and effective_at <= clock_timestamp()
    and (p_reason <> 'no_show' or effective_at >= d.starts_at) then
    update ka_nails.deposits set cancel_at = effective_at, cancel_reason = p_reason,
      state = case
        when d.state = 'booked' then
          case when p_reason = 'studio' or (p_reason = 'client' and effective_at <= d.starts_at - interval '1 hour')
            then 'refund_due' else 'retained' end
        when exists (select 1 from ka_nails.deposit_attempts
          where deposit_id = p_id and state <> 'closed') then 'awaiting'
        else 'cancelled' end
      where id = p_id;
  elsif p_action = 'refund' and d.state = 'refund_due' then
    update ka_nails.deposit_attempts set refund_started_at = clock_timestamp()
      where deposit_id = p_id and state = 'paid' and payment_id is not null;
    if not found then return null; end if;
    update ka_nails.deposits set state = 'refund_pending' where id = p_id;
  else
    return null;
  end if;
  insert into ka_nails.deposit_actions (deposit_id, actor, action)
    values (p_id, p_actor, p_action);
  return ka_nails.deposit_record(p_id);
end;
$$;

create function public.ka_nails_deposit_staff_record(p_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select ka_nails.deposit_record(p_id);
$$;

create function public.ka_nails_deposit_reserve(
  p_id uuid, p_attempt uuid, p_provider text, p_mode text, p_locale text, p_terms text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  d ka_nails.deposits%rowtype;
begin
  select * into d from ka_nails.deposits where id = p_id for update;
  if not found or d.state <> 'awaiting' or d.mode <> p_mode or d.cancel_at is not null
    or d.hold_until <= clock_timestamp() then return null; end if;
  insert into ka_nails.deposit_attempts (id, deposit_id, provider, mode, locale, terms)
    select p_attempt, p_id, p_provider, p_mode, p_locale, p_terms
    where not exists (select 1 from ka_nails.deposit_attempts
      where deposit_id = p_id and state <> 'closed');
  return ka_nails.deposit_record(p_id);
end;
$$;

-- Provider work is fenced before I/O. A losing worker cannot capture or switch.
create function public.ka_nails_deposit_step(
  p_id uuid, p_attempt uuid, p_action text, p_reference text, p_url text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  d ka_nails.deposits%rowtype;
  a ka_nails.deposit_attempts%rowtype;
begin
  select * into d from ka_nails.deposits where id = p_id for update;
  if not found or d.state <> 'awaiting' then return null; end if;
  select * into a from ka_nails.deposit_attempts where id = p_attempt and deposit_id = p_id;
  if not found then return null; end if;
  if p_action = 'attach' and a.state = 'creating' then
    update ka_nails.deposit_attempts set provider_id = p_reference, checkout_url = p_url,
      state = 'open' where id = p_attempt;
  elsif p_action = 'attach' and a.state = 'open' and a.provider_id = p_reference then
    return ka_nails.deposit_record(p_id);
  elsif p_action = 'abandon' and a.state = 'creating' then
    -- The checkout URL is returned only after attach. An unattached order has no payer.
    update ka_nails.deposit_attempts set state = 'closed' where id = p_attempt;
    if d.cancel_at is not null or d.hold_until <= clock_timestamp() then
      update ka_nails.deposits set state = case when cancel_at is null then 'expired' else 'cancelled' end
        where id = p_id;
    end if;
  elsif p_action = 'close' and a.state in ('open', 'closing') then
    update ka_nails.deposit_attempts set state = 'closing' where id = p_attempt;
  elsif p_action = 'capture' and a.provider = 'paypal' and (a.state = 'open' or (
    a.state = 'capturing' and a.capture_claimed_at < clock_timestamp() - interval '30 seconds'
  ))
    and d.cancel_at is null and d.hold_until > clock_timestamp() then
    update ka_nails.deposit_attempts set state = 'capturing',
      capture_started_at = coalesce(capture_started_at, clock_timestamp()),
      capture_claimed_at = clock_timestamp() where id = p_attempt;
  else
    return null;
  end if;
  return ka_nails.deposit_record(p_id);
end;
$$;

create function public.ka_nails_deposit_observe(
  p_id uuid, p_attempt uuid, p_result text, p_payment_id text, p_refund_id text,
  p_paid_at timestamptz, p_event_id text
) returns void language plpgsql security invoker set search_path = '' as $$
declare
  d ka_nails.deposits%rowtype;
  a ka_nails.deposit_attempts%rowtype;
begin
  select * into d from ka_nails.deposits where id = p_id for update;
  if not found then return; end if;
  select * into a from ka_nails.deposit_attempts where id = p_attempt and deposit_id = p_id;
  if not found or a.state in ('closed', 'creating') then return; end if;
  if p_event_id is not null then
    insert into ka_nails.deposit_events (provider, mode, event_id, attempt_id)
      values (a.provider, a.mode, p_event_id, a.id) on conflict do nothing;
    if not found then return; end if;
  end if;
  if p_payment_id is not null and a.payment_id is not null and a.payment_id <> p_payment_id then
    raise exception 'Payment reference mismatch' using errcode = '22023';
  end if;

  if p_result = 'closed' and a.state in ('open', 'closing', 'processing', 'capturing') then
    update ka_nails.deposit_attempts set state = 'closed' where id = p_attempt;
    if d.cancel_at is not null or d.hold_until <= clock_timestamp() then
      update ka_nails.deposits set state = case when cancel_at is null then 'expired' else 'cancelled' end
        where id = p_id and state = 'awaiting';
    end if;
  elsif p_result = 'processing' and a.state in ('open', 'closing', 'capturing', 'processing') then
    update ka_nails.deposit_attempts set state = 'processing',
      payment_id = coalesce(p_payment_id, payment_id) where id = p_attempt;
  elsif p_result = 'paid' and a.state in ('open', 'closing', 'capturing', 'processing')
    and d.state = 'awaiting' and p_payment_id is not null and p_paid_at is not null then
    update ka_nails.deposit_attempts set state = 'paid', payment_id = p_payment_id where id = p_attempt;
    update ka_nails.deposits set
      state = case
        when p_paid_at > hold_until then 'refund_due'
        when p_paid_at > cancel_at then 'refund_due'
        when cancel_reason = 'studio' then 'refund_due'
        when cancel_reason = 'client' and cancel_at <= starts_at - interval '1 hour' then 'refund_due'
        when cancel_at is not null then 'retained'
        else 'booked' end,
      cancel_at = coalesce(cancel_at, case when p_paid_at > hold_until then clock_timestamp() end),
      cancel_reason = coalesce(cancel_reason, case when p_paid_at > hold_until then 'late_payment' end)
      where id = p_id;
  elsif p_result in ('refunded', 'review') and p_payment_id is not null
    and a.state in ('open', 'closing', 'capturing', 'processing', 'paid') then
    update ka_nails.deposit_attempts set state = 'paid', payment_id = p_payment_id,
      refund_id = coalesce(p_refund_id, refund_id) where id = p_attempt;
    update ka_nails.deposits set state = p_result where id = p_id and state <> 'refunded';
  elsif p_result = 'refund_pending' and a.state = 'paid' and d.state = 'refund_pending' then
    update ka_nails.deposit_attempts set refund_id = coalesce(p_refund_id, refund_id) where id = p_attempt;
  end if;
end;
$$;

create function public.ka_nails_deposit_due(p_mode text, p_limit integer)
returns setof jsonb language plpgsql security invoker set search_path = '' as $$
declare
  expired_id uuid;
begin
  for expired_id in
    select d.id from ka_nails.deposits d where d.state = 'awaiting'
      and (d.cancel_at is not null or d.hold_until <= clock_timestamp())
      and not exists (select 1 from ka_nails.deposit_attempts a where a.deposit_id = d.id and a.state <> 'closed')
    limit 50 for update of d skip locked
  loop
    update ka_nails.deposits d set state = case when cancel_at is null then 'expired' else 'cancelled' end
      where d.id = expired_id and not exists (select 1 from ka_nails.deposit_attempts a
        where a.deposit_id = d.id and a.state <> 'closed');
  end loop;
  return query with due as (
    select d.id from ka_nails.deposits d join ka_nails.deposit_attempts a on d.id = a.deposit_id
    where a.state <> 'closed' and a.mode = p_mode and (
      (d.state = 'awaiting' and a.state in ('creating', 'open', 'closing', 'capturing', 'processing'))
      or d.state = 'refund_pending'
    ) and d.checked_at < clock_timestamp() - interval '1 minute'
    order by (d.state = 'refund_pending' or d.cancel_at is not null or d.hold_until <= clock_timestamp()
      or a.state in ('closing', 'capturing', 'processing')) desc, d.checked_at
    limit greatest(0, least(p_limit, 10)) for update of d skip locked
  ), changed as (
    update ka_nails.deposits d set checked_at = clock_timestamp() from due
    where d.id = due.id returning d.id
  ) select ka_nails.deposit_record(id) from changed;
end;
$$;

revoke execute on function ka_nails.deposit_record(uuid),
  public.ka_nails_chat_begin_request_with_access(text,timestamptz,text,text[],text,text,text,text,text,integer,text),
  public.ka_nails_deposit_lookup(text),
  public.ka_nails_deposit_provider_ref(text,text,text,text,uuid),
  public.ka_nails_deposit_offer(uuid,date,text,text,timestamptz,timestamptz,timestamptz,integer,text,text,text),
  public.ka_nails_deposit_staff_list(),
  public.ka_nails_deposit_staff_record(uuid),
  public.ka_nails_deposit_staff_update(uuid,text,text,timestamptz,timestamptz,text,text),
  public.ka_nails_deposit_reserve(uuid,uuid,text,text,text,text),
  public.ka_nails_deposit_step(uuid,uuid,text,text,text),
  public.ka_nails_deposit_observe(uuid,uuid,text,text,text,timestamptz,text),
  public.ka_nails_deposit_due(text,integer)
from public, anon, authenticated;

grant execute on function ka_nails.deposit_record(uuid),
  public.ka_nails_chat_begin_request_with_access(text,timestamptz,text,text[],text,text,text,text,text,integer,text),
  public.ka_nails_deposit_lookup(text),
  public.ka_nails_deposit_provider_ref(text,text,text,text,uuid),
  public.ka_nails_deposit_offer(uuid,date,text,text,timestamptz,timestamptz,timestamptz,integer,text,text,text),
  public.ka_nails_deposit_staff_list(),
  public.ka_nails_deposit_staff_record(uuid),
  public.ka_nails_deposit_staff_update(uuid,text,text,timestamptz,timestamptz,text,text),
  public.ka_nails_deposit_reserve(uuid,uuid,text,text,text,text),
  public.ka_nails_deposit_step(uuid,uuid,text,text,text),
  public.ka_nails_deposit_observe(uuid,uuid,text,text,text,timestamptz,text),
  public.ka_nails_deposit_due(text,integer)
to service_role;
