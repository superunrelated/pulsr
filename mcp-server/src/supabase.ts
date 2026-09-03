import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error(
    'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (service-role key, server-side only — never commit it).',
  );
}

// Service-role client: bypasses RLS. This is safe here because the server
// only ever runs locally for a single personal user and is never exposed
// over the network.
export const supabase = createClient(url, serviceRoleKey);

export function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}
