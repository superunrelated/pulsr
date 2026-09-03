import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function createPulsrClient(
  url: string,
  anonKey: string,
  options?: Parameters<typeof createClient>[2],
): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      'Supabase URL and anon key are required to create a Pulsr client.',
    );
  }
  return createClient(url, anonKey, options);
}
