import { Card, DatePicker, getRecentDateOptions } from '@pulsr/ui';
import type { Medication, MedicationLog } from '@pulsr/shared';
import { RiCloseLine } from '@remixicon/react';
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';

export function Medications() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [logs, setLogs] = useState<MedicationLog[]>([]);
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [time, setTime] = useState('08:00');
  const [logDate, setLogDate] = useState(getRecentDateOptions()[0].date);

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
    const isToday = logDate === getRecentDateOptions()[0].date;
    const takenAt = isToday
      ? new Date().toISOString()
      : `${logDate}T12:00:00.000Z`;
    await supabase.from('medication_logs').insert({
      user_id: userData.user.id,
      medication_id: medication.id,
      scheduled_for: takenAt,
      taken_at: takenAt,
      status: 'taken',
    });
    refresh();
  }

  async function removeLog(id: string) {
    await supabase.from('medication_logs').delete().eq('id', id);
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
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Dosage (optional)"
            value={dosage}
            onChange={(e) => setDosage(e.target.value)}
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          />
          <div className="flex items-center gap-2">
            <label className="text-sm text-neutral-600">Fixed time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="rounded border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded bg-[#1c1e2a] px-4 py-2 text-sm text-white"
          >
            Add medication
          </button>
        </form>
      </Card>

      <Card title="Your medications">
        <div className="mb-3">
          <p className="mb-2 text-xs text-neutral-400">Logging for:</p>
          <DatePicker value={logDate} onChange={setLogDate} />
        </div>
        <ul className="divide-y divide-neutral-100">
          {medications.map((med) => (
            <li
              key={med.id}
              className="flex items-center justify-between py-2 text-sm"
            >
              <div>
                <p className="font-medium text-neutral-900">{med.name}</p>
                {med.dosage && (
                  <p className="text-xs text-neutral-400">{med.dosage}</p>
                )}
              </div>
              <button
                onClick={() => logTaken(med)}
                className="rounded bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700"
              >
                Log taken
              </button>
            </li>
          ))}
          {medications.length === 0 && (
            <p className="py-2 text-sm text-neutral-400">
              No medications added yet.
            </p>
          )}
        </ul>
      </Card>

      <Card title="Recent adherence log">
        <ul className="divide-y divide-neutral-100">
          {logs.map((log) => (
            <li
              key={log.id}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span className="text-neutral-600">
                {new Date(log.scheduled_for).toLocaleString()}
              </span>
              <div className="flex items-center gap-3">
                <span className="font-medium capitalize text-neutral-900">
                  {log.status}
                </span>
                <button
                  onClick={() => removeLog(log.id)}
                  aria-label="Remove entry"
                  className="text-neutral-400 hover:text-red-500"
                >
                  <RiCloseLine size={16} />
                </button>
              </div>
            </li>
          ))}
          {logs.length === 0 && (
            <p className="py-2 text-sm text-neutral-400">No log entries yet.</p>
          )}
        </ul>
      </Card>
    </div>
  );
}
