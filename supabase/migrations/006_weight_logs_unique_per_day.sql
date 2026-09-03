-- Enforce one weight_logs row per user per day at the database level,
-- rather than relying on client-side state (which raced under rapid
-- +/-/= clicks and produced duplicate rows for the same day).
alter table weight_logs add column log_date date generated always as (
  (logged_at at time zone 'utc')::date
) stored;

-- Clean up duplicate same-day rows created by the race condition before
-- the unique index can be created — keep the most recently created one.
delete from weight_logs w
where w.id in (
  select id from (
    select id, row_number() over (
      partition by user_id, log_date order by created_at desc
    ) as rn
    from weight_logs
  ) ranked
  where rn > 1
);

create unique index weight_logs_user_date_idx on weight_logs (user_id, log_date);
