create table water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_at timestamptz not null default now(),
  amount_ml integer not null,
  created_at timestamptz not null default now()
);

create index on water_logs (user_id, logged_at);

alter table water_logs enable row level security;

create policy "water_logs self access" on water_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
