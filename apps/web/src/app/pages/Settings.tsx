import { Card } from '@pulsr/ui';
import type {
  ReminderSetting,
  ReminderType,
  WearableConnection,
} from '@pulsr/shared';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const REMINDER_LABELS: Record<ReminderType, string> = {
  water: 'Drink water',
  standing: 'Standing desk',
  walking_pad: 'Walking pad',
  pill: 'Pills',
  analysis_checkin: 'Weekly Claude check-in',
};

export function Settings() {
  const [connection, setConnection] = useState<WearableConnection | null>(null);
  const [reminders, setReminders] = useState<ReminderSetting[]>([]);
  const [syncing, setSyncing] = useState(false);

  async function refresh() {
    const [connRes, remindersRes] = await Promise.all([
      supabase
        .from('wearable_connections')
        .select('*')
        .eq('provider', 'google_fit')
        .maybeSingle(),
      supabase.from('reminder_settings').select('*'),
    ]);
    setConnection(connRes.data);
    setReminders(remindersRes.data ?? []);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function connectGoogleFit() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
    const redirectUri = import.meta.env.VITE_GOOGLE_REDIRECT_URI as string;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        // Legacy Fitness API — still used for steps/calories/active-minutes.
        'https://www.googleapis.com/auth/fitness.activity.read',
        'https://www.googleapis.com/auth/fitness.sleep.read',
        // Google Health API (Fitness API's replacement, sunsetting end of
        // 2026) — used for workouts/sleep sessions, which the legacy
        // Sessions API stopped actually returning data for.
        'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
        'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
      ].join(' '),
      state: userData.user.id,
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async function disconnectGoogleFit() {
    await supabase
      .from('wearable_connections')
      .delete()
      .eq('provider', 'google_fit');
    refresh();
  }

  async function syncGoogleFit() {
    setSyncing(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-fit-sync/sync`;
      const { data: userData } = await supabase.auth.getUser();
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userData.user?.id }),
      });
    } finally {
      setSyncing(false);
      refresh();
    }
  }

  async function toggleReminder(type: ReminderType, enabled: boolean) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    await supabase
      .from('reminder_settings')
      .upsert(
        { user_id: userData.user.id, reminder_type: type, enabled },
        { onConflict: 'user_id,reminder_type' },
      );
    refresh();
  }

  return (
    <div className="space-y-4 p-4">
      <Card title="Wearable">
        {connection ? (
          <div className="space-y-3">
            <p className="text-sm text-neutral-600">
              Connected to Google Fit. Last synced:{' '}
              {connection.last_synced_at
                ? new Date(connection.last_synced_at).toLocaleString()
                : 'never yet'}
              .
            </p>
            <div className="flex gap-2">
              <button
                onClick={syncGoogleFit}
                disabled={syncing}
                className="flex-1 rounded bg-[#1c1e2a] px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {syncing ? 'Syncing…' : 'Sync now'}
              </button>
              <button
                onClick={disconnectGoogleFit}
                className="flex-1 rounded bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-700"
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={connectGoogleFit}
            className="w-full rounded bg-[#1c1e2a] px-4 py-2 text-sm text-white"
          >
            Connect Pixel Watch (Google Fit)
          </button>
        )}
      </Card>

      <Card title="Reminders">
        <ul className="divide-y divide-neutral-100">
          {(Object.keys(REMINDER_LABELS) as ReminderType[]).map((type) => {
            const existing = reminders.find((r) => r.reminder_type === type);
            const enabled = existing?.enabled ?? false;
            return (
              <li
                key={type}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="text-neutral-900">
                  {REMINDER_LABELS[type]}
                </span>
                <button
                  onClick={() => toggleReminder(type, !enabled)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    enabled
                      ? 'bg-[#1c1e2a] text-white'
                      : 'bg-neutral-100 text-neutral-500'
                  }`}
                >
                  {enabled ? 'On' : 'Off'}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-neutral-400">
          Fine-tune intervals and fixed times directly in Supabase for now
          (reminder_settings table).
        </p>
      </Card>
    </div>
  );
}
