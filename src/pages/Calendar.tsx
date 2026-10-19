import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRightLeft, BedDouble, CalendarDays, Check, ChevronLeft, ChevronRight, Coffee, Dumbbell, Footprints, Moon, RotateCcw } from 'lucide-react';
import type { ScheduledActivity, WeeklySchedule } from '../db/types';
import { saveSchedule, setOverride, swapDates } from '../db/actions';
import { useCardio, useOverrides, useRecovery, useSchedule, useSessions, useTemplates } from '../hooks/useData';
import { useToday } from '../hooks/useNow';
import { describeActivity } from '../data/program';
import { activityForDate } from '../lib/training';
import { addDays, addMonths, daysBetween, endOfMonth, formatDate, formatLongDate, formatMonth, isLocalDate, startOfMonth, startOfWeek, WEEKDAYS, WEEKDAYS_SHORT } from '../lib/dates';
import { Badge, Button, Card, IconButton, PageHeader, SelectInput, TextInput, cx, useToast } from '../components/ui';
import { CARDIO_TYPES } from './Cardio';

export function encodeActivity(a: ScheduledActivity): string {
  if (a.kind === 'workout') return `workout:${a.templateId}`;
  return a.kind;
}

export function decodeActivity(v: string): ScheduledActivity {
  if (v.startsWith('workout:')) return { kind: 'workout', templateId: v.slice(8) };
  if (v === 'walk') return { kind: 'walk', minMinutes: 30, maxMinutes: 40 };
  if (v === 'cardio') return { kind: 'cardio', minMinutes: 30, maxMinutes: 45 };
  return { kind: 'rest' };
}

function ActivityIcon({ a, className }: { a: ScheduledActivity; className?: string }) {
  const Icon = a.kind === 'workout' ? Dumbbell : a.kind === 'walk' ? Footprints : a.kind === 'cardio' ? Activity : Coffee;
  return <Icon className={className} aria-hidden />;
}

export function CalendarPage() {
  const todayDate = useToday();
  const [month, setMonth] = useState(startOfMonth(todayDate));
  const [selected, setSelected] = useState(todayDate);
  const schedule = useSchedule();
  const overrides = useOverrides();
  const templates = useTemplates();
  const sessions = useSessions() ?? [];
  const cardio = useCardio() ?? [];
  const recovery = useRecovery() ?? [];
  const toast = useToast();
  const [moveTo, setMoveTo] = useState('');
  if (!schedule) return null;

  const name = (id: string) => templates.find((t) => t.id === id)?.name ?? 'Unassigned workout';
  const overrideMap = new Map(overrides.map((o) => [o.date, o]));
  const gridStart = startOfWeek(month);
  const weeks = Math.ceil((daysBetween(gridStart, endOfMonth(month)) + 1) / 7);
  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i));

  const dayInfo = (d: string) => ({
    planned: activityForDate(schedule, overrideMap, d),
    overridden: overrideMap.has(d),
    sessions: sessions.filter((s) => s.date === d),
    cardio: cardio.filter((c) => c.date === d),
    recovery: recovery.find((r) => r.date === d),
  });

  const sel = dayInfo(selected);
  const optionList = [...templates.map((t) => ({ v: `workout:${t.id}`, l: t.name })), { v: 'walk', l: 'Walking, 30–40 min' }, { v: 'cardio', l: 'Moderate cardio, 30–45 min' }, { v: 'rest', l: 'Rest & recovery' }];

  return (
    <div className="space-y-5">
      <PageHeader title="Calendar" icon={CalendarDays} subtitle="Planned activities, completed workouts, cardio and recovery. Select a day to reschedule." />
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <IconButton icon={ChevronLeft} label="Previous month" onClick={() => setMonth((m) => addMonths(m, -1))} />
            <h2 className="text-lg font-bold">{formatMonth(month)}</h2>
            <IconButton icon={ChevronRight} label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))} />
          </div>
          <div role="grid" aria-label={formatMonth(month)} className="grid grid-cols-7 gap-1">
            {WEEKDAYS_SHORT.map((d) => (
              <div key={d} role="columnheader" className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wider text-subtle">{d}</div>
            ))}
            {days.map((d) => {
              const info = dayInfo(d);
              const inMonth = d.slice(0, 7) === month.slice(0, 7);
              const done = info.sessions.some((s) => s.status === 'completed');
              const past = d < todayDate;
              const missed = past && info.planned.kind === 'workout' && !done;
              return (
                <button
                  key={d}
                  type="button"
                  role="gridcell"
                  aria-selected={d === selected}
                  aria-label={`${formatLongDate(d)}: planned ${describeActivity(info.planned, name)}${done ? ', workout completed' : ''}${info.cardio.length ? `, ${info.cardio.length} cardio` : ''}${info.recovery ? ', recovery logged' : ''}`}
                  onClick={() => setSelected(d)}
                  className={cx(
                    'flex min-h-16 flex-col rounded-xl border p-1.5 text-left transition sm:min-h-20',
                    d === selected ? 'border-accent bg-accent/10' : 'border-line bg-surface-2/50 hover:border-subtle',
                    !inMonth && 'opacity-40',
                  )}
                >
                  <span className={cx('text-xs font-semibold tabular', d === todayDate && 'grid h-5 w-5 place-items-center rounded-full bg-accent text-accent-fg')}>{Number(d.slice(8))}</span>
                  <span className="mt-auto flex flex-wrap items-center gap-0.5">
                    <ActivityIcon a={info.planned} className={cx('h-3.5 w-3.5', done ? 'text-accent-ink' : missed ? 'text-subtle/50' : 'text-subtle')} />
                    {done && <Check className="h-3.5 w-3.5 text-accent-ink" aria-hidden />}
                    {info.cardio.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-[var(--chart-1)]" />}
                    {info.recovery && <Moon className="h-3 w-3 text-subtle" aria-hidden />}
                    {info.overridden && <ArrowRightLeft className="h-3 w-3 text-warn" aria-hidden />}
                  </span>
                </button>
              );
            })}
          </div>
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted" aria-label="Legend">
            <li className="flex items-center gap-1"><Dumbbell className="h-3.5 w-3.5" aria-hidden /> Workout</li>
            <li className="flex items-center gap-1"><Footprints className="h-3.5 w-3.5" aria-hidden /> Walk</li>
            <li className="flex items-center gap-1"><Activity className="h-3.5 w-3.5" aria-hidden /> Cardio</li>
            <li className="flex items-center gap-1"><Coffee className="h-3.5 w-3.5" aria-hidden /> Rest</li>
            <li className="flex items-center gap-1"><Check className="h-3.5 w-3.5 text-accent-ink" aria-hidden /> Completed</li>
            <li className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[var(--chart-1)]" /> Cardio logged</li>
            <li className="flex items-center gap-1"><Moon className="h-3 w-3" aria-hidden /> Recovery logged</li>
            <li className="flex items-center gap-1"><ArrowRightLeft className="h-3 w-3 text-warn" aria-hidden /> Rescheduled</li>
          </ul>
        </Card>

        <Card title={formatDate(selected, { weekday: 'long', day: 'numeric', month: 'long' })}>
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Planned</p>
              <p className="mt-1 flex items-center gap-2 font-semibold"><ActivityIcon a={sel.planned} className="h-4 w-4 text-accent-ink" /> {describeActivity(sel.planned, name)} {sel.overridden && <Badge tone="warn">Rescheduled</Badge>}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Logged</p>
              {sel.sessions.length + sel.cardio.length === 0 && !sel.recovery ? (
                <p className="mt-1 text-muted">No data logged for this day.</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {sel.sessions.map((s) => (
                    <li key={s.id}><Link to={s.status === 'completed' ? `/history/${s.id}` : '/workout'} className="flex items-center gap-2 font-medium text-accent-ink hover:underline"><Dumbbell className="h-4 w-4" aria-hidden /> {s.templateName} {s.status !== 'completed' && '(in progress)'}</Link></li>
                  ))}
                  {sel.cardio.map((c) => (
                    <li key={c.id} className="flex items-center gap-2"><Activity className="h-4 w-4 text-subtle" aria-hidden /> {CARDIO_TYPES.find((t) => t.value === c.type)?.label} · {c.durationMin} min</li>
                  ))}
                  {sel.recovery && <li className="flex items-center gap-2"><BedDouble className="h-4 w-4 text-subtle" aria-hidden /> Sleep {sel.recovery.sleepHours ?? '—'} h · readiness {sel.recovery.readiness ?? '—'}/5</li>}
                </ul>
              )}
            </div>
            <div className="space-y-3 border-t border-line pt-4">
              <SelectInput label="Change this day's activity" value={encodeActivity(sel.planned)} onChange={async (e) => { await setOverride(selected, decodeActivity(e.target.value)); toast('Day updated'); }}>
                {optionList.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </SelectInput>
              <div className="flex items-end gap-2">
                <TextInput label="Swap with date" type="date" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className="flex-1" />
                <Button
                  icon={ArrowRightLeft}
                  disabled={!isLocalDate(moveTo) || moveTo === selected}
                  onClick={async () => {
                    await swapDates(schedule, selected, moveTo);
                    toast(`Swapped ${formatDate(selected)} and ${formatDate(moveTo)}`);
                    setSelected(moveTo);
                    setMoveTo('');
                  }}
                >
                  Swap
                </Button>
              </div>
              {sel.overridden && (
                <Button size="sm" variant="ghost" icon={RotateCcw} onClick={async () => { await setOverride(selected, null); toast('Restored weekly default'); }}>
                  Restore weekly default
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>

      <WeeklyScheduleEditor schedule={schedule} options={optionList} />
    </div>
  );
}

function WeeklyScheduleEditor({ schedule, options }: { schedule: WeeklySchedule; options: { v: string; l: string }[] }) {
  const toast = useToast();
  return (
    <Card title="Default weekly schedule">
      <p className="mb-3 text-sm text-muted">Applies to every week unless a specific day is rescheduled above.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
        {WEEKDAYS.map((d, i) => (
          <SelectInput
            key={d}
            label={d}
            value={encodeActivity(schedule.days[i])}
            onChange={async (e) => {
              const days = [...schedule.days];
              days[i] = decodeActivity(e.target.value);
              await saveSchedule({ ...schedule, days });
              toast(`${d} updated`);
            }}
          >
            {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
          </SelectInput>
        ))}
      </div>
    </Card>
  );
}
