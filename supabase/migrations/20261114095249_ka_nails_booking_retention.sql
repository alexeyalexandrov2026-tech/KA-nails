-- The privacy policy (/privacy/, /ru/privacy/) says appointment requests left
-- through the assistant are kept for up to 12 months and then deleted. A
-- pg_cron job runs every hour, so a request is deleted within an hour of
-- turning 12 months old, whatever its delivery state.
create extension if not exists pg_cron with schema pg_catalog;

create or replace function ka_nails.delete_expired_booking_requests()
returns integer
language sql
security invoker
set search_path = ''
as $$
  with deleted as (
    delete from ka_nails.booking_requests
      where received_at < now() - interval '12 months'
      returning 1
  )
  select count(*)::integer from deleted;
$$;

-- Only the database owner (the cron job) runs it; the Worker's server role
-- has no delete rights on the table and gets none here.
revoke all on function ka_nails.delete_expired_booking_requests()
  from public, anon, authenticated, service_role;

-- cron.schedule with a job name replaces an existing job of that name, so
-- applying this file again keeps a single job.
select cron.schedule(
  'ka-nails-delete-expired-booking-requests',
  '17 * * * *',
  'select ka_nails.delete_expired_booking_requests()'
);
