import { Link } from 'react-router-dom';
import { Activity, BedDouble, Bell, Check, Dumbbell, Footprints, LayoutDashboard, Moon, Play, Salad, Scale, Coffee } from 'lucide-react';
import type { Profile, RecoveryEntry, ScheduledActivity } from '../db/types';
import { useActiveSession, useBodyWeights, useCardio, useFoods, useOverrides, useProfile, useRecovery, useSchedule, useSessions, useTemplates, useWater } from '../hooks/useData';
import { useNow, useToday } from '../hooks/useNow';
import { PHASES, phaseStatus } from '../data/phases';
import { applyCoreOption, describeActivity } from '../data/program';
import { getExercise } from '../data/exercises';
import { activityForDate, adherence, completedWorkingSets, sessionsInRange, sessionVolumeKg, weeklyTraining } from '../lib/training';
import { calorieTarget, cardioMinutes, dayTotals, movingAverage7, recoveryAverages, waterForDate, weeklyCardio, weeklyWeightChange } from '../lib/metrics';
import { addDays, formatDate, formatLongDate, startOfWeek, WEEKDAYS_SHORT } from '../lib/dates';
import { formatVolume, formatWeight, kgToUnit, round } from '../lib/units';
import { Badge, Button, Card, EmptyState, ProgressBar, Stat, cx } from '../components/ui';
import { SeriesChart } from '../components/Chart';
import { MedicalNotice, PendingBadge } from '../components/MedicalNotice';
import { needsClearance } from '../lib/health';

function ActivityIcon({ a, className }: { a: ScheduledActivity; className?: string }) {
  const Icon = a.kind === 'workout' ? Dumbbell : a.kind === 'walk' ? Footprints : a.kind === 'cardio' ? Activity : Coffee;
  return <Icon className={className} aria-hidden />;
}

function Reminders({ profile, recovery, todayDate }: { profile: Profile; recovery: RecoveryEntry[]; todayDate: string }) {
  const now = useNow(60_000);
  if (!profile.remindersEnabled) return null;
  const msgs: string[] = [];
  const d = new Date(now);
  if (profile.bedtime) {
    const [h, m] = profile.bedtime.split(':').map(Number);
    const bed = new Date(d);
    bed.setHours(h, m, 0, 0);
    const mins = (bed.getTime() - d.getTime()) / 60000;
    if (mins > 0 && mins <= 60) msgs.push(`Bedtime in ${Math.round(mins)} min — time to wind down and dim the screens.`);
  }
  if (d.getHours() >= 5 && !recovery.some((r) => r.date === todayDate)) msgs.push("You haven't logged last night's sleep yet.");
  if (!msgs.length) return null;
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3 text-sm" role="status">
      <Bell className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" aria-hidden />
      <div className="flex-1 space-y-0.5">{msgs.map((m) => <p key={m}>{m}</p>)}</div>
      <Link to="/body?tab=recovery" className="text-xs font-semibold text-accent-ink hover:underline">Log</Link>
    </div>
  );
}

export function Dashboard() {
  const profile = useProfile();
  const sessions = useSessions();
  const active = useActiveSession();
  const templates = useTemplates();
  const schedule = useSchedule();
  const overrides = useOverrides();
  const weights = useBodyWeights();
  const cardio = useCardio();
  const foods = useFoods();
  const water = useWater();
  const recovery = useRecovery();
  const todayDate = useToday();
  if (!profile || !sessions || !schedule || !weights || !cardio || !foods || !recovery) return <p className="text-sm text-muted">Loading…</p>;

  const unit = profile.units;
  const phase = phaseStatus(profile.programStartDate, todayDate);
  const planned = activityForDate(schedule, overrides, todayDate);
  const tName = (id: string) => templates.find((t) => t.id === id)?.name ?? 'Workout';
  const plannedTemplate = planned.kind === 'workout' ? templates.find((t) => t.id === planned.templateId) : undefined;
  const todayDone = sessions.filter((s) => s.status === 'completed' && s.date === todayDate);

  const ws = startOfWeek(todayDate);
  const we = addDays(ws, 6);
  const weekSessions = sessionsInRange(sessions, ws, we);
  // Planned workouts are only counted from the program start date onward.
  const weekAdh = adherence(sessions, schedule, overrides, profile.programStartDate > ws ? profile.programStartDate : ws, we);
  const weekSets = weekSessions.reduce((n, s) => n + completedWorkingSets(s), 0);
  const weekVolume = weekSessions.reduce((n, s) => n + sessionVolumeKg(s), 0);
  const weekCardio = cardioMinutes(cardio, ws, we);
  const sinceStart = phase.started ? adherence(sessions, schedule, overrides, profile.programStartDate, todayDate) : null;

  const nToday = dayTotals(foods, todayDate);
  const kcalTarget = calorieTarget(profile);
  const waterMl = waterForDate(water, todayDate);

  const trend = movingAverage7(weights);
  const latestW = trend[trend.length - 1];
  const wChange = weeklyWeightChange(trend);
  const rec7 = recoveryAverages(recovery, addDays(todayDate, -6), todayDate);
  const lastRec = recovery[recovery.length - 1];

  const weekly = weeklyTraining(sessions, 8, todayDate);
  const cardioWeeks = weeklyCardio(cardio, 8, todayDate);
  const weightPts = trend.filter((p) => p.date >= addDays(todayDate, -60));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 animate-in">
        <div>
          <p className="text-sm text-muted">{formatLongDate(todayDate)}</p>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <LayoutDashboard className="h-6 w-6 text-accent-ink" aria-hidden />
            {profile.name ? `Hey ${profile.name}` : 'Dashboard'}
          </h1>
        </div>
        <PendingBadge profile={profile} />
      </header>

      <MedicalNotice profile={profile} compact />
      <Reminders profile={profile} recovery={recovery} todayDate={todayDate} />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Today */}
        <Card title="Today" className="lg:col-span-2">
          {active ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-bold">{active.templateName} in progress</p>
                <p className="text-sm text-muted">{completedWorkingSets(active)} working sets ticked so far{active.status === 'paused' ? ' · paused' : ''}</p>
              </div>
              <Link to="/workout"><Button variant="primary" icon={Play}>Continue workout</Button></Link>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent/15"><ActivityIcon a={planned} className="h-5 w-5 text-accent-ink" /></div>
                  <div>
                    <p className="text-lg font-bold">{describeActivity(planned, tName)}</p>
                    <p className="text-sm text-muted">{planned.kind === 'rest' ? 'Recover, sleep well, and keep protein up.' : planned.kind === 'workout' ? (needsClearance(profile) ? 'Planned — pending medical clearance' : 'Planned session') : 'Comfortable, conversational pace'}</p>
                  </div>
                </div>
                {todayDone.length > 0 ? (
                  <Link to={`/history/${todayDone[0].id}`}><Badge tone="ok"><Check className="h-3 w-3" /> {todayDone[0].templateName} completed</Badge></Link>
                ) : planned.kind === 'workout' ? (
                  <Link to="/workout"><Button variant="primary" icon={Play}>Open tracker</Button></Link>
                ) : planned.kind !== 'rest' ? (
                  <Link to="/cardio"><Button icon={Activity}>Log cardio</Button></Link>
                ) : null}
              </div>
              {plannedTemplate && todayDone.length === 0 && (
                <ul className="mt-4 grid gap-1.5 text-sm sm:grid-cols-2">
                  {applyCoreOption(plannedTemplate.id, plannedTemplate.exercises, profile.coreOption, profile.sidePlankOn).map((e) => (
                    <li key={e.uid} className="flex justify-between gap-2 rounded-lg bg-surface-2 px-3 py-1.5">
                      <span className="truncate">{getExercise(e.exerciseId)?.name}</span>
                      <span className="shrink-0 text-xs tabular text-subtle">{e.sets}×{e.repMin}–{e.repMax}{e.measure === 'time' ? 's' : ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Card>

        {/* Phase */}
        <Card title="12-week phase">
          {phase.phase ? (
            <>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-bold">Week {phase.week}<span className="text-sm font-medium text-muted"> / 12</span></p>
                <Badge tone="accent">{phase.phase.targetRir}</Badge>
              </div>
              <p className="mt-1 font-semibold">{phase.phase.name}</p>
              <ProgressBar className="mt-3" value={phase.week} max={12} label="Program progress" />
              <p className="mt-3 text-sm text-muted">{phase.phase.summary}</p>
              <ol className="mt-3 flex gap-1" aria-label="Phases">
                {PHASES.map((p) => (
                  <li key={p.id} title={`${p.name}: weeks ${p.weeks[0]}–${p.weeks[1]}`} className={cx('h-1.5 rounded-full', p.id === phase.phase!.id ? 'bg-accent' : 'bg-surface-2')} style={{ flex: p.weeks[1] - p.weeks[0] + 1 }} />
                ))}
              </ol>
            </>
          ) : phase.complete ? (
            <p className="text-sm text-muted">Your 12-week block is complete. Review your progress, then start a new block in Settings.</p>
          ) : (
            <p className="text-sm text-muted">Your program starts on {formatDate(profile.programStartDate, { day: 'numeric', month: 'long' })} ({phase.daysUntilStart} day(s)).</p>
          )}
        </Card>
      </div>

      {/* Week plan */}
      <Card title="This week">
        <ol className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }, (_, i) => addDays(ws, i)).map((d, i) => {
            const a = activityForDate(schedule, overrides, d);
            const done = sessions.some((s) => s.status === 'completed' && s.date === d);
            const cardioDone = cardio.some((c) => c.date === d);
            const isToday = d === todayDate;
            const ok = done || ((a.kind === 'walk' || a.kind === 'cardio') && cardioDone);
            return (
              <li key={d} className={cx('flex flex-col items-center gap-1 rounded-xl border p-2 text-center', isToday ? 'border-accent/60 bg-accent/10' : 'border-line bg-surface-2/50')} aria-label={`${WEEKDAYS_SHORT[i]}: ${describeActivity(a, tName)}${ok ? ', done' : ''}`}>
                <span className="text-[11px] font-semibold uppercase text-subtle">{WEEKDAYS_SHORT[i]}</span>
                <ActivityIcon a={a} className={cx('h-4 w-4', ok ? 'text-accent-ink' : 'text-muted')} />
                <span className="hidden text-[11px] leading-tight text-muted sm:block">{a.kind === 'workout' ? tName(a.templateId).replace('Workout ', '') : a.kind === 'walk' ? 'Walk' : a.kind === 'cardio' ? 'Cardio' : 'Rest'}</span>
                {ok ? <Check className="h-3.5 w-3.5 text-accent-ink" aria-hidden /> : <span className="h-3.5" />}
              </li>
            );
          })}
        </ol>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Workouts" value={weekAdh.planned > 0 ? `${weekAdh.completed}/${weekAdh.planned}` : weekAdh.completed} hint={weekAdh.planned > 0 ? 'completed / planned this week' : 'completed · none planned this week'} tone="accent" />
          <Stat label="Working sets" value={weekSets} hint="completed this week" />
          <Stat label="Volume lifted" value={formatVolume(weekVolume, unit)} hint="load × reps" />
          <Stat label="Cardio" value={weekCardio} unit="min" hint="logged this week" />
        </div>
        {sinceStart && sinceStart.percent != null && <p className="mt-3 text-xs text-muted">Training adherence since program start: <strong className="text-fg">{sinceStart.percent}%</strong> ({sinceStart.completed} of {sinceStart.planned} planned workouts).</p>}
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Nutrition today" action={<Link to="/nutrition" className="text-xs font-semibold text-accent-ink hover:underline">Log food</Link>}>
          {nToday.entries === 0 && waterMl === 0 ? (
            <EmptyState icon={Salad} title="No food logged today">Protein target {profile.proteinMinG}–{profile.proteinMaxG} g{kcalTarget ? ` · ${kcalTarget.toLocaleString()} kcal` : ''}.</EmptyState>
          ) : (
            <div className="space-y-3 text-sm">
              <div>
                <div className="mb-1 flex justify-between"><span className="text-muted">Protein</span><span className="font-semibold tabular">{Math.round(nToday.proteinG)} / {profile.proteinMinG}–{profile.proteinMaxG} g</span></div>
                <ProgressBar value={nToday.proteinG} max={profile.proteinMinG} label="Protein" />
              </div>
              <div>
                <div className="mb-1 flex justify-between"><span className="text-muted">Calories</span><span className="font-semibold tabular">{Math.round(nToday.calories).toLocaleString()}{kcalTarget ? ` / ${kcalTarget.toLocaleString()}` : ''} kcal</span></div>
                {kcalTarget ? <ProgressBar value={nToday.calories} max={kcalTarget} label="Calories" /> : <p className="text-xs text-subtle">No calorie target set.</p>}
              </div>
              <div>
                <div className="mb-1 flex justify-between"><span className="text-muted">Water</span><span className="font-semibold tabular">{(waterMl / 1000).toFixed(2)} / {(profile.waterTargetMl / 1000).toFixed(1)} L</span></div>
                <ProgressBar value={waterMl} max={profile.waterTargetMl} label="Water" />
              </div>
            </div>
          )}
        </Card>

        <Card title="Body weight" action={<Link to="/body" className="text-xs font-semibold text-accent-ink hover:underline">Log weight</Link>}>
          {latestW ? (
            <div className="grid grid-cols-2 gap-3">
              <Stat label="7-day avg" value={formatWeight(latestW.avg7Kg, unit)} tone="accent" hint={`latest ${formatWeight(latestW.weightKg, unit)}`} />
              <Stat label="Trend / week" value={wChange != null ? `${wChange >= 0 ? '+' : ''}${formatWeight(wChange, unit, 2)}` : '—'} hint={wChange == null ? 'needs ≥ 7 days' : 'last 14 days'} />
            </div>
          ) : (
            <EmptyState icon={Scale} title="No weight data available" />
          )}
        </Card>

        <Card title="Recovery" action={<Link to="/body?tab=recovery" className="text-xs font-semibold text-accent-ink hover:underline">Log recovery</Link>}>
          {recovery.length === 0 ? (
            <EmptyState icon={BedDouble} title="No recovery data available">Log sleep, fatigue and readiness.</EmptyState>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Sleep · 7d avg" value={rec7.sleepHours != null ? rec7.sleepHours.toFixed(1) : '—'} unit={rec7.sleepHours != null ? 'h' : undefined} tone="accent" hint={`${rec7.days} night(s) logged`} />
              <Stat label="Last readiness" value={lastRec?.readiness ?? '—'} unit={lastRec?.readiness != null ? '/ 5' : undefined} hint={lastRec ? formatDate(lastRec.date) : undefined} />
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Body weight trend · 60 days">
          <SeriesChart
            title="Body weight"
            data={weightPts.map((p) => ({ x: p.date, label: formatDate(p.date), raw: round(kgToUnit(p.weightKg, unit), 0.1), avg: round(kgToUnit(p.avg7Kg, unit), 0.1) }))}
            series={[
              { key: 'raw', label: 'Weigh-in', kind: 'dots', colorVar: '--subtle', unit, digits: 1 },
              { key: 'avg', label: '7-day average', kind: 'line', colorVar: '--accent', unit, digits: 1 },
            ]}
            yDomain={['auto', 'auto']}
            empty={<EmptyState icon={Scale} title="No weight data available">Your trend appears after your first weigh-ins.</EmptyState>}
          />
        </Card>
        <Card title="Weekly volume · 8 weeks">
          <SeriesChart
            title="Weekly training volume"
            data={weekly.map((w) => ({ x: w.weekStart, label: formatDate(w.weekStart), vol: Math.round(kgToUnit(w.volumeKg, unit)), sets: w.workingSets }))}
            series={[{ key: 'vol', label: 'Volume', kind: 'bar', colorVar: '--accent', unit }]}
            empty={<EmptyState icon={Dumbbell} title="No training data available">Complete a workout to see weekly volume.</EmptyState>}
          />
        </Card>
        <Card title="Working sets per week">
          <SeriesChart
            title="Working sets per week"
            data={weekly.map((w) => ({ x: w.weekStart, label: formatDate(w.weekStart), sets: w.workingSets }))}
            series={[{ key: 'sets', label: 'Working sets', kind: 'bar', colorVar: '--accent', unit: 'sets' }]}
            empty={<EmptyState icon={Dumbbell} title="No training data available" />}
          />
        </Card>
        <Card title="Cardio minutes · 8 weeks">
          <SeriesChart
            title="Weekly cardio minutes"
            data={cardioWeeks.map((w) => ({ x: w.weekStart, label: formatDate(w.weekStart), min: w.minutes }))}
            series={[{ key: 'min', label: 'Cardio', kind: 'bar', colorVar: '--accent', unit: 'min' }]}
            referenceY={150}
            referenceLabel="150 min"
            empty={<EmptyState icon={Moon} title="No cardio data available">Log a walk to start your cardio chart.</EmptyState>}
          />
        </Card>
      </div>
    </div>
  );
}
