-- Row Level Security: every table is scoped to auth.uid() = user_id.

alter table profiles enable row level security;
alter table wearable_connections enable row level security;
alter table daily_activity enable row level security;
alter table workouts enable row level security;
alter table sleep_sessions enable row level security;
alter table weight_logs enable row level security;
alter table medications enable row level security;
alter table medication_logs enable row level security;
alter table symptom_logs enable row level security;
alter table reminder_settings enable row level security;

create policy "profiles self access" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "wearable_connections self access" on wearable_connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "daily_activity self access" on daily_activity
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "workouts self access" on workouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "sleep_sessions self access" on sleep_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "weight_logs self access" on weight_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "medications self access" on medications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "medication_logs self access" on medication_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "symptom_logs self access" on symptom_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "reminder_settings self access" on reminder_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-create a profile row when a new auth user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
