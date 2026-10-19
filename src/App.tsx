import { lazy, Suspense, useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ConfirmProvider, ToastProvider } from './components/ui';
import { PwaPrompt } from './components/PwaPrompt';
import { ensureSeeded } from './db/actions';
import { requestPersistence } from './db/db';
import { useProfile } from './hooks/useData';
import { Onboarding } from './pages/Onboarding';
import type { Profile } from './db/types';

const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const WorkoutPage = lazy(() => import('./pages/Workout').then((m) => ({ default: m.WorkoutPage })));
const TemplateEditor = lazy(() => import('./pages/TemplateEditor').then((m) => ({ default: m.TemplateEditor })));
const ExerciseLibrary = lazy(() => import('./pages/ExerciseLibrary').then((m) => ({ default: m.ExerciseLibrary })));
const ExerciseDetail = lazy(() => import('./pages/ExerciseDetail').then((m) => ({ default: m.ExerciseDetail })));
const CorePage = lazy(() => import('./pages/Core').then((m) => ({ default: m.CorePage })));
const CardioPage = lazy(() => import('./pages/Cardio').then((m) => ({ default: m.CardioPage })));
const NutritionPage = lazy(() => import('./pages/Nutrition').then((m) => ({ default: m.NutritionPage })));
const BodyPage = lazy(() => import('./pages/Body').then((m) => ({ default: m.BodyPage })));
const CalendarPage = lazy(() => import('./pages/Calendar').then((m) => ({ default: m.CalendarPage })));
const HistoryPage = lazy(() => import('./pages/History').then((m) => ({ default: m.HistoryPage })));
const SessionDetail = lazy(() => import('./pages/SessionDetail').then((m) => ({ default: m.SessionDetail })));
const SettingsPage = lazy(() => import('./pages/Settings').then((m) => ({ default: m.SettingsPage })));

function useApplyTheme(profile: Profile | undefined) {
  useEffect(() => {
    if (!profile) return;
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = profile.theme === 'dark' || (profile.theme === 'system' && mq.matches);
      root.classList.toggle('dark', dark);
      root.dataset.theme = dark ? 'dark' : 'light';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b0c0e' : '#f4f5f2');
    };
    apply();
    root.classList.toggle('reduce-motion', profile.reduceMotion);
    try {
      localStorage.setItem('forge-theme', profile.theme);
    } catch {
      /* storage unavailable */
    }
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [profile?.theme, profile?.reduceMotion, profile]);
}

export function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    ensureSeeded()
      .then(() => setReady(true))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    void requestPersistence();
  }, []);
  const profile = useProfile();
  useApplyTheme(profile);

  if (error) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-bold">Storage unavailable</h1>
        <p className="mt-2 text-sm text-muted">FORGE stores everything in your browser&apos;s IndexedDB, which could not be opened ({error}). Private browsing modes and some browser settings block it.</p>
      </div>
    );
  }
  if (!ready || !profile) {
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-muted" role="status">
        Loading FORGE…
      </div>
    );
  }

  return (
    <ToastProvider>
      <ConfirmProvider>
        <HashRouter>
          {!profile.onboarded ? (
            <Onboarding profile={profile} />
          ) : (
            <Layout>
              <Suspense fallback={<p className="text-sm text-muted" role="status">Loading…</p>}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/workout" element={<WorkoutPage />} />
                <Route path="/workout/templates" element={<TemplateEditor />} />
                <Route path="/exercises" element={<ExerciseLibrary />} />
                <Route path="/exercises/:id" element={<ExerciseDetail />} />
                <Route path="/core" element={<CorePage />} />
                <Route path="/cardio" element={<CardioPage />} />
                <Route path="/nutrition" element={<NutritionPage />} />
                <Route path="/body" element={<BodyPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/history/:id" element={<SessionDetail />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              </Suspense>
            </Layout>
          )}
        </HashRouter>
        <PwaPrompt />
      </ConfirmProvider>
    </ToastProvider>
  );
}
