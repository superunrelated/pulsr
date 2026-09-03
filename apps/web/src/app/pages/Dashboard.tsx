import { StatCard, Card } from '@pulsr/ui';
import type { DailyActivity, MedicationLog, WeightLog } from '@pulsr/shared';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export function Dashboard() {
  const [activity, setActivity] = useState<DailyActivity | null>(null);
  const [latestWeight, setLatestWeight] = useState<WeightLog | null>(null);
  const [todaysMeds, setTodaysMeds] = useState<MedicationLog[]>([]);
  const [showCheckinBanner, setShowCheckinBanner] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const dayStart = `${today}T00:00:00.000Z`;
    const dayEnd = `${today}T23:59:59.999Z`;

    supabase
      .from('daily_activity')
      .select('*')
      .eq('date', today)
      .maybeSingle()
      .then(({ data }) => {
        setActivity(data);
      });
    supabase
      .from('weight_logs')
      .select('*')
      .order('logged_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setLatestWeight(data));
    supabase
      .from('medication_logs')
      .select('*')
      .gte('scheduled_for', dayStart)
      .lte('scheduled_for', dayEnd)
      .then(({ data }) => setTodaysMeds(data ?? []));
    supabase
      .from('reminder_settings')
      .select('*')
      .eq('reminder_type', 'analysis_checkin')
      .eq('enabled', true)
      .maybeSingle()
      .then(({ data }) => setShowCheckinBanner(Boolean(data)));
  }, []);

  const takenCount = todaysMeds.filter((m) => m.status === 'taken').length;

  return (
    <div className="space-y-4 p-4">
      {showCheckinBanner && (
        <div className="rounded-xl bg-slate-900 p-4 text-sm text-white">
          🔎 Time to review your data with Claude — open Claude Desktop/Code and
          query the Pulsr MCP server for a weekly check-in.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Steps today"
          value={activity?.steps?.toLocaleString() ?? '—'}
        />
        <StatCard
          label="Latest weight"
          value={latestWeight ? `${latestWeight.weight_kg} kg` : '—'}
          hint={
            latestWeight
              ? new Date(latestWeight.logged_at).toLocaleDateString()
              : undefined
          }
        />
        <StatCard
          label="Active minutes"
          value={activity?.active_minutes?.toString() ?? '—'}
        />
        <StatCard
          label="Meds today"
          value={
            todaysMeds.length > 0 ? `${takenCount}/${todaysMeds.length}` : '—'
          }
        />
      </div>

      <Card title="Nothing connected yet?">
        <p className="text-sm text-slate-600">
          Head to Settings to connect your Pixel Watch (Google Fit) and
          configure reminders.
        </p>
      </Card>
    </div>
  );
}
