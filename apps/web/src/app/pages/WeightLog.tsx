import { Card, DatePicker, getRecentDateOptions } from '@pulsr/ui';
import type { WeightLog as WeightLogEntry } from '@pulsr/shared';
import { RiCloseLine } from '@remixicon/react';
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';

export function WeightLog() {
  const [entries, setEntries] = useState<WeightLogEntry[]>([]);
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(getRecentDateOptions()[0].date);

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

    // Upsert on the unique (user_id, log_date) index — only one entry per
    // calendar day, whichever date is picked.
    await supabase.from('weight_logs').upsert(
      {
        user_id: userData.user.id,
        weight_kg: Number(weight),
        logged_at: `${date}T12:00:00.000Z`,
      },
      { onConflict: 'user_id,log_date' },
    );

    setWeight('');
    refresh();
  }

  async function removeEntry(id: string) {
    await supabase.from('weight_logs').delete().eq('id', id);
    refresh();
  }

  return (
    <div className="space-y-4 p-4">
      <Card title="Log your weight">
        <form onSubmit={handleSubmit} className="space-y-3">
          <DatePicker value={date} onChange={setDate} />
          <div className="flex gap-2">
            <input
              type="number"
              step="0.1"
              placeholder="kg"
              required
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded bg-[#1c1e2a] px-4 py-2 text-sm text-white"
            >
              Add
            </button>
          </div>
        </form>
      </Card>

      <Card title="History">
        <ul className="divide-y divide-neutral-100">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span className="text-neutral-600">
                {new Date(entry.logged_at).toLocaleDateString()}
              </span>
              <div className="flex items-center gap-3">
                <span className="font-medium text-neutral-900">
                  {Number(entry.weight_kg).toFixed(1)} kg
                </span>
                <button
                  onClick={() => removeEntry(entry.id)}
                  aria-label="Remove entry"
                  className="text-neutral-400 hover:text-red-500"
                >
                  <RiCloseLine size={16} />
                </button>
              </div>
            </li>
          ))}
          {entries.length === 0 && (
            <p className="py-2 text-sm text-neutral-400">No entries yet.</p>
          )}
        </ul>
      </Card>
    </div>
  );
}
