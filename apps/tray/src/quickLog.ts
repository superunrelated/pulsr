import { Notification } from 'electron';
import { supabase } from './supabase';

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error ?? new Error('not signed in');
  return data.user.id;
}

export async function logWater(): Promise<void> {
  const user_id = await currentUserId();
  await supabase
    .from('symptom_logs')
    .insert({ user_id, label: 'water', notes: 'Logged from tray' });
  notify('Water logged 💧');
}

export async function logStandingDesk(): Promise<void> {
  const user_id = await currentUserId();
  await supabase
    .from('symptom_logs')
    .insert({ user_id, label: 'standing_desk', notes: 'Logged from tray' });
  notify('Standing desk break logged 🧍');
}

export async function logWalkingPad(): Promise<void> {
  const user_id = await currentUserId();
  await supabase.from('workouts').insert({
    user_id,
    started_at: new Date().toISOString(),
    ended_at: new Date().toISOString(),
    activity_type: 'walking_pad',
    source: 'tray_quick_log',
  });
  notify('Walking pad session logged 🚶');
}

export async function listActiveMedications(): Promise<
  { id: string; name: string }[]
> {
  const user_id = await currentUserId();
  const { data, error } = await supabase
    .from('medications')
    .select('id, name')
    .eq('user_id', user_id)
    .eq('active', true);
  if (error) throw error;
  return data ?? [];
}

export async function logPillTaken(
  medicationId: string,
  medicationName: string,
): Promise<void> {
  const user_id = await currentUserId();
  const now = new Date().toISOString();
  await supabase.from('medication_logs').insert({
    user_id,
    medication_id: medicationId,
    scheduled_for: now,
    taken_at: now,
    status: 'taken',
  });
  notify(`${medicationName} logged as taken 💊`);
}

function notify(body: string): void {
  new Notification({ title: 'Pulsr', body }).show();
}
