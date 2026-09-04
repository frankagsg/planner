import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  CalendarDays,
  CheckSquare,
  GraduationCap,
  Heart,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { useResource } from '../hooks/useResource';
import { useSettings } from '../context/SettingsContext';
import type { DashboardData } from '../types';
import { ClockWidget } from '../components/widgets/ClockWidget';
import { WeatherWidget } from '../components/widgets/WeatherWidget';
import { CountdownWidget } from '../components/widgets/CountdownWidget';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { relative } from '../lib/dates';

function SectionCard({
  title,
  icon: Icon,
  to,
  children,
}: {
  title: string;
  icon: typeof CalendarDays;
  to: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5 flex flex-col">
      <Link to={to} className="flex items-center justify-between mb-3 group">
        <h2 className="text-xl font-display font-bold text-content flex items-center gap-2">
          <Icon size={22} className="text-accent" /> {title}
        </h2>
        <ChevronRight className="text-content-faint group-active:translate-x-1 transition" />
      </Link>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export default function HomePage() {
  const { get } = useSettings();
  const { data } = useResource<DashboardData>('/dashboard', []);
  const personalEnabled = get<boolean>('personal.enabled', true);
  const household = get<string>('general.householdName', 'Our Home');

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-display font-bold text-content">
          {greeting} 💛
        </h1>
        <p className="text-content-soft text-lg">{household}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column: clock + weather */}
        <div className="space-y-5">
          <ClockWidget />
          <ErrorBoundary area="Weather">
            <WeatherWidget />
          </ErrorBoundary>
          {data?.countdowns && data.countdowns.length > 0 && (
            <CountdownWidget items={data.countdowns} />
          )}
        </div>

        {/* Middle column: today's events + tasks */}
        <div className="space-y-5">
          <SectionCard title="Today" icon={CalendarDays} to="/calendar">
            {data?.todayEvents?.length ? (
              <ul className="space-y-2">
                {data.todayEvents.slice(0, 6).map((e) => (
                  <li key={e.id} className="flex items-center gap-3">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: e.color || 'rgb(var(--accent))' }}
                    />
                    <span className="font-semibold text-content flex-1 line-clamp-1">
                      {e.title}
                    </span>
                    <span className="text-sm text-content-faint">
                      {e.all_day ? 'All day' : format(new Date(e.start), 'h:mm a')}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-content-faint">Nothing scheduled today.</p>
            )}
          </SectionCard>

          <SectionCard title="Tasks" icon={CheckSquare} to="/tasks">
            {data?.tasksToday?.length ? (
              <ul className="space-y-2">
                {data.tasksToday.slice(0, 6).map((t) => (
                  <li key={t.id} className="flex items-center gap-3">
                    <span
                      className={`w-3 h-3 rounded-full shrink-0 ${
                        t.priority === 'high' ? 'bg-rose-400' : 'bg-accent'
                      }`}
                    />
                    <span className="font-semibold text-content flex-1 line-clamp-1">
                      {t.title}
                    </span>
                    {t.due && (
                      <span className="text-sm text-content-faint flex items-center gap-1">
                        <Clock size={13} /> {format(new Date(t.due), 'h:mm a')}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-content-faint">No tasks due today. 🎉</p>
            )}
            {data && (
              <p className="text-sm text-content-faint mt-3">
                {data.tasksOpen} open task{data.tasksOpen === 1 ? '' : 's'} total
              </p>
            )}
          </SectionCard>
        </div>

        {/* Right column: school + personal + notes */}
        <div className="space-y-5">
          <SectionCard title="School" icon={GraduationCap} to="/school">
            {data?.schoolSummary ? (
              <div className="space-y-2">
                <p className="text-lg text-content">
                  <span className="font-bold text-2xl text-accent-ink">
                    {data.schoolSummary.remaining}
                  </span>{' '}
                  item{data.schoolSummary.remaining === 1 ? '' : 's'} remaining
                </p>
                <div className="flex gap-2 flex-wrap">
                  {data.schoolSummary.dueToday > 0 && (
                    <span className="chip bg-accent-soft text-accent-ink">
                      {data.schoolSummary.dueToday} due today
                    </span>
                  )}
                  {data.schoolSummary.overdue > 0 && (
                    <span className="chip bg-amber-100 text-amber-700">
                      {data.schoolSummary.overdue} to catch up
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-content-faint">No school items yet.</p>
            )}
          </SectionCard>

          {personalEnabled && data?.personal?.enabled ? (
            <SectionCard title="Us" icon={Heart} to="/personal">
              {data.personal.message && (
                <p className="text-lg text-content italic">"{data.personal.message}"</p>
              )}
              {data.personal.next_date_at && (
                <p className="text-content-soft mt-2">
                  Next date {relative(data.personal.next_date_at)}
                  {data.personal.next_date_note ? ` · ${data.personal.next_date_note}` : ''}
                </p>
              )}
            </SectionCard>
          ) : null}

          {data?.pinnedNotes && data.pinnedNotes.length > 0 && (
            <SectionCard title="Pinned notes" icon={CheckSquare} to="/notes">
              <ul className="space-y-2">
                {data.pinnedNotes.map((n) => (
                  <li
                    key={n.id}
                    className="rounded-xl p-3 text-content"
                    style={{ backgroundColor: n.color }}
                  >
                    <div className="font-bold line-clamp-1">{n.title || 'Note'}</div>
                    <div className="text-sm line-clamp-2 opacity-80">{n.body}</div>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}
