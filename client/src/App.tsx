import { useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { OfflineBadge } from './components/OfflineBadge';
import { Screensaver } from './components/Screensaver';
import { VirtualKeyboard } from './components/ui/VirtualKeyboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useIdle } from './hooks/useIdle';
import { useSettings } from './context/SettingsContext';
import { SetupWizard } from './pages/SetupWizard';

import HomePage from './pages/HomePage';
import CalendarPage from './pages/CalendarPage';
import TasksPage from './pages/TasksPage';
import ChoresPage from './pages/ChoresPage';
import MealsPage from './pages/MealsPage';
import ListsPage from './pages/ListsPage';
import SchoolPage from './pages/SchoolPage';
import NotesPage from './pages/NotesPage';
import PersonalPage from './pages/PersonalPage';
import SettingsPage from './pages/SettingsPage';
import { PlannerBackground } from './components/appearance/PlannerBackground';
import { readAppearance } from './lib/appearance';

export default function App() {
  const { get, ready, settings } = useSettings();
  const appearance = readAppearance(settings);
  const firstRunComplete = get<boolean>('general.firstRunComplete', false);
  const [wizardDone, setWizardDone] = useState(false);

  const screensaverMinutes = get<number>('display.screensaverMinutes', 10);
  const idle = useIdle(firstRunComplete ? screensaverMinutes : 0);
  const [dismissed, setDismissed] = useState(false);
  const location = useLocation();

  if (!ready) {
    return (
      <div className="h-full flex items-center justify-center bg-surface">
        <div className="text-content-soft text-xl animate-pulse">Loading…</div>
      </div>
    );
  }

  if (!firstRunComplete && !wizardDone) {
    return <SetupWizard onComplete={() => setWizardDone(true)} />;
  }

  const showSaver = idle && !dismissed;

  return (
    <div className="h-full flex bg-surface overflow-hidden relative isolate">
      {(appearance.background.scope === 'all' || location.pathname === '/') && <PlannerBackground appearance={appearance} />}
      <Sidebar />
      <main className="flex-1 h-full overflow-y-auto no-scrollbar relative">
        <div className="h-full min-h-full pb-[var(--vk-pad,0)]">
          <ErrorBoundary area="Page" key={location.pathname}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/chores" element={<ChoresPage />} />
              <Route path="/meals" element={<MealsPage />} />
              <Route path="/lists" element={<ListsPage />} />
              <Route path="/school" element={<SchoolPage />} />
              <Route path="/notes" element={<NotesPage />} />
              <Route path="/personal" element={<PersonalPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<HomePage />} />
            </Routes>
          </ErrorBoundary>
        </div>
      </main>

      <OfflineBadge />
      <VirtualKeyboard />
      {showSaver && (
        <Screensaver
          onDismiss={() => {
            setDismissed(true);
            setTimeout(() => setDismissed(false), 1000);
          }}
        />
      )}
    </div>
  );
}
