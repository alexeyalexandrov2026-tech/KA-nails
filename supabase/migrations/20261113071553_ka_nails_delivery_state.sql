create or replace function public.ka_nails_chat_finish_request(
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
          state = case
            when p_delivery @> '[{"ok":true}]'::jsonb then 'delivered'
            when p_delivery @> '[{"error":"delivery-unknown"}]'::jsonb then 'pending'
            else 'failed'
          end
      where day = (p_received_at at time zone 'UTC')::date and id = p_id and state = 'pending'
      returning 1
  )
  select exists (select from changed);
$$;
