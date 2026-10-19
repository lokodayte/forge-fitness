import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Check, PartyPopper, Pencil, Plus, Save, Trash2, TrendingUp, X } from 'lucide-react';
import type { LoggedSet, WorkoutSession } from '../db/types';
import { db } from '../db/db';
import { saveSession } from '../db/actions';
import { useProfile } from '../hooks/useData';
import { evaluateProgression, exerciseVolumeKg, isCompletedWorking, summarizeSession } from '../lib/training';
import * as S from '../lib/session';
import { formatDate, formatDuration, formatLongDate, isLocalDate } from '../lib/dates';
import { displayLoad, formatVolume, formatWeight, kgToUnit, round, unitToKg } from '../lib/units';
import { Badge, Button, Card, EmptyState, IconButton, PageHeader, Stat, TextArea, TextInput, cx, inputClass, useConfirm, useToast } from '../components/ui';
import { SetNumberInput } from './Workout';
import { ExerciseImage } from '../components/ExerciseImage';
import { needsClearance } from '../lib/health';

export function SessionDetail() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const session = useLiveQuery(() => db.sessions.get(id), [id], null as WorkoutSession | null | undefined);
  const profile = useProfile();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [edit, setEdit] = useState<WorkoutSession | null>(null);
  useEffect(() => setEdit(null), [id]);

  if (session === null) return <p className="text-sm text-muted">Loading…</p>;
  if (!session || !profile) return <EmptyState title="Session not found" action={<Link to="/history"><Button>Back to history</Button></Link>} />;
  const unit = profile.units;
  const s = edit ?? session;
  const summary = summarizeSession(s, S.elapsedMs(s, s.endedAt ?? Date.now()));
  const justFinished = params.get('done') === '1';

  const patchSet = (exUid: string, setId: string, patch: Partial<LoggedSet>) => setEdit((e) => (e ? S.updateSet(e, exUid, setId, patch, Date.now()) : e));

  const saveEdit = async () => {
    if (!edit) return;
    if (!isLocalDate(edit.date)) return toast('Invalid date', 'error');
    for (const ex of edit.exercises)
      for (const set of ex.sets)
        if (set.completed) {
          const err = S.completionError(set, ex.prescribed.measure);
          if (err) return toast(`${ex.name}: ${err}`, 'error');
        }
    await saveSession({ ...edit, updatedAt: Date.now() });
    setEdit(null);
    toast('Session updated');
  };

  const del = async () => {
    if (!(await confirm({ title: 'Delete this workout?', message: `${session.templateName} on ${formatDate(session.date)} and all its sets will be permanently deleted.`, danger: true, confirmLabel: 'Delete workout' }))) return;
    await db.sessions.delete(session.id);
    toast('Workout deleted');
    navigate('/history');
  };

  return (
    <div className="space-y-5">
      <Link to="/history" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" aria-hidden /> History</Link>
      {justFinished && !edit && (
        <div className="flex items-center gap-3 rounded-2xl border border-accent/50 bg-accent/10 p-4 animate-in" role="status">
          <PartyPopper className="h-6 w-6 shrink-0 text-accent-ink" aria-hidden />
          <div>
            <p className="font-bold">Workout complete and saved.</p>
            <p className="text-sm text-muted">Here is your summary. Remember to log how you recover over the next day or two.</p>
          </div>
        </div>
      )}
      <PageHeader
        title={s.templateName}
        subtitle={`${formatLongDate(s.date)}${s.programWeek ? ` · program week ${s.programWeek}` : ''}`}
        actions={
          edit ? (
            <>
              <Button icon={X} onClick={() => setEdit(null)}>Cancel</Button>
              <Button variant="primary" icon={Save} onClick={saveEdit}>Save changes</Button>
            </>
          ) : (
            <>
              <Button icon={Pencil} onClick={() => setEdit(structuredClone(session))} disabled={session.status !== 'completed'}>Edit</Button>
              <Button variant="danger" icon={Trash2} onClick={del}>Delete</Button>
            </>
          )
        }
      />

      <Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Working sets" value={`${summary.workingSets}`} hint={`of ${summary.plannedSets} logged`} tone="accent" />
          <Stat label="Volume" value={formatVolume(summary.volumeKg, unit)} hint="load × reps, working sets" />
          <Stat label="Active time" value={formatDuration(summary.durationMs)} hint="excludes pauses" />
          <Stat label="Exercises" value={`${summary.exercisesCompleted}/${summary.exercisesTotal}`} hint={summary.warmupSets ? `${summary.warmupSets} warm-up sets` : 'completed'} />
        </div>
      </Card>

      {edit && (
        <Card title="Session details">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label="Date" type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} />
            <TextArea label="Session notes" value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
          </div>
        </Card>
      )}
      {!edit && s.notes && <Card title="Notes"><p className="text-sm">{s.notes}</p></Card>}

      {s.exercises.map((ex) => {
        const isTime = ex.prescribed.measure === 'time';
        const prog = evaluateProgression(ex, profile.incrementKg);
        return (
          <Card key={ex.uid} as="article">
            <div className="mb-3 flex gap-3">
              <Link to={`/exercises/${ex.exerciseId}`} className="shrink-0"><ExerciseImage id={ex.exerciseId} size="thumb" /></Link>
              <div className="min-w-0 flex-1">
                <h2 className="font-bold">{ex.name}</h2>
                <p className="text-xs text-muted">
                  Prescribed {ex.prescribed.sets} × {ex.prescribed.repMin}–{ex.prescribed.repMax}{isTime ? ' s' : ''} · volume {formatVolume(exerciseVolumeKg(ex), unit)}
                </p>
                {!edit && ex.notes && <p className="mt-1 text-xs italic text-muted">“{ex.notes}”</p>}
                {!edit && !needsClearance(profile) && prog.status === 'eligible' && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-accent-ink"><TrendingUp className="h-3.5 w-3.5" aria-hidden /> Eligible to progress{prog.suggestedKg != null ? ` — optional next load ${formatWeight(prog.suggestedKg, unit)}` : ''}</p>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-sm tabular">
                <thead className="text-left text-[11px] uppercase tracking-wider text-subtle">
                  <tr>
                    <th className="pb-1">Set</th>
                    {!isTime && <th className="pb-1">{unit}</th>}
                    <th className="pb-1">{isTime ? 'Seconds' : 'Reps'}</th>
                    <th className="pb-1">RIR</th>
                    <th className="pb-1">Done</th>
                    {edit && <th />}
                  </tr>
                </thead>
                <tbody>
                  {ex.sets.map((set, i) => (
                    <tr key={set.id} className={cx('border-t border-line/60', !set.completed && !edit && 'text-subtle')}>
                      <td className="py-1.5">
                        {edit ? (
                          <select aria-label="Set type" className={cx(inputClass.replace('w-full ', ''), 'w-24 px-2 py-1')} value={set.kind} onChange={(e) => patchSet(ex.uid, set.id, { kind: e.target.value as LoggedSet['kind'] })}>
                            <option value="working">Working</option>
                            <option value="warmup">Warm-up</option>
                          </select>
                        ) : set.kind === 'warmup' ? <Badge>Warm-up</Badge> : i + 1 - ex.sets.slice(0, i).filter((x) => x.kind === 'warmup').length}
                      </td>
                      {!isTime && (
                        <td className="py-1.5">
                          {edit ? <SetNumberInput label="Load" value={set.weightKg == null ? null : round(kgToUnit(set.weightKg, unit), 0.1)} onChange={(v) => patchSet(ex.uid, set.id, { weightKg: v == null ? null : unitToKg(v, unit) })} placeholder="BW" /> : set.weightKg != null ? displayLoad(set.weightKg, unit) : 'BW'}
                        </td>
                      )}
                      <td className="py-1.5">
                        {edit ? <SetNumberInput integer label={isTime ? 'Seconds' : 'Reps'} value={isTime ? set.seconds : set.reps} onChange={(v) => patchSet(ex.uid, set.id, isTime ? { seconds: v } : { reps: v })} /> : (isTime ? set.seconds : set.reps) ?? '—'}
                      </td>
                      <td className="py-1.5">
                        {edit ? (
                          <select aria-label="RIR" className={cx(inputClass.replace('w-full ', ''), 'w-16 px-2 py-1')} value={set.rir ?? ''} onChange={(e) => patchSet(ex.uid, set.id, { rir: e.target.value === '' ? null : Number(e.target.value) })}>
                            <option value="">–</option>
                            {[0, 1, 2, 3, 4, 5].map((r) => <option key={r} value={r}>{r === 5 ? '5+' : r}</option>)}
                          </select>
                        ) : set.rir ?? '—'}
                      </td>
                      <td className="py-1.5">
                        {edit ? (
                          <input type="checkbox" aria-label="Completed" checked={set.completed} onChange={(e) => patchSet(ex.uid, set.id, { completed: e.target.checked, completedAt: e.target.checked ? set.completedAt ?? Date.now() : null })} className="h-4 w-4 accent-[var(--accent)]" />
                        ) : set.completed ? <Check className="h-4 w-4 text-accent-ink" aria-label="Completed" /> : <span className="text-xs">not done</span>}
                      </td>
                      {edit && <td><IconButton icon={Trash2} label="Delete set" onClick={() => setEdit((e) => (e ? S.removeSet(e, ex.uid, set.id, Date.now()) : e))} /></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {edit && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Button size="sm" icon={Plus} onClick={() => setEdit((e) => (e ? S.addSet(e, ex.uid, 'working', Date.now()) : e))}>Add set</Button>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={ex.techniqueControlled} onChange={(e) => setEdit((x) => (x ? S.updateExercise(x, ex.uid, { techniqueControlled: e.target.checked }, Date.now()) : x))} className="h-4 w-4 accent-[var(--accent)]" />
                  Technique controlled
                </label>
                <input aria-label={`Notes for ${ex.name}`} className={cx(inputClass, 'flex-1 py-1.5 text-xs')} value={ex.notes} placeholder="Notes" onChange={(e) => setEdit((x) => (x ? S.updateExercise(x, ex.uid, { notes: e.target.value }, Date.now()) : x))} />
              </div>
            )}
            {!edit && ex.sets.filter(isCompletedWorking).length === 0 && <p className="mt-2 text-xs text-muted">No completed working sets.</p>}
          </Card>
        );
      })}
    </div>
  );
}
