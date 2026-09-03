import { Temporal } from '@js-temporal/polyfill';
import type { ChangeEvent } from 'react';

export interface DateOption {
  label: string;
  date: string; // YYYY-MM-DD, local calendar date
}

/** Today, Yesterday, and the 6 days before that — for quick "log this in the
 * past" pickers. Uses the device's local calendar day (via Temporal), not
 * UTC — `new Date().toISOString()` returns the wrong date for a large part
 * of the day in timezones ahead of UTC (e.g. NZ). */
export function getRecentDateOptions(): DateOption[] {
  const today = Temporal.Now.plainDateISO();
  const options: DateOption[] = [];
  for (let i = 0; i <= 7; i++) {
    const d = today.subtract({ days: i });
    const label =
      i === 0
        ? 'Today'
        : i === 1
          ? 'Yesterday'
          : d.toLocaleString(undefined, { weekday: 'short' });
    options.push({ label, date: d.toString() });
  }
  return options;
}

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
}

export function DatePicker({ value, onChange }: DatePickerProps) {
  const options = getRecentDateOptions();

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {options.map((opt) => (
          <button
            key={opt.date}
            type="button"
            onClick={() => onChange(opt.date)}
            className={`shrink-0 rounded px-2.5 py-1 text-xs font-medium ${
              value === opt.date
                ? 'bg-[#1c1e2a] text-white'
                : 'bg-neutral-100 text-neutral-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <input
        type="date"
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          onChange(e.target.value)
        }
        className="rounded border border-neutral-300 px-3 py-2 text-sm"
      />
    </div>
  );
}
