import { Card } from '@pulsr/ui';
import type { Medication, MedicationLog } from '@pulsr/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';

export function Medications() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [logs, setLogs] = useState<MedicationLog[]>([]);
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [time, setTime] = useState('08:00');

  async function refresh() {
    const [medsRes, logsRes] = await Promise.all([
      supabase.from('medications').select('*').eq('active', true),
      supabase
        .from('medication_logs')
        .select('*')
        .order('scheduled_for', { ascending: false })
        .limit(20),
    ]);
    setMedications(medsRes.data ?? []);
    setLogs(logsRes.data ?? []);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleAddMedication(e: FormEvent) {
    e.preventDefault();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user || !name) return;
    await supabase.from('medications').insert({
      user_id: userData.user.id,
      name,
      dosage: dosage || null,
      schedule: [{ time }],
    });
    setName('');
    setDosage('');
    refresh();
  }

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
    refresh();
  }

  return (
    <div className="space-y-4 p-4">
      <Card title="Add a medication">
        <form onSubmit={handleAddMedication} className="space-y-2">
          <input
            placeholder="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Dosage (optional)"
            value={dosage}
            onChange={(e) => setDosage(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Fixed time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm text-white"
          >
            Add medication
          </button>
        </form>
      </Card>

      <Card title="Your medications">
        <ul className="divide-y divide-slate-100">
          {medications.map((med) => (
            <li
              key={med.id}
              className="flex items-center justify-between py-2 text-sm"
            >
              <div>
                <p className="font-medium text-slate-900">{med.name}</p>
                {med.dosage && (
                  <p className="text-xs text-slate-400">{med.dosage}</p>
                )}
              </div>
              <button
                onClick={() => logTaken(med)}
                className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
              >
                Log taken
              </button>
            </li>
          ))}
          {medications.length === 0 && (
            <p className="py-2 text-sm text-slate-400">
              No medications added yet.
            </p>
          )}
        </ul>
      </Card>

      <Card title="Recent adherence log">
        <ul className="divide-y divide-slate-100">
          {logs.map((log) => (
            <li key={log.id} className="flex justify-between py-2 text-sm">
              <span className="text-slate-600">
                {new Date(log.scheduled_for).toLocaleString()}
              </span>
              <span className="font-medium capitalize text-slate-900">
                {log.status}
              </span>
            </li>
          ))}
          {logs.length === 0 && (
            <p className="py-2 text-sm text-slate-400">No log entries yet.</p>
          )}
        </ul>
      </Card>
    </div>
  );
}
