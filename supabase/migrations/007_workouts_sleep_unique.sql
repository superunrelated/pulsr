-- Allow idempotent upserts for synced workouts/sleep sessions — repeated
-- syncs over an overlapping window would otherwise insert duplicate rows
-- every time (Google returns the same session on every sync).
alter table workouts
  add constraint workouts_user_start_source_uniq unique (user_id, started_at, source);

alter table sleep_sessions
  add constraint sleep_sessions_user_start_source_uniq unique (user_id, started_at, source);
