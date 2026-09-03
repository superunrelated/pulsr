import { Card } from '@pulsr/ui';
import type { WeightLog as WeightLogEntry } from '@pulsr/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';

export function WeightLog() {
  const [entries, setEntries] = useState<WeightLogEntry[]>([]);
  const [weight, setWeight] = useState('');

  async function refresh() {
    const { data } = await supabase
      .from('weight_logs')
      .select('*')
      .order('logged_at', { ascending: false })
      .limit(30);
    setEntries(data ?? []);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user || !weight) return;
    await supabase.from('weight_logs').insert({
      user_id: userData.user.id,
      weight_kg: Number(weight),
    });
    setWeight('');
    refresh();
  }

  return (
    <div className="space-y-4 p-4">
      <Card title="Log your weight">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="number"
            step="0.1"
            placeholder="kg"
            required
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white"
          >
            Add
          </button>
        </form>
      </Card>

      <Card title="History">
        <ul className="divide-y divide-slate-100">
          {entries.map((entry) => (
            <li key={entry.id} className="flex justify-between py-2 text-sm">
              <span className="text-slate-600">
                {new Date(entry.logged_at).toLocaleDateString()}
              </span>
              <span className="font-medium text-slate-900">
                {entry.weight_kg} kg
              </span>
            </li>
          ))}
          {entries.length === 0 && (
            <p className="py-2 text-sm text-slate-400">No entries yet.</p>
          )}
        </ul>
      </Card>
    </div>
  );
}
