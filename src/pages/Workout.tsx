import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, Check, ChevronRight, Dumbbell, Flag, Info, Pause, Pencil, Play, Plus, RotateCcw, SkipForward, Timer, Trash2, Trophy, TrendingUp, X } from 'lucide-react';
import type { LoggedSet, Profile, SessionExercise, TemplateExercise, WorkoutSession, WorkoutTemplate } from '../db/types';
import { db } from '../db/db';
import { saveSession } from '../db/actions';
import { useActiveSession, useOverrides, useProfile, useSchedule, useSessions, useTemplates } from '../hooks/useData';
import { useNow, useToday } from '../hooks/useNow';
import { applyCoreOption, describeActivity } from '../data/program';
import { EXERCISES, getExercise } from '../data/exercises';
import { phaseStatus } from '../data/phases';
import { activityForDate, evaluateProgression, exerciseHistory, lastWorkingWeightKg, personalBests, summarizeSession } from '../lib/training';
import * as S from '../lib/session';
import { formatDate, formatDuration } from '../lib/dates';
import { displayLoad, formatVolume, formatWeight, kgToUnit, parseNumber, round, unitToKg } from '../lib/units';
import { Badge, Button, Card, EmptyState, IconButton, PageHeader, SelectInput, Toggle, cx, inputClass, useConfirm, useToast } from '../components/ui';
import { MedicalNotice, PendingBadge, concernsText } from '../components/MedicalNotice';
import { ExerciseImage } from '../components/ExerciseImage';
import { needsClearance } from '../lib/health';

export function WorkoutPage() {
  const profile = useProfile();
  const active = useActiveSession();
  const sessions = useSessions();
  if (!profile || active === undefined || !sessions) return <p className="text-sm text-muted">Loading…</p>;
  return active ? <ActiveSession key={active.id} initial={active} profile={profile} sessions={sessions} /> : <StartWorkout profile={profile} sessions={sessions} />;
}

/* ====================== Start screen ====================== */

function restLabel(min: number, max: number) {
  const f = (s: number) => (s % 60 === 0 ? `${s / 60} min` : s > 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min` : `${s} s`);
  if (min === max) return f(min);
  if (min % 60 === 0 && max % 60 === 0) return `${min / 60}–${max / 60} min`;
  if (max <= 120 && min >= 60 && min !== max) return `${min}–${max} s`;
  return `${f(min)}–${f(max)}`;
}

export function prescriptionLabel(t: Pick<TemplateExercise, 'sets' | 'repMin' | 'repMax' | 'measure' | 'perSide' | 'restMinSec' | 'restMaxSec'>) {
  const reps = t.repMin === t.repMax ? `${t.repMin}` : `${t.repMin}–${t.repMax}`;
  return `${t.sets} × ${reps}${t.measure === 'time' ? ' s' : ''}${t.perSide ? ' per side' : ''} · rest ${restLabel(t.restMinSec, t.restMaxSec)}`;
}

function StartWorkout({ profile, sessions }: { profile: Profile; sessions: WorkoutSession[] }) {
  const templates = useTemplates();
  const schedule = useSchedule();
  const overrides = useOverrides();
  const todayDate = useToday();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [deload, setDeload] = useState(false);
  const phase = phaseStatus(profile.programStartDate, todayDate);
  const planned = schedule ? activityForDate(schedule, overrides, todayDate) : null;
  const doneToday = sessions.filter((s) => s.status === 'completed' && s.date === todayDate);

  useEffect(() => {
    if (phase.week === 7) setDeload(true);
  }, [phase.week]);

  const start = async (t: WorkoutTemplate) => {
    if (needsClearance(profile)) {
      const ok = await confirm({
        title: 'Medical clearance not recorded',
        message: (
          <div className="space-y-2">
            <p>This program is pending medical clearance. Because you reported {concernsText(profile)}, a medical evaluation is recommended before resistance training.</p>
            <p>You can still use the tracker to log what you do. Keep effort light and stop if symptoms appear.</p>
          </div>
        ),
        confirmLabel: 'I understand — open tracker',
      });
      if (!ok) return;
    }
    const exercises = applyCoreOption(t.id, t.exercises, profile.coreOption, profile.sidePlankOn);
    const s = S.createSession({
      templateId: t.id,
      templateName: t.name,
      exercises,
      date: todayDate,
      now: Date.now(),
      programWeek: phase.week >= 1 ? phase.week : null,
      previousWeightKg: (id) => lastWorkingWeightKg(sessions, id),
      deload,
    });
    await saveSession(s);
    navigate('/workout');
  };

  const plannedTemplateId = planned?.kind === 'workout' ? planned.templateId : null;
  const ordered = [...templates].sort((a, b) => (a.id === plannedTemplateId ? -1 : b.id === plannedTemplateId ? 1 : a.name.localeCompare(b.name)));

  return (
    <div className="space-y-5">
      <PageHeader title="Workout Tracker" icon={Dumbbell} subtitle={<span className="flex flex-wrap items-center gap-2">Log sets, reps, load and effort. Sessions save as you go. <PendingBadge profile={profile} /></span>} actions={<Link to="/workout/templates"><Button icon={Pencil}>Edit workouts</Button></Link>} />
      <MedicalNotice profile={profile} compact />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Today · {formatDate(todayDate, { weekday: 'long', day: 'numeric', month: 'short' })}</p>
            <p className="mt-1 text-lg font-semibold">{planned ? describeActivity(planned, (id) => templates.find((t) => t.id === id)?.name ?? id) : '—'}</p>
            <p className="text-sm text-muted">
              {phase.phase ? `Week ${phase.week} · ${phase.phase.name} · target ${phase.phase.targetRir}` : phase.complete ? '12-week block complete — set a new start date in Settings.' : `Program starts in ${phase.daysUntilStart} day(s).`}
            </p>
          </div>
          {doneToday.length > 0 && <Badge tone="ok"><Check className="h-3 w-3" /> {doneToday.length} session{doneToday.length > 1 ? 's' : ''} logged today</Badge>}
        </div>
        <div className="mt-4 rounded-xl bg-surface-2 p-3">
          <Toggle checked={deload} onChange={setDeload} label="Deload session" description="Roughly halves working sets (rounded up). Suggested in week 7 if fatigue has built up." />
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ordered.map((t) => {
          const list = applyCoreOption(t.id, t.exercises, profile.coreOption, profile.sidePlankOn);
          const sets = list.reduce((n, e) => n + (deload ? S.deloadSets(e.sets) : e.sets), 0);
          return (
            <Card key={t.id} className={cx(t.id === plannedTemplateId && 'border-accent/60')}>
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold">{t.name}</h2>
                  <p className="text-xs text-muted">
                    {list.length} exercises · {sets} working sets
                  </p>
                </div>
                {t.id === plannedTemplateId && <Badge tone="accent">Planned today</Badge>}
              </div>
              <ul className="mb-4 space-y-1.5 text-sm">
                {list.map((e) => (
                  <li key={e.uid} className="flex justify-between gap-2">
                    <span className="truncate">{getExercise(e.exerciseId)?.name ?? e.exerciseId}</span>
                    <span className="shrink-0 text-xs tabular text-subtle">
                      {deload ? S.deloadSets(e.sets) : e.sets}×{e.repMin === e.repMax ? e.repMin : `${e.repMin}–${e.repMax}`}
                      {e.measure === 'time' ? 's' : ''}
                    </span>
                  </li>
                ))}
              </ul>
              <Button variant={t.id === plannedTemplateId ? 'primary' : 'secondary'} icon={Play} className="w-full" onClick={() => start(t)}>
                Start {t.name}
              </Button>
            </Card>
          );
        })}
      </div>
      {templates.length === 0 && <EmptyState icon={Dumbbell} title="No workout templates" action={<Link to="/workout/templates"><Button variant="primary">Create a workout</Button></Link>} />}
    </div>
  );
}

/* ====================== Active session ====================== */

function beep() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.4);
    setTimeout(() => void ctx.close(), 600);
  } catch {
    /* audio unavailable */
  }
}

function ActiveSession({ initial, profile, sessions }: { initial: WorkoutSession; profile: Profile; sessions: WorkoutSession[] }) {
  const [s, setS] = useState(initial);
  const ref = useRef(initial);
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const now = useNow(250);
  const unit = profile.units;

  const update = (fn: (x: WorkoutSession, now: number) => WorkoutSession) => {
    const next = fn(ref.current, Date.now());
    if (next === ref.current) return;
    ref.current = next;
    setS(next);
    saveSession(next).catch(() => toast('Could not save — storage error', 'error'));
  };

  // Rest timer completion
  const remaining = S.restRemainingMs(s, now);
  const notified = useRef<number | null>(null);
  useEffect(() => {
    const t = s.restTimer;
    if (t?.endsAt && remaining === 0 && notified.current !== t.endsAt) {
      notified.current = t.endsAt;
      navigator.vibrate?.([200, 100, 200]);
      beep();
      toast('Rest complete');
    }
  }, [remaining, s.restTimer, toast]);

  const elapsed = S.elapsedMs(s, now);
  const summary = summarizeSession(s, elapsed);

  const toggle = (ex: SessionExercise, set: LoggedSet) => {
    const res = S.toggleSetComplete(ref.current, ex.uid, set.id, Date.now());
    if (res.error) {
      toast(res.error, 'error');
      return;
    }
    ref.current = res.session;
    let next = res.session;
    const nowCompleted = next.exercises.find((e) => e.uid === ex.uid)?.sets.find((x) => x.id === set.id)?.completed;
    if (nowCompleted && next.status === 'active') next = S.startRestTimer(next, set.kind === 'warmup' ? Math.min(60, ex.prescribed.restMinSec) : ex.prescribed.restMinSec, ex.uid, Date.now());
    ref.current = next;
    setS(next);
    void saveSession(next);
  };

  const finish = async () => {
    const incomplete = summary.plannedSets - summary.workingSets;
    const ok = await confirm({
      title: 'Finish workout?',
      message: incomplete > 0 ? `${incomplete} working set(s) are not ticked. Unticked sets are kept in the record but don't count toward volume or completed sets.` : 'Great work. The session will be saved to your history.',
      confirmLabel: 'Finish & save',
    });
    if (!ok) return;
    const done = S.finishSession(ref.current, Date.now());
    ref.current = done;
    await saveSession(done);
    navigate(`/history/${done.id}?done=1`);
  };

  const discard = async () => {
    const ok = await confirm({ title: 'Discard this session?', message: 'All sets logged in this session will be permanently deleted.', confirmLabel: 'Discard session', danger: true });
    if (!ok) return;
    await db.sessions.delete(s.id);
  };

  const [adding, setAdding] = useState('');

  return (
    <div className="space-y-4 pb-24">
      <div className="sticky top-14 z-10 -mx-4 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-10 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">{s.templateName}</h1>
            <p className="text-xs text-muted">
              {s.programWeek ? `Week ${s.programWeek} · ` : ''}
              {summary.workingSets}/{summary.plannedSets} working sets · {formatVolume(summary.volumeKg, unit)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={cx('rounded-xl bg-surface-2 px-3 py-2 text-lg font-bold tabular', s.status === 'paused' && 'text-warn')} aria-label={`Elapsed time ${formatDuration(elapsed)}`} role="timer">
              {formatDuration(elapsed)}
            </span>
            {s.status === 'paused' ? (
              <Button icon={Play} onClick={() => update(S.resumeSession)}>Resume</Button>
            ) : (
              <Button icon={Pause} onClick={() => update(S.pauseSession)}>Pause</Button>
            )}
            <Button variant="primary" icon={Flag} onClick={finish}>Finish</Button>
          </div>
        </div>
      </div>

      <MedicalNotice profile={profile} compact />
      {s.status === 'paused' && (
        <div className="rounded-2xl border border-warn/40 bg-warn-bg p-3 text-sm text-warn" role="status">
          Session paused — the clock is stopped. Tap Resume to continue.
        </div>
      )}

      {s.exercises.map((ex, i) => (
        <ExerciseBlock key={ex.uid} ex={ex} index={i} count={s.exercises.length} session={s} sessions={sessions} profile={profile} update={update} onToggle={toggle} />
      ))}

      {s.exercises.length === 0 && <EmptyState icon={Dumbbell} title="No exercises in this session">Add one below.</EmptyState>}

      <Card title="Add exercise">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <SelectInput label="Exercise" value={adding} onChange={(e) => setAdding(e.target.value)} className="flex-1">
            <option value="">Choose…</option>
            {EXERCISES.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </SelectInput>
          <Button
            icon={Plus}
            disabled={!adding}
            onClick={() => {
              const info = getExercise(adding)!;
              update((x, n) => S.addExercise(x, { uid: `add-${n}`, exerciseId: adding, sets: 2, repMin: info.measure === 'time' ? 20 : 8, repMax: info.measure === 'time' ? 40 : 12, measure: info.measure, perSide: info.perSide, restMinSec: 90, restMaxSec: 120 }, n));
              setAdding('');
            }}
          >
            Add to session
          </Button>
        </div>
      </Card>

      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="danger" icon={Trash2} onClick={discard}>Discard session</Button>
        <Button variant="primary" icon={Flag} onClick={finish}>Finish workout</Button>
      </div>

      {s.restTimer && <RestBar session={s} remaining={remaining ?? 0} update={update} />}
    </div>
  );
}

function RestBar({ session, remaining, update }: { session: WorkoutSession; remaining: number; update: (fn: (x: WorkoutSession, now: number) => WorkoutSession) => void }) {
  const t = session.restTimer!;
  const total = t.durationSec * 1000;
  const paused = t.pausedRemainingMs != null;
  const pct = total > 0 ? (1 - remaining / total) * 100 : 100;
  const done = remaining === 0;
  return (
    <div className="safe-bottom fixed inset-x-0 bottom-[64px] z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-64" role="region" aria-label="Rest timer">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <Timer className={cx('h-5 w-5 shrink-0', done ? 'text-accent-ink' : 'text-muted')} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-subtle">{done ? 'Rest complete' : paused ? 'Rest paused' : 'Resting'}</span>
            <span className="text-xl font-bold tabular" role="timer" aria-live="off">
              {formatDuration(remaining)}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${pct}%` }} />
          </div>
        </div>
        {!done && (paused ? <IconButton icon={Play} label="Resume rest timer" onClick={() => update(S.resumeRestTimer)} /> : <IconButton icon={Pause} label="Pause rest timer" onClick={() => update(S.pauseRestTimer)} />)}
        <IconButton icon={Plus} label="Add 15 seconds" onClick={() => update((x, n) => S.startRestTimer(x, Math.ceil((S.restRemainingMs(x, n) ?? 0) / 1000) + 15, t.exerciseUid, n))} />
        <IconButton icon={RotateCcw} label="Reset rest timer" onClick={() => update(S.resetRestTimer)} />
        <IconButton icon={done ? X : SkipForward} label={done ? 'Dismiss rest timer' : 'Skip rest'} onClick={() => update(S.skipRestTimer)} />
      </div>
    </div>
  );
}

/* ---------- Exercise block ---------- */

function ExerciseBlock({ ex, index, count, session, sessions, profile, update, onToggle }: { ex: SessionExercise; index: number; count: number; session: WorkoutSession; sessions: WorkoutSession[]; profile: Profile; update: (fn: (x: WorkoutSession, now: number) => WorkoutSession) => void; onToggle: (ex: SessionExercise, set: LoggedSet) => void }) {
  const unit = profile.units;
  const info = getExercise(ex.exerciseId);
  const history = useMemo(() => exerciseHistory(sessions, ex.exerciseId, session.id), [sessions, ex.exerciseId, session.id]);
  const last = history[0];
  const pb = useMemo(() => personalBests(sessions, ex.exerciseId), [sessions, ex.exerciseId]);
  const prog = evaluateProgression(last?.exercise, profile.incrementKg);
  const isTime = ex.prescribed.measure === 'time';
  const working = ex.sets.filter((x) => x.kind === 'working');
  const doneCount = working.filter((x) => x.completed).length;
  const confirm = useConfirm();

  const fmtSet = (x: LoggedSet) => (isTime ? `${x.seconds ?? '—'} s` : `${x.weightKg != null ? displayLoad(x.weightKg, unit) : 'BW'}×${x.reps ?? '—'}`);

  return (
    <Card as="article" className={cx(doneCount >= ex.prescribed.sets && doneCount > 0 && 'border-accent/40')}>
      <div className="flex gap-3">
        <Link to={`/exercises/${ex.exerciseId}`} className="shrink-0" aria-label={`${ex.name} details`}>
          <ExerciseImage id={ex.exerciseId} size="thumb" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate font-bold">
                <span className="mr-1.5 text-subtle tabular">{index + 1}.</span>
                {ex.name}
              </h2>
              <p className="text-xs text-muted">{prescriptionLabel({ ...ex.prescribed, sets: ex.prescribed.sets })}</p>
            </div>
            <div className="flex shrink-0">
              <IconButton icon={ArrowUp} label="Move exercise up" disabled={index === 0} onClick={() => update((x, n) => S.moveExercise(x, ex.uid, -1, n))} />
              <IconButton icon={ArrowDown} label="Move exercise down" disabled={index === count - 1} onClick={() => update((x, n) => S.moveExercise(x, ex.uid, 1, n))} />
              <IconButton
                icon={Trash2}
                label="Remove exercise from session"
                onClick={async () => {
                  if (await confirm({ title: `Remove ${ex.name}?`, message: 'Its logged sets in this session will be removed.', danger: true, confirmLabel: 'Remove' })) update((x, n) => S.removeExercise(x, ex.uid, n));
                }}
              />
            </div>
          </div>
          <div className="mt-1.5 space-y-0.5 text-xs text-muted">
            <p>
              <span className="font-semibold text-fg/80">Last time:</span>{' '}
              {last ? `${formatDate(last.date)} · ${last.exercise.sets.filter((x) => x.kind === 'working' && x.completed).map(fmtSet).join(', ')}` : 'no previous log'}
            </p>
            {(pb.heaviestKg != null || pb.longestHoldSec != null) && (
              <p className="flex items-center gap-1">
                <Trophy className="h-3 w-3 text-accent-ink" aria-hidden />
                <span className="font-semibold text-fg/80">Best:</span> {isTime ? `${pb.longestHoldSec} s hold` : `${formatWeight(pb.heaviestKg, unit)} × ${pb.heaviestReps}`}
              </p>
            )}
          </div>
        </div>
      </div>

      {last && (
        <div className={cx('mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-xs', prog.status === 'eligible' && !needsClearance(profile) ? 'bg-accent/10 text-fg' : 'bg-surface-2 text-muted')}>
          {prog.status === 'eligible' ? <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-ink" aria-hidden /> : <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />}
          {needsClearance(profile) ? (
            <span>Load-increase suggestions are paused until medical clearance is recorded.</span>
          ) : (
            <span>
              {prog.reason}
              {prog.suggestedKg != null && (
                <>
                  {' '}
                  <strong>Optional next load: {formatWeight(prog.suggestedKg, unit)}.</strong>
                </>
              )}
            </span>
          )}
        </div>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[340px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-subtle">
              <th className="w-10 pb-1.5 font-semibold">Set</th>
              {!isTime && <th className="pb-1.5 font-semibold">{unit}</th>}
              <th className="pb-1.5 font-semibold">{isTime ? 'Seconds' : 'Reps'}</th>
              <th className="pb-1.5 font-semibold">RIR</th>
              <th className="w-20 pb-1.5 text-right font-semibold">Done</th>
            </tr>
          </thead>
          <tbody>
            {ex.sets.map((set, si) => {
              const workingNo = ex.sets.slice(0, si + 1).filter((x) => x.kind === 'working').length;
              return (
                <tr key={set.id} className={cx('border-t border-line/60', set.completed && 'bg-accent/5')}>
                  <td className="py-1.5 pr-2">
                    {set.kind === 'warmup' ? <Badge>W</Badge> : <span className="font-semibold tabular text-muted">{workingNo}</span>}
                  </td>
                  {!isTime && (
                    <td className="py-1.5 pr-2">
                      <SetNumberInput label={`Set ${si + 1} load in ${unit}`} value={set.weightKg == null ? null : round(kgToUnit(set.weightKg, unit), 0.1)} onChange={(v) => update((x, n) => S.updateSet(x, ex.uid, set.id, { weightKg: v == null ? null : unitToKg(v, unit) }, n))} placeholder="BW" />
                    </td>
                  )}
                  <td className="py-1.5 pr-2">
                    <SetNumberInput
                      label={`Set ${si + 1} ${isTime ? 'seconds' : 'reps'}`}
                      integer
                      value={isTime ? set.seconds : set.reps}
                      placeholder={set.kind === 'warmup' ? '' : ex.prescribed.repMin === ex.prescribed.repMax ? `${ex.prescribed.repMax}` : `${ex.prescribed.repMin}–${ex.prescribed.repMax}`}
                      onChange={(v) => update((x, n) => S.updateSet(x, ex.uid, set.id, isTime ? { seconds: v } : { reps: v }, n))}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <select aria-label={`Set ${si + 1} reps in reserve`} className={cx(inputClass.replace('w-full ', ''), 'w-16 px-2 py-1.5')} value={set.rir ?? ''} onChange={(e) => update((x, n) => S.updateSet(x, ex.uid, set.id, { rir: e.target.value === '' ? null : Number(e.target.value) }, n))}>
                      <option value="">–</option>
                      {[0, 1, 2, 3, 4, 5].map((r) => (
                        <option key={r} value={r}>
                          {r === 5 ? '5+' : r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        aria-pressed={set.completed}
                        aria-label={`${set.completed ? 'Unmark' : 'Mark'} set ${si + 1} complete`}
                        onClick={() => onToggle(ex, set)}
                        className={cx('grid h-9 w-9 place-items-center rounded-lg border transition', set.completed ? 'border-accent bg-accent text-accent-fg' : 'border-line bg-surface-2 text-subtle hover:border-accent')}
                      >
                        <Check className="h-4 w-4" aria-hidden />
                      </button>
                      <IconButton icon={X} label={`Delete set ${si + 1}`} onClick={() => update((x, n) => S.removeSet(x, ex.uid, set.id, n))} className="h-8 w-8" />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" icon={Plus} onClick={() => update((x, n) => S.addSet(x, ex.uid, 'working', n))}>Working set</Button>
        <Button size="sm" variant="ghost" icon={Plus} onClick={() => update((x, n) => S.addSet(x, ex.uid, 'warmup', n))}>Warm-up set</Button>
        <Button size="sm" variant="ghost" icon={Timer} onClick={() => update((x, n) => S.startRestTimer(x, ex.prescribed.restMaxSec, ex.uid, n))}>Rest {restLabel(ex.prescribed.restMaxSec, ex.prescribed.restMaxSec)}</Button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
        <NotesInput value={ex.notes} onChange={(v) => update((x, n) => S.updateExercise(x, ex.uid, { notes: v }, n))} label={`Notes for ${ex.name}`} />
        <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-xs font-medium">
          <input type="checkbox" checked={ex.techniqueControlled} onChange={(e) => update((x, n) => S.updateExercise(x, ex.uid, { techniqueControlled: e.target.checked }, n))} className="h-4 w-4 accent-[var(--accent)]" />
          Technique controlled on all sets
        </label>
      </div>
      {info && (
        <Link to={`/exercises/${info.id}`} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent-ink hover:underline">
          Form guide <ChevronRight className="h-3 w-3" aria-hidden />
        </Link>
      )}
    </Card>
  );
}

/** Compact numeric input that keeps local text and commits parsed numbers. */
export function SetNumberInput({ value, onChange, label, placeholder, integer }: { value: number | null; onChange: (v: number | null) => void; label: string; placeholder?: string; integer?: boolean }) {
  const [text, setText] = useState(value == null ? '' : String(value));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      setText(value == null ? '' : String(value));
      last.current = value;
    }
  }, [value]);
  const invalid = text.trim() !== '' && (parseNumber(text) == null || (integer && !Number.isInteger(parseNumber(text))));
  return (
    <input
      aria-label={label}
      inputMode={integer ? 'numeric' : 'decimal'}
      className={cx(inputClass.replace('w-full ', ''), 'w-[4.5rem] px-2 py-1.5 text-center tabular', invalid && 'border-danger')}
      aria-invalid={invalid}
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        const n = parseNumber(t);
        if (t.trim() === '') {
          last.current = null;
          onChange(null);
        } else if (n != null && (!integer || Number.isInteger(n))) {
          last.current = n;
          onChange(n);
        }
      }}
    />
  );
}

function NotesInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  // Saved on every keystroke so notes survive a refresh.
  return <textarea aria-label={label} placeholder="Notes (seat settings, how it felt…)" className={cx(inputClass, 'min-h-10 text-xs')} rows={1} value={value} onChange={(e) => onChange(e.target.value)} />;
}
