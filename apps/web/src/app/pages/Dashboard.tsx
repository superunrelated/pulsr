import { StatCard, Card } from '@pulsr/ui';
import type {
  DailyActivity,
  Medication,
  MedicationLog,
  WaterLog,
  WeightLog,
} from '@pulsr/shared';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { localDayUtcRange, localTodayIso } from '../../lib/dates';

function todayRange() {
  const today = localTodayIso();
  const { startIso, endIso } = localDayUtcRange(today);
  return { today, dayStart: startIso, dayEnd: endIso };
}

export function Dashboard() {
  const [activity, setActivity] = useState<DailyActivity | null>(null);
  const [latestWeight, setLatestWeight] = useState<WeightLog | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [todaysMeds, setTodaysMeds] = useState<MedicationLog[]>([]);
  const [todaysWater, setTodaysWater] = useState<WaterLog[]>([]);
  const [showCheckinBanner, setShowCheckinBanner] = useState(false);
  const [pendingWeight, setPendingWeight] = useState(70);

  async function refreshWater() {
    const { dayStart, dayEnd } = todayRange();
    const { data } = await supabase
      .from('water_logs')
      .select('*')
      .gte('logged_at', dayStart)
      .lt('logged_at', dayEnd);
    setTodaysWater(data ?? []);
  }

  async function refreshMeds() {
    const { dayStart, dayEnd } = todayRange();
    const [medsRes, logsRes] = await Promise.all([
      supabase.from('medications').select('*').eq('active', true),
      supabase
        .from('medication_logs')
        .select('*')
        .gte('scheduled_for', dayStart)
        .lt('scheduled_for', dayEnd),
    ]);
    setMedications(medsRes.data ?? []);
    setTodaysMeds(logsRes.data ?? []);
  }

  useEffect(() => {
    const { today } = todayRange();

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
      .then(({ data }) => {
        setLatestWeight(data);
        if (data) setPendingWeight(Number(data.weight_kg));
      });
    refreshMeds();
    refreshWater();
    supabase
      .from('reminder_settings')
      .select('*')
      .eq('reminder_type', 'analysis_checkin')
      .eq('enabled', true)
      .maybeSingle()
      .then(({ data }) => setShowCheckinBanner(Boolean(data)));
  }, []);

  async function logTaken(medication: Medication) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const now = new Date().toISOString();
    await supabase.from('medication_logs').insert({
      user_id: userData.user.id,
      medication_id: medication.id,
      scheduled_for: now,
      taken_at: now,
      status: 'taken',
    });
    refreshMeds();
  }

  async function saveWeight(value: number) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    // True DB-level upsert keyed by the unique (user_id, log_date) index —
    // avoids the race where rapid +/-/= clicks each read a stale
    // `latestWeight` from React state and all decide to insert.
    const { data } = await supabase
      .from('weight_logs')
      .upsert(
        {
          user_id: userData.user.id,
          weight_kg: value,
          logged_at: new Date().toISOString(),
          log_date: localTodayIso(),
        },
        { onConflict: 'user_id,log_date' },
      )
      .select()
      .single();

    if (data) setLatestWeight(data);
  }

  function adjustWeight(deltaKg: number) {
    setPendingWeight((prev) => {
      const next = Math.round((prev + deltaKg) * 10) / 10;
      saveWeight(next);
      return next;
    });
  }

  async function confirmWeight() {
    await saveWeight(pendingWeight);
  }

  async function logWater(amountMl: number) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    await supabase
      .from('water_logs')
      .insert({ user_id: userData.user.id, amount_ml: amountMl });
    refreshWater();
  }

  const takenCount = todaysMeds.filter((m) => m.status === 'taken').length;
  const totalWaterMl = todaysWater.reduce((sum, log) => sum + log.amount_ml, 0);

  return (
    <div className="space-y-4 p-4">
      {showCheckinBanner && (
        <div className="rounded bg-[#1c1e2a] p-4 text-sm text-white">
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
          label="Active minutes"
          value={activity?.active_minutes?.toString() ?? '—'}
        />
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
              Latest weight
            </p>
            <p className="mt-1 font-serif text-2xl font-semibold text-[#1c1e2a]">
              {pendingWeight.toFixed(1)} kg
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              {latestWeight
                ? new Date(latestWeight.logged_at).toLocaleDateString()
                : 'no entries yet'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => adjustWeight(-0.1)}
              aria-label="Decrease weight"
              className="flex h-8 w-8 items-center justify-center rounded bg-neutral-100 text-sm font-medium text-neutral-700"
            >
              −
            </button>
            <button
              onClick={() => adjustWeight(0.1)}
              aria-label="Increase weight"
              className="flex h-8 w-8 items-center justify-center rounded bg-neutral-100 text-sm font-medium text-neutral-700"
            >
              +
            </button>
            <button
              onClick={confirmWeight}
              aria-label="Log this weight"
              className="flex h-8 w-8 items-center justify-center rounded bg-[#1c1e2a] text-sm font-medium text-white"
            >
              =
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
              Water today
            </p>
            <p className="mt-1 font-serif text-2xl font-semibold text-[#1c1e2a]">
              {totalWaterMl > 0 ? `${totalWaterMl} ml` : '—'}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              onClick={() => logWater(200)}
              className="rounded bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700"
            >
              1 glass
            </button>
            <button
              onClick={() => logWater(250)}
              className="rounded bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700"
            >
              +250ml
            </button>
            <button
              onClick={() => logWater(500)}
              className="rounded bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700"
            >
              +500ml
            </button>
          </div>
        </div>
      </Card>

      {medications.length > 0 && (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                Meds today
              </p>
              <p className="mt-1 font-serif text-2xl font-semibold text-[#1c1e2a]">
                {takenCount}/{medications.length}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {medications.map((med) => {
                const takenToday = todaysMeds.some(
                  (log) =>
                    log.medication_id === med.id && log.status === 'taken',
                );
                return (
                  <button
                    key={med.id}
                    onClick={() => logTaken(med)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      takenToday
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-neutral-100 text-neutral-700'
                    }`}
                  >
                    {med.name} {takenToday ? '✓' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      <Card title="Nothing connected yet?">
        <p className="text-sm text-neutral-600">
          Head to Settings to connect your Pixel Watch (Google Fit) and
          configure reminders.
        </p>
      </Card>
    </div>
  );
}
