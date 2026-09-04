export interface Category {
  id: number;
  name: string;
  color: string;
  icon?: string | null;
  kind: 'general' | 'school' | 'personal';
}

export interface EventItem {
  id: number;
  title: string;
  description?: string | null;
  location?: string | null;
  start: string;
  end: string;
  all_day: number;
  category_id?: number | null;
  color?: string | null;
  source: 'local' | 'google';
  google_id?: string | null;
  google_cal_id?: string | null;
  rrule?: string | null;
}

export interface Task {
  id: number;
  title: string;
  notes?: string | null;
  due?: string | null;
  priority: 'low' | 'normal' | 'high';
  category_id?: number | null;
  completed: number;
  completed_at?: string | null;
  sort_order: number;
}

export interface Note {
  id: number;
  title?: string | null;
  body: string;
  color: string;
  pinned: number;
  updated_at: string;
}

export interface SchoolClass {
  id: number;
  name: string;
  code?: string | null;
  instructor?: string | null;
  color: string;
  term?: string | null;
  schedule?: string | null;
  location?: string | null;
  archived: number;
}

export type SchoolKind =
  | 'assignment'
  | 'exam'
  | 'clinical'
  | 'study'
  | 'reading'
  | 'project';

export interface SchoolItem {
  id: number;
  class_id?: number | null;
  title: string;
  kind: SchoolKind;
  due?: string | null;
  notes?: string | null;
  completed: number;
  completed_at?: string | null;
  class_name?: string | null;
  class_color?: string | null;
}

export interface SchoolSummary {
  remaining: number;
  completed: number;
  dueToday: number;
  dueTomorrow: number;
  dueThisWeek: number;
  overdue: number;
}

export interface Countdown {
  id: number;
  label: string;
  target: string;
  color: string;
  icon?: string | null;
}

export interface PersonalConfig {
  id: number;
  enabled: number;
  partner_a: string;
  partner_b: string;
  message?: string | null;
  next_date_at?: string | null;
  next_date_note?: string | null;
  photo_interval: number;
}

export interface PersonalEvent {
  id: number;
  title: string;
  at: string;
  note?: string | null;
}

export interface PersonalPayload {
  config: PersonalConfig;
  events: PersonalEvent[];
  photos: string[];
}

export interface WeatherHour {
  time: string;
  temp: number;
  precipProb: number | null;
  icon: string;
  text: string;
}
export interface WeatherDay {
  date: string;
  hi: number;
  lo: number;
  precipProb: number | null;
  sunrise?: string | null;
  sunset?: string | null;
  icon: string;
  text: string;
}
export interface Weather {
  current?: {
    temp: number;
    feelsLike: number;
    humidity: number;
    precip: number;
    wind: number;
    icon: string;
    text: string;
  };
  hourly?: WeatherHour[];
  daily?: WeatherDay[];
  location?: { lat: number; lon: number; label: string; units: string };
  provider?: string;
  cached?: boolean;
  stale?: boolean;
  error?: string;
  available?: boolean;
  fetchedAt?: string;
}

export interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  redirectUri: string;
  selectedCalendars: string[];
}

export interface GoogleCalendar {
  id: string;
  summary: string;
  primary: boolean;
  backgroundColor?: string;
  accessRole?: string;
}

export type Settings = Record<string, unknown>;

export interface DashboardData {
  todayEvents: EventItem[];
  upcomingEvents: EventItem[];
  tasksToday: Task[];
  tasksOpen: number;
  schoolSummary: Pick<SchoolSummary, 'remaining' | 'dueToday' | 'overdue'>;
  pinnedNotes: Note[];
  countdowns: Countdown[];
  personal: PersonalConfig;
  generatedAt: string;
}

export interface BackupInfo {
  name: string;
  size: number;
  createdAt: string;
}
