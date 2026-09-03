-- Wrapper functions around Supabase Vault, since the `vault` schema is not
-- exposed via PostgREST directly. Both are `security definer` and are only
-- ever called with the service-role key from Edge Functions.

create or replace function public.vault_upsert_secret(p_name text, p_secret text)
returns uuid
language plpgsql
security definer set search_path = public, vault
as $$
declare
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = p_name;
  if v_id is null then
    v_id := vault.create_secret(p_secret, p_name);
  else
    perform vault.update_secret(v_id, p_secret);
  end if;
  return v_id;
end;
$$;

create or replace function public.vault_read_secret(p_id uuid)
returns text
language sql
security definer set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where id = p_id;
$$;

revoke all on function public.vault_upsert_secret(text, text) from public, anon, authenticated;
revoke all on function public.vault_read_secret(uuid) from public, anon, authenticated;
grant execute on function public.vault_upsert_secret(text, text) to service_role;
grant execute on function public.vault_read_secret(uuid) to service_role;
