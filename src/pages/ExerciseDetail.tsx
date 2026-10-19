import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRightLeft, CheckCircle2, MoveRight, Wind, Wrench } from 'lucide-react';
import { getExercise } from '../data/exercises';
import { useProfile, useSessions } from '../hooks/useData';
import { personalBests, progressionForExercise, strengthChange, strengthSeries } from '../lib/training';
import { formatDate } from '../lib/dates';
import { formatWeight, kgToUnit, round } from '../lib/units';
import { Badge, Card, EmptyState, Stat } from '../components/ui';
import { ExerciseImage } from '../components/ExerciseImage';
import { SeriesChart } from '../components/Chart';
import { needsClearance } from '../lib/health';

export function ExerciseDetail() {
  const { id = '' } = useParams();
  const ex = getExercise(id);
  const profile = useProfile();
  const sessions = useSessions() ?? [];
  if (!ex) return <EmptyState title="Exercise not found" action={<Link to="/exercises" className="text-accent-ink underline">Back to library</Link>} />;
  const unit = profile?.units ?? 'kg';
  const pb = personalBests(sessions, id);
  const series = strengthSeries(sessions, id);
  const change = strengthChange(series);
  const prog = progressionForExercise(sessions, id, profile?.incrementKg ?? 2.5);

  return (
    <div className="space-y-5">
      <Link to="/exercises" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Exercise library
      </Link>
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <ExerciseImage id={id} size="large" allowAnimation />
          <p className="mt-2 text-xs text-subtle">Original FORGE illustration (CC0) — not a photograph. Faded figure = start, solid = end, green arrows = direction, green areas = main muscles.</p>
        </div>
        <div className="space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{ex.name}</h1>
              <Badge>{ex.category}</Badge>
            </div>
            <p className="mt-2 text-muted">{ex.summary}</p>
          </div>
          <Card>
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-subtle">Main muscles</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">{ex.primary.map((m) => <Badge key={m} tone="accent">{m}</Badge>)}</dd>
              </div>
              {ex.secondary.length > 0 && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-subtle">Also works</dt>
                  <dd className="mt-1 flex flex-wrap gap-1.5">{ex.secondary.map((m) => <Badge key={m}>{m}</Badge>)}</dd>
                </div>
              )}
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-subtle"><Wrench className="h-3.5 w-3.5" aria-hidden /> Equipment</dt>
                <dd className="mt-1">{ex.equipment}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-subtle"><MoveRight className="h-3.5 w-3.5" aria-hidden /> Movement direction</dt>
                <dd className="mt-1">{ex.direction}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Setup">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">{ex.setup.map((s) => <li key={s}>{s}</li>)}</ol>
        </Card>
        <Card title="Steps">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">{ex.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        </Card>
        <Card title="Correct form">
          <ul className="space-y-1.5 text-sm">{ex.form.map((s) => <li key={s} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden />{s}</li>)}</ul>
          <p className="mt-3 flex gap-2 rounded-xl bg-surface-2 p-3 text-sm"><Wind className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" aria-hidden /><span><strong>Breathing:</strong> {ex.breathing}</span></p>
        </Card>
        <Card title="Common mistakes">
          <ul className="space-y-1.5 text-sm">{ex.mistakes.map((s) => <li key={s} className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden />{s}</li>)}</ul>
        </Card>
        <Card title="Safer alternatives & substitutions" className="md:col-span-2">
          <ul className="grid gap-2 sm:grid-cols-2">
            {ex.alternatives.map((a) => (
              <li key={a.name} className="flex gap-2 rounded-xl bg-surface-2 p-3 text-sm">
                <ArrowRightLeft className="mt-0.5 h-4 w-4 shrink-0 text-subtle" aria-hidden />
                <span>
                  {a.exerciseId ? <Link to={`/exercises/${a.exerciseId}`} className="font-semibold text-accent-ink hover:underline">{a.name}</Link> : <strong>{a.name}</strong>} — {a.reason}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Your performance">
        {pb.sessions === 0 ? (
          <EmptyState title="No data available yet">Complete a session that includes {ex.name} to see personal bests and strength trends.</EmptyState>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Sessions logged" value={pb.sessions} />
              {ex.measure === 'time' ? (
                <Stat label="Longest hold" value={pb.longestHoldSec ?? '—'} unit="s" />
              ) : (
                <>
                  <Stat label="Heaviest set" value={pb.heaviestKg != null ? formatWeight(pb.heaviestKg, unit) : '—'} hint={pb.heaviestReps ? `× ${pb.heaviestReps} reps` : undefined} />
                  <Stat label="Best set volume" value={pb.bestSetVolumeKg != null ? formatWeight(pb.bestSetVolumeKg, unit, 0) : '—'} />
                  <Stat label="Top-weight change" value={change ? `${change.changeKg >= 0 ? '+' : ''}${formatWeight(change.changeKg, unit)}` : '—'} hint={change ? `${formatDate(change.firstDate)} → ${formatDate(change.latestDate)}` : 'Needs 2+ sessions'} />
                </>
              )}
            </div>
            {ex.measure === 'reps' && (
              <div className="mt-4">
                <SeriesChart
                  title={`${ex.name} top working weight`}
                  data={series.map((p, i) => ({ x: `${p.date}-${i}`, label: formatDate(p.date), top: p.topKg != null ? round(kgToUnit(p.topKg, unit), 0.1) : null }))}
                  series={[{ key: 'top', label: 'Top working set', kind: 'line', colorVar: '--accent', unit, digits: 1 }]}
                  yDomain={['auto', 'auto']}
                  empty={<p className="text-sm text-muted">No loaded sets logged yet.</p>}
                />
              </div>
            )}
            <p className="mt-3 text-sm text-muted">
              <strong>Progression check (last session):</strong> {profile && !needsClearance(profile) ? prog.reason : 'Suggestions are paused until medical clearance is recorded.'}
              {profile && !needsClearance(profile) && prog.suggestedKg != null && <> Optional next load: <strong>{formatWeight(prog.suggestedKg, unit)}</strong>.</>}
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
