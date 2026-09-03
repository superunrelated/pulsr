-- Core schema for Pulsr: profiles, wearable connections, activity/vitals/medical logs.

create extension if not exists "supabase_vault";

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone text not null default 'UTC',
  goal_weight_kg numeric,
  created_at timestamptz not null default now()
);

create table wearable_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('google_fit')),
  refresh_token_secret_id uuid, -- points at a secret in vault.secrets
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table daily_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  steps integer,
  active_minutes integer,
  calories integer,
  source text not null default 'google_fit',
  created_at timestamptz not null default now(),
  unique (user_id, date, source)
);

create table workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  activity_type text not null,
  source text not null default 'google_fit',
  created_at timestamptz not null default now()
);

create table sleep_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_minutes integer not null,
  source text not null default 'google_fit',
  created_at timestamptz not null default now()
);

create table weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_at timestamptz not null default now(),
  weight_kg numeric not null,
  created_at timestamptz not null default now()
);

create table medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  dosage text,
  schedule jsonb not null default '[]', -- e.g. [{"time": "08:00"}, {"time": "20:00"}]
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table medication_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  medication_id uuid not null references medications (id) on delete cascade,
  scheduled_for timestamptz not null,
  taken_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'taken', 'skipped', 'late')),
  created_at timestamptz not null default now()
);

create table symptom_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_at timestamptz not null default now(),
  label text not null,
  severity smallint check (severity between 1 and 5),
  notes text,
  created_at timestamptz not null default now()
);

create table reminder_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reminder_type text not null check (
    reminder_type in ('water', 'standing', 'walking_pad', 'pill', 'analysis_checkin')
  ),
  interval_minutes integer,
  fixed_times jsonb, -- e.g. ["08:00", "20:00"]
  active_hours jsonb, -- e.g. {"start": "09:00", "end": "21:00"}
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, reminder_type)
);

create index on daily_activity (user_id, date);
create index on workouts (user_id, started_at);
create index on sleep_sessions (user_id, started_at);
create index on weight_logs (user_id, logged_at);
create index on medication_logs (user_id, scheduled_for);
create index on symptom_logs (user_id, logged_at);
