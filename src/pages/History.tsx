import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Columns2, History as HistoryIcon, X } from 'lucide-react';
import type { WorkoutSession } from '../db/types';
import { useProfile, useSessions } from '../hooks/useData';
import { compareSessions, completedSessions, completedWorkingSets, isCompletedWorking, sessionVolumeKg } from '../lib/training';
import { elapsedMs } from '../lib/session';
import { formatDate, formatDuration } from '../lib/dates';
import { displayLoad, formatVolume } from '../lib/units';
import { getExercise } from '../data/exercises';
import { Badge, Button, Card, Dialog, EmptyState, PageHeader, SelectInput, TextInput, cx } from '../components/ui';

export interface HistoryFilter {
  from: string;
  to: string;
  exerciseId: string;
  templateName: string;
}

export function filterSessions(sessions: WorkoutSession[], f: HistoryFilter): WorkoutSession[] {
  return completedSessions(sessions)
    .filter((s) => (!f.from || s.date >= f.from) && (!f.to || s.date <= f.to))
    .filter((s) => !f.exerciseId || s.exercises.some((e) => e.exerciseId === f.exerciseId && e.sets.some(isCompletedWorking)))
    .filter((s) => !f.templateName || s.templateName.replace(' (deload)', '') === f.templateName)
    .sort((a, b) => (a.date === b.date ? b.startedAt - a.startedAt : a.date < b.date ? 1 : -1));
}

export function HistoryPage() {
  const sessions = useSessions();
  const profile = useProfile();
  const [f, setF] = useState<HistoryFilter>({ from: '', to: '', exerciseId: '', templateName: '' });
  const [sel, setSel] = useState<string[]>([]);
  const [compare, setCompare] = useState(false);
  const list = useMemo(() => filterSessions(sessions ?? [], f), [sessions, f]);
  if (!sessions || !profile) return null;
  const unit = profile.units;
  const exerciseIds = Array.from(new Set(completedSessions(sessions).flatMap((s) => s.exercises.map((e) => e.exerciseId))));
  const templateNames = Array.from(new Set(completedSessions(sessions).map((s) => s.templateName.replace(' (deload)', ''))));
  const chosen = sel.map((id) => sessions.find((s) => s.id === id)).filter(Boolean) as WorkoutSession[];
  const filtered = f.from || f.to || f.exerciseId || f.templateName;

  return (
    <div className="space-y-5">
      <PageHeader title="Workout History" icon={HistoryIcon} subtitle="Every completed session, exercise by exercise. Open a session to edit or delete it." />
      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <TextInput label="From" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
          <TextInput label="To" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
          <SelectInput label="Exercise" value={f.exerciseId} onChange={(e) => setF({ ...f, exerciseId: e.target.value })}>
            <option value="">All exercises</option>
            {exerciseIds.map((id) => <option key={id} value={id}>{getExercise(id)?.name ?? id}</option>)}
          </SelectInput>
          <SelectInput label="Workout" value={f.templateName} onChange={(e) => setF({ ...f, templateName: e.target.value })}>
            <option value="">All workouts</option>
            {templateNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </SelectInput>
          <Button icon={X} disabled={!filtered} onClick={() => setF({ from: '', to: '', exerciseId: '', templateName: '' })}>Clear filters</Button>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{list.length} session{list.length === 1 ? '' : 's'}{filtered ? ' match' : ''}</p>
        <Button icon={Columns2} disabled={chosen.length !== 2} onClick={() => setCompare(true)}>Compare selected ({chosen.length}/2)</Button>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={HistoryIcon} title={filtered ? 'No sessions match these filters' : 'No completed workouts yet'} action={!filtered ? <Link to="/workout"><Button variant="primary">Start a workout</Button></Link> : undefined}>
          {!filtered && 'Finished sessions appear here with full set-by-set detail.'}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {list.map((s) => {
            const focus = f.exerciseId ? s.exercises.find((e) => e.exerciseId === f.exerciseId) : null;
            return (
              <li key={s.id}>
                <Card className={cx('flex items-center gap-3 !p-3 sm:!p-4', sel.includes(s.id) && 'border-accent/60')}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${s.templateName} on ${formatDate(s.date)} for comparison`}
                    checked={sel.includes(s.id)}
                    onChange={() => setSel((x) => (x.includes(s.id) ? x.filter((y) => y !== s.id) : [...x.slice(-1), s.id]))}
                    className="h-5 w-5 shrink-0 accent-[var(--accent)]"
                  />
                  <Link to={`/history/${s.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{s.templateName} <span className="font-normal text-muted">· {formatDate(s.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span></p>
                      <p className="text-xs tabular text-muted">
                        {completedWorkingSets(s)} working sets · {formatVolume(sessionVolumeKg(s), unit)} · {formatDuration(elapsedMs(s, s.endedAt ?? s.startedAt))}
                        {s.programWeek ? ` · week ${s.programWeek}` : ''}
                      </p>
                      {focus && (
                        <p className="mt-1 text-xs tabular">
                          <span className="font-semibold">{focus.name}:</span> {focus.sets.filter(isCompletedWorking).map((x) => (x.seconds != null ? `${x.seconds}s` : `${x.weightKg != null ? displayLoad(x.weightKg, unit) : 'BW'}×${x.reps}`)).join(', ')}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
                  </Link>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={compare && chosen.length === 2} onClose={() => setCompare(false)} title="Session comparison" wide>
        {chosen.length === 2 && <Comparison a={[...chosen].sort((x, y) => (x.date < y.date ? -1 : 1))[0]} b={[...chosen].sort((x, y) => (x.date < y.date ? -1 : 1))[1]} unit={unit} />}
      </Dialog>
    </div>
  );
}

function Comparison({ a, b, unit }: { a: WorkoutSession; b: WorkoutSession; unit: 'kg' | 'lb' }) {
  const rows = compareSessions(a, b);
  const fmt = (e: WorkoutSession['exercises'][number] | null) => (e ? e.sets.filter(isCompletedWorking).map((x) => (x.seconds != null ? `${x.seconds}s` : `${x.weightKg != null ? displayLoad(x.weightKg, unit) : 'BW'}×${x.reps}`)).join(', ') || '—' : 'not performed');
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm tabular">
        <thead className="text-left text-xs text-muted">
          <tr>
            <th className="py-2">Exercise</th>
            <th>{a.templateName} · {formatDate(a.date)}</th>
            <th>{b.templateName} · {formatDate(b.date)}</th>
            <th>Volume Δ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.exerciseId} className="border-t border-line align-top">
              <td className="py-2 font-medium">{r.name}</td>
              <td className="py-2">{fmt(r.a)}</td>
              <td className="py-2">{fmt(r.b)}</td>
              <td className="py-2">
                <Badge tone={r.volumeDeltaKg > 0 ? 'ok' : r.volumeDeltaKg < 0 ? 'warn' : 'default'}>
                  {r.volumeDeltaKg > 0 ? '+' : ''}
                  {formatVolume(r.volumeDeltaKg, unit)}
                </Badge>
              </td>
            </tr>
          ))}
          <tr className="border-t border-line font-semibold">
            <td className="py-2">Total</td>
            <td>{formatVolume(sessionVolumeKg(a), unit)} · {completedWorkingSets(a)} sets</td>
            <td>{formatVolume(sessionVolumeKg(b), unit)} · {completedWorkingSets(b)} sets</td>
            <td>{formatVolume(sessionVolumeKg(b) - sessionVolumeKg(a), unit)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-xs text-subtle">Volume = load × reps of completed working sets. Δ = later session minus earlier session.</p>
    </div>
  );
}
