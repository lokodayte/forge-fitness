import { useState } from 'react';
import { Activity, Footprints, Pencil, Plus, Trash2 } from 'lucide-react';
import type { CardioEntry, CardioType } from '../db/types';
import { db } from '../db/db';
import { useCardio, useOverrides, useProfile, useSchedule } from '../hooks/useData';
import { useToday } from '../hooks/useNow';
import { cardioMinutes, cardioProgression, monthlyCardio, weeklyCardio, WEEKLY_ACTIVITY_GUIDELINE_MIN } from '../lib/metrics';
import { activityForDate } from '../lib/training';
import { addDays, dateRange, endOfWeek, formatDate, isLocalDate, parseLocalDate, startOfWeek } from '../lib/dates';
import { uid } from '../lib/id';
import { Badge, Button, Card, Dialog, EmptyState, IconButton, NumberField, PageHeader, ProgressBar, SelectInput, Stat, Tabs, TextArea, TextInput, useConfirm, useToast } from '../components/ui';
import { SeriesChart } from '../components/Chart';
import { MedicalNotice } from '../components/MedicalNotice';
import { needsClearance } from '../lib/health';

export const CARDIO_TYPES: { value: CardioType; label: string }[] = [
  { value: 'walking', label: 'Walking' },
  { value: 'cycling', label: 'Cycling' },
  { value: 'elliptical', label: 'Elliptical' },
  { value: 'rowing', label: 'Rowing' },
  { value: 'swimming', label: 'Swimming' },
  { value: 'hiking', label: 'Hiking' },
  { value: 'other', label: 'Other' },
];

type Draft = Omit<CardioEntry, 'id' | 'createdAt'> & { id?: string; createdAt?: number };

const blank = (date: string): Draft => ({ date, type: 'walking', label: '', durationMin: 30, distanceKm: null, avgHr: null, effort: null, notes: '' });

export function validateCardio(d: Draft): string | null {
  if (!isLocalDate(d.date)) return 'Choose a valid date.';
  if (!(d.durationMin > 0 && d.durationMin <= 1440)) return 'Duration must be between 1 and 1440 minutes.';
  if (d.avgHr != null && (d.avgHr < 30 || d.avgHr > 230)) return 'Heart rate should be between 30 and 230 bpm.';
  if (d.effort != null && (d.effort < 1 || d.effort > 10)) return 'Effort is rated 1–10.';
  return null;
}

function CardioForm({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextInput label="Date" type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} />
      <SelectInput label="Activity" value={draft.type} onChange={(e) => set('type', e.target.value as CardioType)}>
        {CARDIO_TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </SelectInput>
      {draft.type === 'other' && <TextInput label="Activity name" value={draft.label ?? ''} onChange={(e) => set('label', e.target.value)} className="sm:col-span-2" />}
      <NumberField label="Duration" unit="min" value={draft.durationMin} onChange={(v) => set('durationMin', v ?? 0)} />
      <NumberField label="Distance (optional)" unit="km" value={draft.distanceKm} onChange={(v) => set('distanceKm', v)} />
      <NumberField label="Average heart rate (optional)" unit="bpm" value={draft.avgHr} onChange={(v) => set('avgHr', v == null ? null : Math.round(v))} />
      <SelectInput label="Perceived effort (1–10)" value={draft.effort ?? ''} onChange={(e) => set('effort', e.target.value ? Number(e.target.value) : null)} hint="1 = very easy, 3–4 = conversational, 7+ = hard">
        <option value="">Not rated</option>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </SelectInput>
      <TextArea label="Notes" value={draft.notes} onChange={(e) => set('notes', e.target.value)} className="sm:col-span-2" />
    </div>
  );
}

export function CardioPage() {
  const profile = useProfile();
  const entries = useCardio();
  const schedule = useSchedule();
  const overrides = useOverrides();
  const todayDate = useToday();
  const toast = useToast();
  const confirm = useConfirm();
  const [draft, setDraft] = useState<Draft>(() => blank(todayDate));
  const [editing, setEditing] = useState<Draft | null>(null);
  const [range, setRange] = useState<'week' | 'month'>('week');
  if (!profile || !entries) return null;

  const save = async (d: Draft) => {
    const err = validateCardio(d);
    if (err) {
      toast(err, 'error');
      return false;
    }
    const row: CardioEntry = { ...d, id: d.id ?? uid(), createdAt: d.createdAt ?? Date.now(), label: d.type === 'other' ? d.label : undefined };
    await db.cardio.put(row);
    toast(d.id ? 'Cardio entry updated' : 'Cardio logged');
    return true;
  };

  const ws = startOfWeek(todayDate);
  const thisWeek = cardioMinutes(entries, ws, endOfWeek(todayDate));
  const plannedThisWeek = schedule
    ? dateRange(ws, endOfWeek(todayDate)).reduce((sum, d) => {
        const a = activityForDate(schedule, overrides, d);
        return a.kind === 'walk' || a.kind === 'cardio' ? sum + a.minMinutes : sum;
      }, 0)
    : 0;
  const prog = cardioProgression(entries, todayDate, !needsClearance(profile));
  const weekly = weeklyCardio(entries, 12, todayDate);
  const monthly = monthlyCardio(entries, 6, todayDate);
  const recent = [...entries].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1)).slice(0, 30);

  return (
    <div className="space-y-5">
      <PageHeader title="Cardio" icon={Activity} subtitle="Log walks and other activity. Minutes come only from your entries — no calorie-burn estimates." />
      <MedicalNotice profile={profile} compact />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="This week" className="lg:col-span-1">
          <Stat label="Logged minutes" value={thisWeek} unit="min" tone="accent" hint={`Mon ${formatDate(ws)} – Sun ${formatDate(addDays(ws, 6))}`} />
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted"><span>Planned minimum</span><span className="tabular">{thisWeek} / {plannedThisWeek} min</span></div>
              <ProgressBar value={thisWeek} max={plannedThisWeek || 1} label="Minutes vs planned" />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted"><span>General guideline (150 min)</span><span className="tabular">{Math.round((thisWeek / WEEKLY_ACTIVITY_GUIDELINE_MIN) * 100)}%</span></div>
              <ProgressBar value={thisWeek} max={WEEKLY_ACTIVITY_GUIDELINE_MIN} label="Minutes vs 150 minute guideline" />
            </div>
          </div>
        </Card>
        <Card title="Gentle progression" className="lg:col-span-2">
          <div className="flex gap-3 text-sm">
            <Footprints className="mt-0.5 h-5 w-5 shrink-0 text-accent-ink" aria-hidden />
            <div>
              <p>{prog.message}</p>
              {prog.baselineMin != null && <p className="mt-2 text-xs text-muted">Baseline = average of your last two full weeks ({Math.round(prog.baselineMin)} min/week). Guideline: WHO suggests 150–300 min/week of moderate activity for adults, built up gradually.</p>}
            </div>
          </div>
        </Card>
      </div>

      <Card title="Log activity">
        <CardioForm draft={draft} setDraft={setDraft} />
        <div className="mt-4 flex justify-end">
          <Button variant="primary" icon={Plus} onClick={async () => { if (await save(draft)) setDraft(blank(draft.date)); }}>Save entry</Button>
        </div>
      </Card>

      <Card title="Cardio minutes" action={<Tabs label="Chart range" value={range} onChange={setRange} tabs={[{ value: 'week', label: 'Weekly' }, { value: 'month', label: 'Monthly' }]} />}>
        {range === 'week' ? (
          <SeriesChart
            title="Weekly cardio minutes"
            data={weekly.map((w) => ({ x: w.weekStart, label: formatDate(w.weekStart), minutes: w.minutes }))}
            series={[{ key: 'minutes', label: 'Minutes', kind: 'bar', colorVar: '--accent', unit: 'min' }]}
            referenceY={WEEKLY_ACTIVITY_GUIDELINE_MIN}
            referenceLabel="150 min guideline"
            empty={<EmptyState icon={Activity} title="No cardio data available">Log a walk or other activity to see weekly minutes.</EmptyState>}
          />
        ) : (
          <SeriesChart
            title="Monthly cardio minutes"
            data={monthly.map((m) => ({ x: m.month, label: parseLocalDate(`${m.month}-01`).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }), minutes: m.minutes }))}
            series={[{ key: 'minutes', label: 'Minutes', kind: 'bar', colorVar: '--accent', unit: 'min' }]}
            empty={<EmptyState icon={Activity} title="No cardio data available">Log a walk or other activity to see monthly minutes.</EmptyState>}
          />
        )}
      </Card>

      <Card title="Recent entries">
        {recent.length === 0 ? (
          <EmptyState icon={Activity} title="No cardio logged yet" />
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {c.type === 'other' ? c.label || 'Other' : CARDIO_TYPES.find((t) => t.value === c.type)?.label} · <span className="tabular">{c.durationMin} min</span>
                  </p>
                  <p className="text-xs text-muted">
                    {formatDate(c.date, { weekday: 'short', day: 'numeric', month: 'short' })}
                    {c.distanceKm != null && ` · ${c.distanceKm} km`}
                    {c.avgHr != null && ` · ${c.avgHr} bpm`}
                    {c.effort != null && ` · effort ${c.effort}/10`}
                    {c.notes && ` · ${c.notes}`}
                  </p>
                </div>
                {c.effort != null && c.effort >= 8 && <Badge tone="warn">Hard</Badge>}
                <IconButton icon={Pencil} label="Edit entry" onClick={() => setEditing({ ...c })} />
                <IconButton icon={Trash2} label="Delete entry" onClick={async () => { if (await confirm({ title: 'Delete this cardio entry?', message: 'This cannot be undone.', danger: true, confirmLabel: 'Delete' })) await db.cardio.delete(c.id); }} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={!!editing} onClose={() => setEditing(null)} title="Edit cardio entry" footer={<><Button onClick={() => setEditing(null)}>Cancel</Button><Button variant="primary" onClick={async () => { if (editing && (await save(editing))) setEditing(null); }}>Save</Button></>}>
        {editing && <CardioForm draft={editing} setDraft={setEditing} />}
      </Dialog>
    </div>
  );
}
