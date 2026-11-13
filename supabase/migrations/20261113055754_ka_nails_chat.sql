create schema ka_nails;
revoke all on schema ka_nails from public, anon, authenticated;
grant usage on schema ka_nails to service_role;

create table ka_nails.booking_requests (
  day date not null,
  id text not null,
  received_at timestamptz not null,
  service_id text,
  add_on_ids text[] not null,
  preferred_time text not null,
  name text not null,
  phone text not null,
  notes text not null,
  language text not null check (language in ('en', 'ru')),
  state text not null check (state in ('pending', 'delivered', 'failed')),
  delivery jsonb not null default '[]'::jsonb check (jsonb_typeof(delivery) = 'array'),
  primary key (day, id),
  check (day = (received_at at time zone 'UTC')::date)
);

create unique index booking_requests_one_active_phone_per_day
  on ka_nails.booking_requests (day, phone) where state in ('pending', 'delivered');

create table ka_nails.daily_usage (
  day date primary key,
  messages integer not null check (messages > 0)
);

alter table ka_nails.booking_requests enable row level security;
alter table ka_nails.daily_usage enable row level security;
grant select, insert, update on ka_nails.booking_requests, ka_nails.daily_usage to service_role;

create function public.ka_nails_chat_allow_message(p_limit integer)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  with allowed as (
    insert into ka_nails.daily_usage as usage (day, messages)
    select (statement_timestamp() at time zone 'UTC')::date, 1
    where p_limit > 0
    on conflict (day) do update set messages = usage.messages + 1
    where usage.messages < p_limit
    returning 1
  )
  select exists (select from allowed);
$$;

create function public.ka_nails_chat_begin_request(
  p_id text, p_received_at timestamptz, p_service_id text, p_add_on_ids text[],
  p_preferred_time text, p_name text, p_phone text, p_notes text, p_language text,
  p_limit integer
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  request_day date := (p_received_at at time zone 'UTC')::date;
  existing_state text;
begin
  -- Serialize the small daily quota and deduplication across Worker isolates.
  perform pg_catalog.pg_advisory_xact_lock(743591, request_day - date '2000-01-01');
  select state into existing_state from ka_nails.booking_requests
    where day = request_day and phone = p_phone and state in ('pending', 'delivered');

  if existing_state is not null then
    return existing_state;
  end if;
  if (select count(*) from ka_nails.booking_requests where day = request_day) >= p_limit then
    return 'limit';
  end if;

  insert into ka_nails.booking_requests
    (day, id, received_at, service_id, add_on_ids, preferred_time, name, phone, notes, language, state)
    values (request_day, p_id, p_received_at, p_service_id, p_add_on_ids, p_preferred_time,
      p_name, p_phone, p_notes, p_language, 'pending');
  return 'created';
end;
$$;

create function public.ka_nails_chat_finish_request(
  p_id text, p_received_at timestamptz, p_delivery jsonb
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  with changed as (
    update ka_nails.booking_requests
      set delivery = p_delivery,
          state = case when p_delivery @> '[{"ok":true}]'::jsonb then 'delivered' else 'failed' end
      where day = (p_received_at at time zone 'UTC')::date and id = p_id and state = 'pending'
      returning 1
  )
  select exists (select from changed);
$$;

create function public.ka_nails_chat_ready()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (select state in ('pending', 'delivered', 'failed') from ka_nails.booking_requests limit 1),
    true
  );
$$;

revoke execute on function public.ka_nails_chat_allow_message(integer),
  public.ka_nails_chat_begin_request(text, timestamptz, text, text[], text, text, text, text, text, integer),
  public.ka_nails_chat_finish_request(text, timestamptz, jsonb),
  public.ka_nails_chat_ready() from public, anon, authenticated;

grant execute on function public.ka_nails_chat_allow_message(integer),
  public.ka_nails_chat_begin_request(text, timestamptz, text, text[], text, text, text, text, text, integer),
  public.ka_nails_chat_finish_request(text, timestamptz, jsonb),
  public.ka_nails_chat_ready() to service_role;
