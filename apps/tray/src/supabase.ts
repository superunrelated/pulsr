import { createClient } from '@supabase/supabase-js';

const url = process.env.PULSR_SUPABASE_URL;
const anonKey = process.env.PULSR_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'PULSR_SUPABASE_URL and PULSR_SUPABASE_ANON_KEY must be set in the environment before starting the tray app.',
  );
}

// No persisted session storage in the Electron main process (no localStorage) —
// sign in fresh each time the app starts, which is fine for a personal tool
// that launches on login.
export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});

export async function signIn(): Promise<void> {
  const email = process.env.PULSR_EMAIL;
  const password = process.env.PULSR_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'PULSR_EMAIL and PULSR_PASSWORD must be set in the environment.',
    );
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}
