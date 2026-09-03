export interface Profile {
  id: string;
  display_name: string | null;
  timezone: string;
  goal_weight_kg: number | null;
  created_at: string;
}

export interface WearableConnection {
  id: string;
  user_id: string;
  provider: 'google_fit';
  last_synced_at: string | null;
  created_at: string;
}

export interface DailyActivity {
  id: string;
  user_id: string;
  date: string;
  steps: number | null;
  active_minutes: number | null;
  calories: number | null;
  source: string;
}

export interface Workout {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string;
  activity_type: string;
  source: string;
}

export interface SleepSession {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  source: string;
}

export interface WeightLog {
  id: string;
  user_id: string;
  logged_at: string;
  weight_kg: number;
}

export interface WaterLog {
  id: string;
  user_id: string;
  logged_at: string;
  amount_ml: number;
}

export interface Medication {
  id: string;
  user_id: string;
  name: string;
  dosage: string | null;
  schedule: { time: string }[];
  active: boolean;
}

export type MedicationLogStatus = 'pending' | 'taken' | 'skipped' | 'late';

export interface MedicationLog {
  id: string;
  user_id: string;
  medication_id: string;
  scheduled_for: string;
  taken_at: string | null;
  status: MedicationLogStatus;
}

export interface SymptomLog {
  id: string;
  user_id: string;
  logged_at: string;
  label: string;
  severity: number | null;
  notes: string | null;
}

export type ReminderType =
  'water' | 'standing' | 'walking_pad' | 'pill' | 'analysis_checkin';

export interface ReminderSetting {
  id: string;
  user_id: string;
  reminder_type: ReminderType;
  interval_minutes: number | null;
  fixed_times: string[] | null;
  active_hours: { start: string; end: string } | null;
  enabled: boolean;
}
