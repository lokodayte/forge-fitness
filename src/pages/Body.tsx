import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BedDouble, Camera, Columns2, Dumbbell, Flag, Moon, Pencil, Ruler, Scale, Sigma, Trash2 } from 'lucide-react';
import type { BodyWeightEntry, MeasurementEntry, Profile, ProgressPhoto, RecoveryEntry, Target } from '../db/types';
import { db } from '../db/db';
import { updateProfile } from '../db/actions';
import { useBodyWeights, useCardio, useFoods, useMeasurements, useOverrides, useProfile, useRecovery, useSchedule, useSessions, useTargets } from '../hooks/useData';
import { useToday } from '../hooks/useNow';
import { movingAverage7, recoveryAverages, recoveryIndex, weeklyWeightChange, averageLoggedDays, dailyTotalsRange, cardioMinutes } from '../lib/metrics';
import { adherence, completedSessions, completedWorkingSets, consistency, sessionsInRange, sessionVolumeKg, strengthChange, strengthSeries } from '../lib/training';
import { addDays, addMonths, daysBetween, endOfMonth, formatDate, isLocalDate, parseLocalDate, startOfMonth, startOfWeek } from '../lib/dates';
import { uid } from '../lib/id';
import { formatVolume, formatWeight, kgToUnit, round, unitToKg } from '../lib/units';
import { getExercise } from '../data/exercises';
import { Badge, Button, Card, Dialog, EmptyState, IconButton, NumberField, PageHeader, ProgressBar, Rating, SelectInput, Stat, Tabs, TextArea, TextInput, Toggle, useConfirm, useToast } from '../components/ui';
import { SeriesChart } from '../components/Chart';

type Tab = 'weight' | 'measurements' | 'photos' | 'strength' | 'recovery' | 'summary' | 'targets';

export function BodyPage() {
  const profile = useProfile();
  const [tab, setTab] = useState<Tab>(() => (location.hash.includes('tab=recovery') ? 'recovery' : 'weight'));
  if (!profile) return null;
  return (
    <div>
      <PageHeader title="Body Progress" icon={Scale} subtitle="Weight trend, measurements, private photos, strength, recovery and summaries — all from your own logs." />
      <Tabs<Tab>
        label="Body progress sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'weight', label: 'Weight', icon: Scale },
          { value: 'measurements', label: 'Measurements', icon: Ruler },
          { value: 'photos', label: 'Photos', icon: Camera },
          { value: 'strength', label: 'Strength', icon: Dumbbell },
          { value: 'recovery', label: 'Recovery', icon: BedDouble },
          { value: 'summary', label: 'Summaries', icon: Sigma },
          { value: 'targets', label: 'Targets', icon: Flag },
        ]}
      />
      {tab === 'weight' && <WeightTab profile={profile} />}
      {tab === 'measurements' && <MeasurementsTab />}
      {tab === 'photos' && <PhotosTab />}
      {tab === 'strength' && <StrengthTab profile={profile} />}
      {tab === 'recovery' && <RecoveryTab profile={profile} />}
      {tab === 'summary' && <SummaryTab profile={profile} />}
      {tab === 'targets' && <TargetsTab profile={profile} />}
    </div>
  );
}

/* ================= Weight ================= */

function WeightTab({ profile }: { profile: Profile }) {
  const weights = useBodyWeights();
  const todayDate = useToday();
  const toast = useToast();
  const confirm = useConfirm();
  const [date, setDate] = useState(todayDate);
  const [value, setValue] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState<BodyWeightEntry | null>(null);
  const unit = profile.units;
  const points = useMemo(() => movingAverage7(weights ?? []), [weights]);
  if (!weights) return null;
  const latest = points[points.length - 1];
  const change = weeklyWeightChange(points);

  const save = async () => {
    if (!isLocalDate(date)) return toast('Choose a valid date', 'error');
    if (value == null || value <= 0) return toast('Enter your weight', 'error');
    const kg = unitToKg(value, unit);
    if (kg < 25 || kg > 350) return toast('That weight looks out of range', 'error');
    const existing = weights.find((w) => w.date === date);
    if (existing) {
      const ok = await confirm({ title: 'Replace existing weigh-in?', message: `You already logged ${formatWeight(existing.weightKg, unit)} on ${formatDate(date)}. FORGE keeps one weigh-in per day.`, confirmLabel: 'Replace' });
      if (!ok) return;
      await db.bodyweights.update(existing.id, { weightKg: kg, note });
    } else {
      await db.bodyweights.add({ id: uid(), date, weightKg: kg, note, createdAt: Date.now() });
    }
    setValue(null);
    setNote('');
    toast('Weigh-in saved');
  };

  const shown = points.filter((p) => p.date >= addDays(todayDate, -120));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><Stat label="Latest weigh-in" value={latest ? formatWeight(latest.weightKg, unit) : '—'} hint={latest ? formatDate(latest.date, { day: 'numeric', month: 'long' }) : 'No data available'} /></Card>
        <Card><Stat label="7-day average" value={latest ? formatWeight(latest.avg7Kg, unit) : '—'} tone="accent" hint={latest ? `Mean of ${latest.avgCount} weigh-in(s) in the last 7 days` : 'No data available'} /></Card>
        <Card>
          <Stat label="Trend per week" value={change != null ? `${change >= 0 ? '+' : ''}${formatWeight(change, unit, 2)}` : '—'} hint={change != null ? `${((change / latest!.avg7Kg) * 100).toFixed(2)}% of body weight / week (last 14 days)` : 'Needs weigh-ins spanning ≥ 7 days'} />
        </Card>
      </div>

      <Card title="Log weight">
        <div className="grid gap-3 sm:grid-cols-[auto_auto_1fr_auto] sm:items-end">
          <TextInput label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <NumberField label="Weight" unit={unit} value={value} onChange={setValue} />
          <TextInput label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. morning, after bathroom" />
          <Button variant="primary" onClick={save}>Save</Button>
        </div>
        <p className="mt-2 text-xs text-subtle">Tip: weigh at a consistent time (e.g. mornings). Daily weight fluctuates by 1–2 kg with water and food; the 7-day average is the trend to watch.</p>
      </Card>

      <Card title="Weight trend">
        <SeriesChart
          title="Body weight"
          data={shown.map((p) => ({ x: p.date, label: formatDate(p.date), raw: round(kgToUnit(p.weightKg, unit), 0.1), avg: round(kgToUnit(p.avg7Kg, unit), 0.1) }))}
          series={[
            { key: 'raw', label: 'Daily weigh-in', kind: 'dots', colorVar: '--subtle', unit, digits: 1 },
            { key: 'avg', label: '7-day average', kind: 'line', colorVar: '--accent', unit, digits: 1 },
          ]}
          yDomain={['auto', 'auto']}
          empty={<EmptyState icon={Scale} title="No weight data available">Log your first weigh-in above.</EmptyState>}
        />
        <p className="mt-2 text-xs text-subtle">7-day average = mean of all weigh-ins dated within the 7 calendar days ending on that day. Missing days are never filled in.</p>
      </Card>

      <Card title="Weigh-ins">
        {weights.length === 0 ? (
          <EmptyState title="No weigh-ins yet" />
        ) : (
          <ul className="max-h-96 divide-y divide-line overflow-y-auto">
            {[...points].reverse().map((p) => {
              const w = weights.find((x) => x.date === p.date)!;
              return (
                <li key={w.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-28 text-muted">{formatDate(w.date, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  <span className="flex-1 font-semibold tabular">{formatWeight(w.weightKg, unit)} <span className="text-xs font-normal text-muted">avg {formatWeight(p.avg7Kg, unit)}</span></span>
                  <span className="hidden flex-1 truncate text-xs text-muted sm:block">{w.note}</span>
                  <IconButton icon={Pencil} label="Edit weigh-in" onClick={() => setEditing({ ...w })} />
                  <IconButton icon={Trash2} label="Delete weigh-in" onClick={async () => { if (await confirm({ title: 'Delete weigh-in?', message: `${formatWeight(w.weightKg, unit)} on ${formatDate(w.date)}`, danger: true, confirmLabel: 'Delete' })) await db.bodyweights.delete(w.id); }} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit weigh-in"
        footer={
          <>
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (!editing) return;
                if (!isLocalDate(editing.date)) return toast('Invalid date', 'error');
                const clash = weights.find((x) => x.date === editing.date && x.id !== editing.id);
                if (clash) return toast('Another weigh-in already exists on that date', 'error');
                await db.bodyweights.put(editing);
                setEditing(null);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        {editing && (
          <div className="grid gap-3">
            <TextInput label="Date" type="date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} />
            <NumberField label="Weight" unit={unit} value={round(kgToUnit(editing.weightKg, unit), 0.1)} onChange={(v) => v != null && setEditing({ ...editing, weightKg: unitToKg(v, unit) })} />
            <TextInput label="Note" value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
          </div>
        )}
      </Dialog>
    </div>
  );
}

/* ================= Measurements ================= */

const MEASURES: { key: keyof Pick<MeasurementEntry, 'waistCm' | 'chestCm' | 'armCm' | 'hipCm' | 'thighCm'>; label: string }[] = [
  { key: 'waistCm', label: 'Waist' },
  { key: 'chestCm', label: 'Chest' },
  { key: 'armCm', label: 'Arm' },
  { key: 'hipCm', label: 'Hip' },
  { key: 'thighCm', label: 'Thigh' },
];

function MeasurementsTab() {
  const entries = useMeasurements();
  const todayDate = useToday();
  const toast = useToast();
  const confirm = useConfirm();
  const empty = (): MeasurementEntry => ({ id: '', date: todayDate, waistCm: null, chestCm: null, armCm: null, hipCm: null, thighCm: null, note: '', createdAt: 0 });
  const [d, setD] = useState<MeasurementEntry>(empty);
  const [chartKey, setChartKey] = useState<(typeof MEASURES)[number]['key']>('waistCm');
  if (!entries) return null;

  const save = async () => {
    if (!isLocalDate(d.date)) return toast('Choose a valid date', 'error');
    if (MEASURES.every((m) => d[m.key] == null)) return toast('Enter at least one measurement', 'error');
    if (MEASURES.some((m) => d[m.key] != null && (d[m.key]! < 10 || d[m.key]! > 250))) return toast('Measurements should be 10–250 cm', 'error');
    if (!d.id && entries.some((e) => e.date === d.date)) {
      if (!(await confirm({ title: 'Add a second entry for this date?', message: 'You already have measurements on this date. Edit that entry instead to avoid duplicates, or continue to add another.', confirmLabel: 'Add anyway' }))) return;
    }
    await db.measurements.put({ ...d, id: d.id || uid(), createdAt: d.createdAt || Date.now() });
    setD(empty());
    toast('Measurements saved');
  };

  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));
  const first = (k: (typeof MEASURES)[number]['key']) => sorted.find((e) => e[k] != null)?.[k] ?? null;
  const last = (k: (typeof MEASURES)[number]['key']) => [...sorted].reverse().find((e) => e[k] != null)?.[k] ?? null;

  return (
    <div className="space-y-4">
      <Card title={d.id ? 'Edit measurements' : 'Log measurements'}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <TextInput label="Date" type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} />
          {MEASURES.map((m) => (
            <NumberField key={m.key} label={m.label} unit="cm" value={d[m.key]} onChange={(v) => setD({ ...d, [m.key]: v })} />
          ))}
        </div>
        <TextInput className="mt-3" label="Note" value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} placeholder="e.g. waist at navel, relaxed" />
        <div className="mt-3 flex justify-end gap-2">
          {d.id && <Button onClick={() => setD(empty())}>Cancel edit</Button>}
          <Button variant="primary" onClick={save}>Save</Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {MEASURES.map((m) => {
          const f = first(m.key);
          const l = last(m.key);
          return (
            <Card key={m.key}>
              <Stat label={m.label} value={l ?? '—'} unit={l != null ? 'cm' : undefined} hint={f != null && l != null && f !== l ? `${l - f > 0 ? '+' : ''}${(l - f).toFixed(1)} cm since first` : l == null ? 'No data' : 'First entry'} />
            </Card>
          );
        })}
      </div>

      <Card title="Measurement trend" action={<SelectInput label="Measurement" value={chartKey} onChange={(e) => setChartKey(e.target.value as typeof chartKey)}>{MEASURES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</SelectInput>}>
        <SeriesChart
          title={`${MEASURES.find((m) => m.key === chartKey)?.label} measurement`}
          data={sorted.filter((e) => e[chartKey] != null).map((e) => ({ x: e.id, label: formatDate(e.date), v: e[chartKey] }))}
          series={[{ key: 'v', label: MEASURES.find((m) => m.key === chartKey)!.label, kind: 'line', colorVar: '--accent', unit: 'cm', digits: 1 }]}
          yDomain={['auto', 'auto']}
          empty={<EmptyState icon={Ruler} title="No measurement data available">Log measurements to see the trend.</EmptyState>}
        />
      </Card>

      <Card title="History">
        {sorted.length === 0 ? (
          <EmptyState title="No measurements yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm tabular">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="py-2">Date</th>
                  {MEASURES.map((m) => <th key={m.key}>{m.label}</th>)}
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...sorted].reverse().map((e) => (
                  <tr key={e.id} className="border-t border-line">
                    <td className="py-2">{formatDate(e.date, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    {MEASURES.map((m) => <td key={m.key}>{e[m.key] ?? '—'}</td>)}
                    <td className="text-right">
                      <IconButton icon={Pencil} label="Edit" onClick={() => setD({ ...e })} />
                      <IconButton icon={Trash2} label="Delete" onClick={async () => { if (await confirm({ title: 'Delete measurements?', message: formatDate(e.date), danger: true, confirmLabel: 'Delete' })) await db.measurements.delete(e.id); }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ================= Photos ================= */

function useObjectUrl(blob: Blob | undefined) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

function PhotoThumb({ p, selected, onSelect, onDelete }: { p: ProgressPhoto; selected: boolean; onSelect: () => void; onDelete: () => void }) {
  const url = useObjectUrl(p.blob);
  return (
    <li className={`overflow-hidden rounded-xl border ${selected ? 'border-accent ring-2 ring-accent/40' : 'border-line'} bg-surface`}>
      <button type="button" onClick={onSelect} aria-pressed={selected} className="block w-full" aria-label={`${selected ? 'Deselect' : 'Select'} ${p.pose} photo from ${formatDate(p.date)} for comparison`}>
        {url && <img src={url} alt={`Progress photo, ${p.pose}, ${formatDate(p.date)}`} className="aspect-[3/4] w-full object-cover" />}
      </button>
      <div className="flex items-center justify-between px-2 py-1.5 text-xs">
        <span>{formatDate(p.date)} · {p.pose}</span>
        <IconButton icon={Trash2} label="Delete photo" className="h-7 w-7" onClick={onDelete} />
      </div>
    </li>
  );
}

function PhotoLarge({ p }: { p: ProgressPhoto }) {
  const url = useObjectUrl(p.blob);
  return (
    <figure className="min-w-0 flex-1">
      {url && <img src={url} alt={`Progress photo, ${p.pose}, ${formatDate(p.date)}`} className="max-h-[70dvh] w-full rounded-xl object-contain" />}
      <figcaption className="mt-1 text-center text-sm font-semibold">{formatDate(p.date, { day: 'numeric', month: 'long', year: 'numeric' })} · {p.pose}</figcaption>
    </figure>
  );
}

/** Downscale large images before storing to keep IndexedDB usage reasonable. */
async function downscale(file: File, maxSide = 1600): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1_500_000) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b ?? file), 'image/jpeg', 0.85));
  } catch {
    return file;
  }
}

function PhotosTab() {
  const photos = useLiveQuery(() => db.photos.orderBy('date').reverse().toArray(), [], undefined);
  const todayDate = useToday();
  const toast = useToast();
  const confirm = useConfirm();
  const [date, setDate] = useState(todayDate);
  const [pose, setPose] = useState<ProgressPhoto['pose']>('front');
  const [sel, setSel] = useState<string[]>([]);
  const [compare, setCompare] = useState(false);
  if (!photos) return null;

  const onFile = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!isLocalDate(date)) return toast('Choose a valid date', 'error');
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) {
        toast(`${f.name} is not an image`, 'error');
        continue;
      }
      const blob = await downscale(f);
      await db.photos.add({ id: uid(), date, pose, blob, note: '', createdAt: Date.now() });
    }
    toast('Photo saved privately on this device');
  };

  const chosen = sel.map((id) => photos.find((p) => p.id === id)).filter(Boolean) as ProgressPhoto[];

  return (
    <div className="space-y-4">
      <Card>
        <p className="mb-3 rounded-xl bg-surface-2 p-3 text-xs text-muted">🔒 Photos are stored only in this browser's IndexedDB. They are never uploaded. They are excluded from backups unless you choose to include them in Settings.</p>
        <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
          <TextInput label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <SelectInput label="Pose" value={pose} onChange={(e) => setPose(e.target.value as ProgressPhoto['pose'])}>
            <option value="front">Front</option>
            <option value="side">Side</option>
            <option value="back">Back</option>
            <option value="other">Other</option>
          </SelectInput>
          <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg">
            <Camera className="h-4 w-4" aria-hidden /> Add photo
            <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { void onFile(e.target.files); e.target.value = ''; }} />
          </label>
        </div>
      </Card>

      <Card title="Gallery" action={<Button size="sm" icon={Columns2} disabled={chosen.length !== 2} onClick={() => setCompare(true)}>Compare selected ({chosen.length}/2)</Button>}>
        {photos.length === 0 ? (
          <EmptyState icon={Camera} title="No progress photos">Add photos in similar lighting and pose to compare over time.</EmptyState>
        ) : (
          <>
            <p className="mb-3 text-xs text-muted">Select two photos to compare side by side.</p>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {photos.map((p) => (
                <PhotoThumb
                  key={p.id}
                  p={p}
                  selected={sel.includes(p.id)}
                  onSelect={() => setSel((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s.slice(-1), p.id]))}
                  onDelete={async () => {
                    if (await confirm({ title: 'Delete this photo?', message: 'It will be permanently removed from this device.', danger: true, confirmLabel: 'Delete' })) {
                      await db.photos.delete(p.id);
                      setSel((s) => s.filter((x) => x !== p.id));
                    }
                  }}
                />
              ))}
            </ul>
          </>
        )}
      </Card>

      <Dialog open={compare && chosen.length === 2} onClose={() => setCompare(false)} title="Side-by-side comparison" wide>
        <div className="flex gap-3">
          {[...chosen].sort((a, b) => (a.date < b.date ? -1 : 1)).map((p) => <PhotoLarge key={p.id} p={p} />)}
        </div>
        {chosen.length === 2 && <p className="mt-2 text-center text-xs text-muted">{Math.abs(daysBetween(chosen[0].date, chosen[1].date))} days apart</p>}
      </Dialog>
    </div>
  );
}

/* ================= Strength ================= */

function StrengthTab({ profile }: { profile: Profile }) {
  const sessions = useSessions() ?? [];
  const unit = profile.units;
  const ids = useMemo(() => Array.from(new Set(completedSessions(sessions).flatMap((s) => s.exercises.filter((e) => e.sets.some((x) => x.completed && x.kind === 'working' && x.weightKg)).map((e) => e.exerciseId)))), [sessions]);
  const [id, setId] = useState<string>('');
  const current = id || ids[0] || '';
  const series = current ? strengthSeries(sessions, current) : [];

  if (ids.length === 0) return <Card><EmptyState icon={Dumbbell} title="No strength data available">Complete workouts with loaded sets to see strength graphs.</EmptyState></Card>;

  return (
    <div className="space-y-4">
      <Card title="Strength by exercise" action={<SelectInput label="Exercise" value={current} onChange={(e) => setId(e.target.value)}>{ids.map((x) => <option key={x} value={x}>{getExercise(x)?.name ?? x}</option>)}</SelectInput>}>
        <SeriesChart
          title="Top working weight"
          data={series.map((p, i) => ({ x: `${p.date}-${i}`, label: formatDate(p.date), top: p.topKg != null ? round(kgToUnit(p.topKg, unit), 0.1) : null }))}
          series={[{ key: 'top', label: 'Top working set load', kind: 'line', colorVar: '--accent', unit, digits: 1 }]}
          yDomain={['auto', 'auto']}
          empty={<EmptyState title="No loaded sets for this exercise" />}
        />
        <div className="mt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Exercise volume per session</h3>
          <SeriesChart
            title="Exercise volume"
            data={series.map((p, i) => ({ x: `${p.date}-${i}`, label: formatDate(p.date), vol: Math.round(kgToUnit(p.volumeKg, unit)) }))}
            series={[{ key: 'vol', label: 'Volume (load × reps)', kind: 'bar', colorVar: '--accent', unit }]}
            empty={<EmptyState title="No volume data" />}
          />
        </div>
      </Card>
      <Card title="Change since first log">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm tabular">
            <thead className="text-left text-xs text-muted"><tr><th className="py-2">Exercise</th><th>First top set</th><th>Latest top set</th><th>Change</th></tr></thead>
            <tbody>
              {ids.map((x) => {
                const c = strengthChange(strengthSeries(sessions, x));
                return (
                  <tr key={x} className="border-t border-line">
                    <td className="py-2">{getExercise(x)?.name ?? x}</td>
                    <td>{c ? formatWeight(c.firstKg, unit) : '—'}</td>
                    <td>{c ? formatWeight(c.latestKg, unit) : '—'}</td>
                    <td>{c ? <Badge tone={c.changeKg > 0 ? 'ok' : 'default'}>{c.changeKg >= 0 ? '+' : ''}{formatWeight(c.changeKg, unit)} ({c.changePct.toFixed(1)}%)</Badge> : <span className="text-xs text-muted">needs 2+ sessions</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-subtle">Top set = heaviest completed working set in a session (ties broken by reps). No one-rep-max estimates are made.</p>
      </Card>
    </div>
  );
}

/* ================= Recovery ================= */

export function RecoveryForm({ initialDate, onSaved }: { initialDate: string; onSaved?: () => void }) {
  const entries = useRecovery();
  const toast = useToast();
  const blank = (date: string): RecoveryEntry => ({ id: '', date, sleepHours: null, sleepQuality: null, fatigue: null, soreness: null, stress: null, readiness: null, notes: '', createdAt: 0 });
  const [r, setR] = useState<RecoveryEntry>(() => blank(initialDate));
  useEffect(() => {
    const ex = entries?.find((e) => e.date === r.date);
    if (ex && ex.id !== r.id) setR({ ...ex });
    if (!ex && r.id) setR(blank(r.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, r.date]);
  const save = async () => {
    if (!isLocalDate(r.date)) return toast('Choose a valid date', 'error');
    if (r.sleepHours != null && (r.sleepHours < 0 || r.sleepHours > 24)) return toast('Sleep hours must be 0–24', 'error');
    if ([r.sleepHours, r.sleepQuality, r.fatigue, r.soreness, r.stress, r.readiness].every((v) => v == null) && !r.notes.trim()) return toast('Enter at least one value', 'error');
    await db.recovery.put({ ...r, id: r.id || uid(), createdAt: r.createdAt || Date.now() });
    toast(r.id ? 'Recovery entry updated' : 'Recovery logged');
    onSaved?.();
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput label="Date (the morning you woke up)" type="date" value={r.date} onChange={(e) => setR({ ...r, date: e.target.value })} />
        <NumberField label="Sleep" unit="hours" value={r.sleepHours} onChange={(v) => setR({ ...r, sleepHours: v })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Rating label="Sleep quality" value={r.sleepQuality} onChange={(v) => setR({ ...r, sleepQuality: v })} low="Poor" high="Excellent" />
        <Rating label="Readiness" value={r.readiness} onChange={(v) => setR({ ...r, readiness: v })} low="Low" high="High" />
        <Rating label="Fatigue" value={r.fatigue} onChange={(v) => setR({ ...r, fatigue: v })} low="None" high="Very high" />
        <Rating label="Soreness" value={r.soreness} onChange={(v) => setR({ ...r, soreness: v })} low="None" high="Very high" />
        <Rating label="Stress" value={r.stress} onChange={(v) => setR({ ...r, stress: v })} low="Low" high="Very high" />
      </div>
      <TextArea label="Recovery notes" value={r.notes} onChange={(e) => setR({ ...r, notes: e.target.value })} placeholder="Anything affecting recovery — late night, illness, symptoms to mention to your doctor…" />
      <div className="flex justify-end">
        <Button variant="primary" onClick={save}>{r.id ? 'Update entry' : 'Save recovery'}</Button>
      </div>
    </div>
  );
}

function RecoveryTab({ profile }: { profile: Profile }) {
  const entries = useRecovery();
  const todayDate = useToday();
  const confirm = useConfirm();
  if (!entries) return null;
  const a7 = recoveryAverages(entries, addDays(todayDate, -6), todayDate);
  const a28 = recoveryAverages(entries, addDays(todayDate, -27), todayDate);
  const last28 = entries.filter((e) => e.date >= addDays(todayDate, -27));
  const f1 = (v: number | null, d = 1) => (v == null ? '—' : v.toFixed(d));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card><Stat label="Sleep · 7-day avg" value={f1(a7.sleepHours)} unit={a7.sleepHours != null ? 'h' : undefined} tone="accent" hint={`${a7.days} day(s) logged`} /></Card>
        <Card><Stat label="Sleep · 28-day avg" value={f1(a28.sleepHours)} unit={a28.sleepHours != null ? 'h' : undefined} hint={`${a28.days} day(s) logged`} /></Card>
        <Card><Stat label="Sleep quality · 7d" value={f1(a7.sleepQuality)} unit={a7.sleepQuality != null ? '/ 5' : undefined} /></Card>
        <Card><Stat label="Readiness · 7d" value={f1(a7.readiness)} unit={a7.readiness != null ? '/ 5' : undefined} hint={a7.fatigue != null ? `Fatigue ${f1(a7.fatigue)} · Soreness ${f1(a7.soreness)} · Stress ${f1(a7.stress)}` : undefined} /></Card>
      </div>

      <Card title="Log recovery"><RecoveryForm initialDate={todayDate} /></Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Sleep · last 28 days">
          <SeriesChart
            title="Sleep hours"
            data={last28.map((e) => ({ x: e.date, label: formatDate(e.date), h: e.sleepHours }))}
            series={[{ key: 'h', label: 'Sleep', kind: 'bar', colorVar: '--accent', unit: 'h', digits: 1 }]}
            referenceY={7}
            referenceLabel="7 h"
            empty={<EmptyState icon={Moon} title="No sleep data available" />}
          />
        </Card>
        <Card title="Recovery index · last 28 days">
          <SeriesChart
            title="Recovery index"
            data={last28.map((e) => ({ x: e.date, label: formatDate(e.date), idx: recoveryIndex(e) }))}
            series={[{ key: 'idx', label: 'Recovery index', kind: 'line', colorVar: '--accent', unit: '/100' }]}
            yDomain={[0, 100]}
            empty={<EmptyState title="No ratings logged" />}
          />
          <p className="mt-2 text-xs text-subtle">Index = average of your 1–5 ratings (fatigue, soreness and stress inverted), rescaled to 0–100. A simple summary of what you entered — not a medical score.</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Sleep guidance">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
            <li>Most adults do best with 7–9 hours; teenagers and young adults often need toward the upper end.</li>
            <li>Keep a consistent sleep and wake time, including weekends.</li>
            <li>Get daylight in the morning; dim screens and lights in the hour before bed.</li>
            <li>Limit caffeine after early afternoon and avoid large meals right before bed.</li>
            <li>Persistent poor sleep or new daytime symptoms are worth raising with your doctor.</li>
          </ul>
        </Card>
        <Card title="Reminders" id="reminders">
          <Toggle checked={profile.remindersEnabled} onChange={(v) => updateProfile({ remindersEnabled: v })} label="Show in-app reminders" description="When FORGE is open: a wind-down banner in the hour before bedtime, and a prompt to log last night's sleep." />
          <TextInput className="mt-3" label="Target bedtime" type="time" value={profile.bedtime ?? ''} onChange={(e) => updateProfile({ bedtime: e.target.value || null })} hint="Reminders appear only inside the app — FORGE sends no notifications and has no server." />
        </Card>
      </div>

      <Card title="Recovery log">
        {entries.length === 0 ? (
          <EmptyState icon={BedDouble} title="No recovery entries yet" />
        ) : (
          <ul className="max-h-96 divide-y divide-line overflow-y-auto text-sm">
            {[...entries].reverse().map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2">
                <span className="w-24 text-muted">{formatDate(e.date)}</span>
                <span className="flex-1 tabular">
                  {e.sleepHours != null ? `${e.sleepHours} h` : '—'} · Q {e.sleepQuality ?? '–'} · R {e.readiness ?? '–'} · F {e.fatigue ?? '–'} · S {e.soreness ?? '–'} · St {e.stress ?? '–'}
                  {e.notes && <span className="block truncate text-xs text-muted">{e.notes}</span>}
                </span>
                <IconButton icon={Trash2} label="Delete recovery entry" onClick={async () => { if (await confirm({ title: 'Delete recovery entry?', message: formatDate(e.date), danger: true, confirmLabel: 'Delete' })) await db.recovery.delete(e.id); }} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ================= Summaries ================= */

function SummaryTab({ profile }: { profile: Profile }) {
  const sessions = useSessions() ?? [];
  const cardio = useCardio() ?? [];
  const foods = useFoods() ?? [];
  const weights = useBodyWeights() ?? [];
  const recovery = useRecovery() ?? [];
  const schedule = useSchedule();
  const overrides = useOverrides();
  const todayDate = useToday();
  const [mode, setMode] = useState<'week' | 'month'>('week');
  if (!schedule) return null;
  const unit = profile.units;
  const start = profile.programStartDate;

  const periods = mode === 'week'
    ? Array.from({ length: 8 }, (_, i) => { const s = addDays(startOfWeek(todayDate), -7 * i); return { from: s, to: addDays(s, 6), label: `Week of ${formatDate(s)}` }; })
    : Array.from({ length: 6 }, (_, i) => { const s = addMonths(startOfMonth(todayDate), -i); return { from: s, to: endOfMonth(s), label: parseLocalDate(s).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) }; });

  const cons = consistency(sessions, schedule, overrides, start, todayDate);
  const overall = adherence(sessions, schedule, overrides, start, todayDate);

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Card><Stat label="Completed vs planned" value={overall.percent != null ? `${overall.percent}%` : '—'} tone="accent" hint={`${overall.completed} of ${overall.planned} planned workouts since ${formatDate(start)}`} /></Card>
        <Card><Stat label="Consistency" value={cons.percent != null ? `${cons.percent}%` : '—'} hint={cons.weeks ? `${cons.metWeeks} of ${cons.weeks} full weeks hit the plan` : 'No full weeks yet'} /></Card>
        <Card><Stat label="Total sessions" value={completedSessions(sessions).length} hint="All-time completed" /></Card>
      </div>
      <Card title={mode === 'week' ? 'Weekly summaries' : 'Monthly summaries'} action={<Tabs label="Summary period" value={mode} onChange={setMode} tabs={[{ value: 'week', label: 'Weekly' }, { value: 'month', label: 'Monthly' }]} />}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm tabular">
            <thead className="text-left text-xs text-muted">
              <tr><th className="py-2">Period</th><th>Workouts (done/planned)</th><th>Working sets</th><th>Volume</th><th>Cardio</th><th>Avg weight</th><th>Avg protein</th><th>Avg sleep</th></tr>
            </thead>
            <tbody>
              {periods.map((p) => {
                const to = p.to > todayDate ? todayDate : p.to;
                const list = sessionsInRange(sessions, p.from, p.to);
                const ad = adherence(sessions, schedule, overrides, p.from < start ? start : p.from, to);
                const w = avg(weights.filter((x) => x.date >= p.from && x.date <= p.to).map((x) => x.weightKg));
                const n = averageLoggedDays(dailyTotalsRange(foods, p.from, to < p.from ? p.from : to));
                const sl = recoveryAverages(recovery, p.from, p.to).sleepHours;
                return (
                  <tr key={p.from} className="border-t border-line">
                    <td className="py-2 font-medium">{p.label}</td>
                    <td>{list.length} / {ad.planned}</td>
                    <td>{list.reduce((s, x) => s + completedWorkingSets(x), 0)}</td>
                    <td>{formatVolume(list.reduce((s, x) => s + sessionVolumeKg(x), 0), unit)}</td>
                    <td>{cardioMinutes(cardio, p.from, p.to)} min</td>
                    <td>{w != null ? formatWeight(w, unit) : '—'}</td>
                    <td>{n ? `${Math.round(n.proteinG)} g` : '—'}</td>
                    <td>{sl != null ? `${sl.toFixed(1)} h` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-subtle">Planned workouts count only days from your program start up to today. Averages use logged days only. "—" means no data available.</p>
      </Card>
    </div>
  );
}

/* ================= Targets ================= */

const TARGET_META: Record<Target['kind'], { label: string; unit: (p: Profile) => string }> = {
  weight: { label: 'Body weight', unit: (p) => p.units },
  waist: { label: 'Waist', unit: () => 'cm' },
  workoutsWeekly: { label: 'Workouts per week', unit: () => 'sessions' },
  cardioWeekly: { label: 'Cardio per week', unit: () => 'min' },
};

/** Weight targets faster than 1% of body weight per week are flagged as unrealistic for recomposition. */
export function weightTargetRate(currentKg: number, targetKg: number, todayDate: string, byDate: string): { kgPerWeek: number; pctPerWeek: number; realistic: boolean } | null {
  const days = daysBetween(todayDate, byDate);
  if (days <= 0) return null;
  const kgPerWeek = ((targetKg - currentKg) / days) * 7;
  const pctPerWeek = (Math.abs(kgPerWeek) / currentKg) * 100;
  return { kgPerWeek, pctPerWeek, realistic: pctPerWeek <= 1 };
}

function TargetsTab({ profile }: { profile: Profile }) {
  const targets = useTargets();
  const weights = useBodyWeights() ?? [];
  const measurements = useMeasurements() ?? [];
  const sessions = useSessions() ?? [];
  const cardio = useCardio() ?? [];
  const todayDate = useToday();
  const toast = useToast();
  const confirm = useConfirm();
  const [kind, setKind] = useState<Target['kind']>('weight');
  const [value, setValue] = useState<number | null>(null);
  const [by, setBy] = useState('');
  const unit = profile.units;
  const trend = movingAverage7(weights);
  const currentKg = trend[trend.length - 1]?.avg7Kg ?? null;
  const ws = startOfWeek(todayDate);

  const currentValue = (k: Target['kind']): number | null => {
    if (k === 'weight') return currentKg != null ? round(kgToUnit(currentKg, unit), 0.1) : null;
    if (k === 'waist') return [...measurements].sort((a, b) => (a.date < b.date ? 1 : -1)).find((m) => m.waistCm != null)?.waistCm ?? null;
    if (k === 'workoutsWeekly') return sessionsInRange(sessions, ws, addDays(ws, 6)).length;
    return cardioMinutes(cardio, ws, addDays(ws, 6));
  };

  const preview = kind === 'weight' && value != null && currentKg != null && isLocalDate(by) ? weightTargetRate(currentKg, unitToKg(value, unit), todayDate, by) : null;

  const add = async () => {
    if (value == null || value <= 0) return toast('Enter a target value', 'error');
    if (by && !isLocalDate(by)) return toast('Invalid date', 'error');
    if (by && by <= todayDate) return toast('Target date must be in the future', 'error');
    const stored = kind === 'weight' ? unitToKg(value, unit) : value;
    if (targets.some((t) => t.kind === kind)) {
      if (!(await confirm({ title: 'Replace existing target?', message: `You already have a ${TARGET_META[kind].label.toLowerCase()} target.`, confirmLabel: 'Replace' }))) return;
      await db.targets.where('kind').equals(kind).delete();
    }
    await db.targets.add({ id: uid(), kind, value: stored, byDate: by || null, createdAt: Date.now() });
    setValue(null);
    setBy('');
    toast('Target saved');
  };

  return (
    <div className="space-y-4">
      <Card title="Set an optional target">
        <p className="mb-3 text-sm text-muted">Targets are optional. For body recomposition, slow changes (around 0.25–0.5% of body weight per week) help preserve muscle. Weight targets faster than 1% per week are flagged.</p>
        <div className="grid gap-3 sm:grid-cols-4 sm:items-end">
          <SelectInput label="Target" value={kind} onChange={(e) => setKind(e.target.value as Target['kind'])}>
            {Object.entries(TARGET_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </SelectInput>
          <NumberField label="Value" unit={TARGET_META[kind].unit(profile)} value={value} onChange={setValue} />
          <TextInput label="By date (optional)" type="date" value={by} onChange={(e) => setBy(e.target.value)} />
          <Button variant="primary" onClick={add}>Save target</Button>
        </div>
        {preview && (
          <p className={`mt-3 rounded-xl p-3 text-sm ${preview.realistic ? 'bg-surface-2' : 'bg-warn-bg text-warn'}`}>
            Requires {preview.kgPerWeek >= 0 ? '+' : ''}{formatWeight(preview.kgPerWeek, unit, 2)} per week ({preview.pctPerWeek.toFixed(2)}% of body weight).{' '}
            {preview.realistic ? 'This pace is within a realistic range.' : 'This is faster than recommended for recomposition — consider a later date.'}
          </p>
        )}
        {kind === 'weight' && currentKg == null && <p className="mt-2 text-xs text-subtle">Log weigh-ins to check how realistic a weight target is.</p>}
      </Card>
      <Card title="Your targets">
        {targets.length === 0 ? (
          <EmptyState icon={Flag} title="No targets set">Targets are optional — tracking works without them.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {targets.map((t) => {
              const meta = TARGET_META[t.kind];
              const tv = t.kind === 'weight' ? round(kgToUnit(t.value, unit), 0.1) : t.value;
              const cur = currentValue(t.kind);
              const weekly = t.kind === 'workoutsWeekly' || t.kind === 'cardioWeekly';
              return (
                <li key={t.id} className="rounded-xl border border-line p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{meta.label}: {tv} {meta.unit(profile)}{t.byDate && <span className="text-sm font-normal text-muted"> by {formatDate(t.byDate, { day: 'numeric', month: 'short', year: 'numeric' })}</span>}</p>
                    <IconButton icon={Trash2} label="Delete target" onClick={() => db.targets.delete(t.id)} />
                  </div>
                  <p className="text-sm text-muted">Current{weekly ? ' (this week)' : ''}: {cur != null ? `${cur} ${meta.unit(profile)}` : 'no data available'}</p>
                  {weekly && cur != null && <ProgressBar className="mt-2" value={cur} max={t.value} label={`${meta.label} progress`} />}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

