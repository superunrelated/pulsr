import { Notification } from 'electron';
import { supabase } from './supabase';

type ReminderType =
  'water' | 'standing' | 'walking_pad' | 'pill' | 'analysis_checkin';

interface ReminderSetting {
  id: string;
  reminder_type: ReminderType;
  interval_minutes: number | null;
  fixed_times: string[] | null; // ["08:00", "20:00"]
  active_hours: { start: string; end: string } | null;
  enabled: boolean;
}

const TITLES: Record<ReminderType, string> = {
  water: 'Drink water 💧',
  standing: 'Stand up 🧍',
  walking_pad: 'Use the walking pad 🚶',
  pill: 'Take your medication 💊',
  analysis_checkin: 'Time to review your data with Claude 🔎',
};

const CHECK_INTERVAL_MS = 60_000; // check schedules once a minute
const lastFired = new Map<string, number>(); // reminder id -> last-fired epoch ms
const firedTimeSlots = new Map<string, string>(); // reminder id -> "YYYY-MM-DD HH:mm" last fired fixed time

export function startScheduler(): void {
  checkAndFire().catch((err) => console.error('scheduler tick failed', err));
  setInterval(() => {
    checkAndFire().catch((err) => console.error('scheduler tick failed', err));
  }, CHECK_INTERVAL_MS);
}

async function checkAndFire(): Promise<void> {
  const { data: settings, error } = await supabase
    .from('reminder_settings')
    .select('*')
    .eq('enabled', true);
  if (error) {
    console.error('failed to load reminder_settings', error);
    return;
  }

  const now = new Date();
  for (const setting of (settings ?? []) as ReminderSetting[]) {
    if (setting.fixed_times?.length) {
      maybeFireFixedTime(setting, now);
    } else if (setting.interval_minutes) {
      maybeFireInterval(setting, now);
    }
  }
}

function withinActiveHours(setting: ReminderSetting, now: Date): boolean {
  if (!setting.active_hours) return true;
  const [startH, startM] = setting.active_hours.start.split(':').map(Number);
  const [endH, endM] = setting.active_hours.end.split(':').map(Number);
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  return minutesNow >= startH * 60 + startM && minutesNow <= endH * 60 + endM;
}

function maybeFireInterval(setting: ReminderSetting, now: Date): void {
  if (!withinActiveHours(setting, now)) return;
  const last = lastFired.get(setting.id) ?? 0;
  const intervalMs = (setting.interval_minutes ?? 60) * 60_000;
  if (now.getTime() - last >= intervalMs) {
    fireReminder(setting);
    lastFired.set(setting.id, now.getTime());
  }
}

const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// fixed_times entries are either "HH:MM" (fires every day) or "<dow>-HH:MM"
// (fires once a week on that day) — the weekly analysis_checkin reminder
// uses the latter, e.g. ["sun-18:00"].
function maybeFireFixedTime(setting: ReminderSetting, now: Date): void {
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const today = DOW[now.getDay()];
  const matches = setting.fixed_times?.some((entry) => {
    if (entry.includes('-')) {
      const [dow, time] = entry.split('-');
      return dow === today && time === hhmm;
    }
    return entry === hhmm;
  });
  if (!matches) return;
  const slotKey = `${now.toDateString()} ${hhmm}`;
  if (firedTimeSlots.get(setting.id) === slotKey) return; // already fired this exact slot today
  fireReminder(setting);
  firedTimeSlots.set(setting.id, slotKey);
}

function fireReminder(setting: ReminderSetting): void {
  new Notification({
    title: TITLES[setting.reminder_type],
    body: 'Open Pulsr or use the tray menu to log it.',
  }).show();
}
