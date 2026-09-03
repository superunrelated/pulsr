import { Card } from '@pulsr/ui';
import type { SymptomLog } from '@pulsr/shared';
import { RiCloseLine } from '@remixicon/react';
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';

export function Symptoms() {
  const [entries, setEntries] = useState<SymptomLog[]>([]);
  const [label, setLabel] = useState('');
  const [severity, setSeverity] = useState('3');
  const [notes, setNotes] = useState('');

  async function refresh() {
    const { data } = await supabase
      .from('symptom_logs')
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
    if (!userData.user || !label) return;
    await supabase.from('symptom_logs').insert({
      user_id: userData.user.id,
      label,
      severity: Number(severity),
      notes: notes || null,
    });
    setLabel('');
    setNotes('');
    refresh();
  }

  async function removeEntry(id: string) {
    await supabase.from('symptom_logs').delete().eq('id', id);
    refresh();
  }

  return (
    <div className="space-y-4 p-4">
      <Card title="Log a symptom or condition">
        <form onSubmit={handleSubmit} className="space-y-2">
          <input
            placeholder="e.g. headache, knee pain, mood"
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          />
          <div className="flex items-center gap-2">
            <label className="text-sm text-neutral-600">Severity</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="rounded border border-neutral-300 px-3 py-2 text-sm"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <textarea
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="w-full rounded bg-[#1c1e2a] px-4 py-2 text-sm text-white"
          >
            Log entry
          </button>
        </form>
      </Card>

      <Card title="History">
        <ul className="divide-y divide-neutral-100">
          {entries.map((entry) => (
            <li key={entry.id} className="py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-neutral-900">
                  {entry.label}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-neutral-400">
                    severity {entry.severity ?? '—'}
                  </span>
                  <button
                    onClick={() => removeEntry(entry.id)}
                    aria-label="Remove entry"
                    className="text-neutral-400 hover:text-red-500"
                  >
                    <RiCloseLine size={16} />
                  </button>
                </div>
              </div>
              <p className="text-xs text-neutral-400">
                {new Date(entry.logged_at).toLocaleString()}
              </p>
              {entry.notes && (
                <p className="mt-1 text-neutral-600">{entry.notes}</p>
              )}
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
