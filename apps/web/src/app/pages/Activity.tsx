import { Card } from '@pulsr/ui';
import type { SleepSession, Workout } from '@pulsr/shared';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export function Activity() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [sleep, setSleep] = useState<SleepSession[]>([]);

  useEffect(() => {
    supabase
      .from('workouts')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setWorkouts(data ?? []));
    supabase
      .from('sleep_sessions')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(14)
      .then(({ data }) => setSleep(data ?? []));
  }, []);

  return (
    <div className="space-y-4 p-4">
      <Card title="Workouts">
        <ul className="divide-y divide-slate-100">
          {workouts.map((w) => (
            <li key={w.id} className="flex justify-between py-2 text-sm">
              <span className="capitalize text-slate-900">
                {w.activity_type.replace(/_/g, ' ')}
              </span>
              <span className="text-slate-400">
                {new Date(w.started_at).toLocaleDateString()}
              </span>
            </li>
          ))}
          {workouts.length === 0 && (
            <p className="py-2 text-sm text-slate-400">
              No workouts yet — connect your Pixel Watch or use the tray app's
              quick-log.
            </p>
          )}
        </ul>
      </Card>

      <Card title="Sleep">
        <ul className="divide-y divide-slate-100">
          {sleep.map((s) => (
            <li key={s.id} className="flex justify-between py-2 text-sm">
              <span className="text-slate-900">
                {new Date(s.started_at).toLocaleDateString()}
              </span>
              <span className="text-slate-400">
                {Math.round(s.duration_minutes / 60)}h {s.duration_minutes % 60}
                m
              </span>
            </li>
          ))}
          {sleep.length === 0 && (
            <p className="py-2 text-sm text-slate-400">
              No sleep data synced yet.
            </p>
          )}
        </ul>
      </Card>
    </div>
  );
}
