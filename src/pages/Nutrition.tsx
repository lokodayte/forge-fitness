import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Droplets, Pencil, Plus, Salad, Star, Trash2, Calculator } from 'lucide-react';
import type { FavoriteMeal, FoodEntry, MealType, Profile } from '../db/types';
import { db } from '../db/db';
import { updateProfile } from '../db/actions';
import { useBodyWeights, useFavorites, useFoods, useProfile, useWater } from '../hooks/useData';
import { useToday } from '../hooks/useNow';
import { ACTIVITY_FACTORS, averageLoggedDays, caloriesPerServing, calorieTarget, clampDeficit, dailyTotalsRange, dayTotals, formulaMaintenance, logsMaintenance, movingAverage7, waterForDate } from '../lib/metrics';
import { addDays, formatDate, formatLongDate, isLocalDate, startOfWeek } from '../lib/dates';
import { uid } from '../lib/id';
import { formatWeight } from '../lib/units';
import { Badge, Button, Card, Dialog, EmptyState, IconButton, NumberField, PageHeader, ProgressBar, SelectInput, Stat, TextInput, Toggle, cx, useConfirm, useToast } from '../components/ui';
import { SeriesChart } from '../components/Chart';

const MEALS: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snacks' },
];

type FoodDraft = Omit<FoodEntry, 'id' | 'createdAt'> & { id?: string; createdAt?: number };

const blankFood = (date: string, meal: MealType = 'breakfast'): FoodDraft => ({ date, meal, name: '', servings: 1, calories: null, proteinG: 0, carbsG: 0, fatG: 0 });

export function validateFood(d: FoodDraft): string | null {
  if (!isLocalDate(d.date)) return 'Choose a valid date.';
  if (!d.name.trim()) return 'Enter a food or meal name.';
  if (!(d.servings > 0)) return 'Servings must be greater than 0.';
  if ([d.proteinG, d.carbsG, d.fatG].some((v) => !(v >= 0))) return 'Macros cannot be negative.';
  if (d.calories != null && d.calories < 0) return 'Calories cannot be negative.';
  if (d.calories == null && d.proteinG + d.carbsG + d.fatG === 0) return 'Enter calories or at least one macro.';
  return null;
}

function FoodForm({ d, set }: { d: FoodDraft; set: (d: FoodDraft) => void }) {
  const up = <K extends keyof FoodDraft>(k: K, v: FoodDraft[K]) => set({ ...d, [k]: v });
  const derived = d.proteinG * 4 + d.carbsG * 4 + d.fatG * 9;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <TextInput label="Food / meal" value={d.name} onChange={(e) => up('name', e.target.value)} className="col-span-2" placeholder="e.g. Greek yoghurt & oats" />
      <SelectInput label="Meal" value={d.meal} onChange={(e) => up('meal', e.target.value as MealType)}>
        {MEALS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
      </SelectInput>
      <NumberField label="Servings" value={d.servings} onChange={(v) => up('servings', v ?? 0)} />
      <NumberField label="Calories / serving" unit="kcal" value={d.calories} onChange={(v) => up('calories', v)} hint={d.calories == null ? `Blank = from macros (${Math.round(derived)} kcal)` : undefined} />
      <NumberField label="Protein / serving" unit="g" value={d.proteinG} onChange={(v) => up('proteinG', v ?? 0)} />
      <NumberField label="Carbs / serving" unit="g" value={d.carbsG} onChange={(v) => up('carbsG', v ?? 0)} />
      <NumberField label="Fat / serving" unit="g" value={d.fatG} onChange={(v) => up('fatG', v ?? 0)} />
    </div>
  );
}

export function NutritionPage() {
  const profile = useProfile();
  const foods = useFoods();
  const favorites = useFavorites();
  const water = useWater();
  const todayDate = useToday();
  const toast = useToast();
  const confirm = useConfirm();
  const [date, setDate] = useState(todayDate);
  const [draft, setDraft] = useState<FoodDraft>(() => blankFood(todayDate));
  const [saveFav, setSaveFav] = useState(false);
  const [editing, setEditing] = useState<FoodDraft | null>(null);
  if (!profile || !foods) return null;

  const totals = dayTotals(foods, date);
  const target = calorieTarget(profile);
  const waterMl = waterForDate(water, date);
  const dayEntries = foods.filter((f) => f.date === date);

  const saveFood = async (d: FoodDraft) => {
    const err = validateFood(d);
    if (err) {
      toast(err, 'error');
      return false;
    }
    await db.foods.put({ ...d, name: d.name.trim(), id: d.id ?? uid(), createdAt: d.createdAt ?? Date.now() });
    toast(d.id ? 'Entry updated' : 'Food logged');
    return true;
  };

  const addFavorite = async (f: FavoriteMeal) => {
    await db.foods.add({ id: uid(), date, meal: draft.meal, name: f.name, servings: 1, calories: f.calories, proteinG: f.proteinG, carbsG: f.carbsG, fatG: f.fatG, createdAt: Date.now() });
    toast(`${f.name} added`);
  };

  const last14 = dailyTotalsRange(foods, addDays(todayDate, -13), todayDate);
  const weekAvg = averageLoggedDays(dailyTotalsRange(foods, startOfWeek(todayDate), todayDate));

  return (
    <div className="space-y-5">
      <PageHeader title="Nutrition" icon={Salad} subtitle="Manual meal logging. Totals are calculated only from what you enter." />

      <div className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-surface p-2">
        <IconButton icon={ChevronLeft} label="Previous day" onClick={() => setDate((d) => addDays(d, -1))} />
        <label className="flex items-center gap-2 text-sm font-semibold">
          <span className="sr-only">Date</span>
          <span className="hidden sm:inline">{formatLongDate(date)}</span>
          <input type="date" value={date} onChange={(e) => isLocalDate(e.target.value) && setDate(e.target.value)} className="rounded-lg bg-surface-2 px-2 py-1 text-sm sm:w-36" />
        </label>
        <IconButton icon={ChevronRight} label="Next day" onClick={() => setDate((d) => addDays(d, 1))} disabled={date >= todayDate} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <Stat label="Calories" value={Math.round(totals.calories).toLocaleString()} unit="kcal" tone="accent" hint={target ? `Target ${target.toLocaleString()} kcal` : 'No calorie target set — see below'} />
          {target && <ProgressBar className="mt-3" value={totals.calories} max={target} label="Calories vs target" />}
          {totals.derived && <p className="mt-2 text-[11px] text-subtle">Includes calories derived from macros (4/4/9).</p>}
        </Card>
        <Card>
          <Stat label="Protein" value={Math.round(totals.proteinG)} unit="g" hint={`Target ${profile.proteinMinG}–${profile.proteinMaxG} g`} />
          <ProgressBar className="mt-3" value={totals.proteinG} max={profile.proteinMinG} label="Protein vs minimum target" />
          {totals.proteinG >= profile.proteinMinG && <Badge tone="ok" className="mt-2">Target range reached</Badge>}
        </Card>
        <Card>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Carbs" value={Math.round(totals.carbsG)} unit="g" />
            <Stat label="Fat" value={Math.round(totals.fatG)} unit="g" />
          </div>
          <p className="mt-3 text-xs text-muted">{totals.entries} entr{totals.entries === 1 ? 'y' : 'ies'} logged</p>
        </Card>
        <Card>
          <Stat label="Water" value={(waterMl / 1000).toFixed(2)} unit="L" hint={`Target ${(profile.waterTargetMl / 1000).toFixed(1)} L`} />
          <ProgressBar className="mt-3" value={waterMl} max={profile.waterTargetMl} label="Water vs target" />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[250, 500].map((ml) => (
              <Button key={ml} size="sm" icon={Droplets} onClick={() => db.water.add({ id: uid(), date, ml, createdAt: Date.now() })}>+{ml} ml</Button>
            ))}
            <Button size="sm" variant="ghost" disabled={waterMl === 0} onClick={async () => { const last = water.filter((w) => w.date === date).sort((a, b) => b.createdAt - a.createdAt)[0]; if (last) await db.water.delete(last.id); }}>Undo</Button>
          </div>
        </Card>
      </div>

      <Card title="Log food">
        <FoodForm d={{ ...draft, date }} set={(d) => setDraft(d)} />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={saveFav} onChange={(e) => setSaveFav(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" /> Save as favourite meal
          </label>
          <Button
            variant="primary"
            icon={Plus}
            onClick={async () => {
              const d = { ...draft, date };
              if (await saveFood(d)) {
                if (saveFav) {
                  const exists = favorites.some((f) => f.name.toLowerCase() === d.name.trim().toLowerCase());
                  if (!exists) await db.favorites.add({ id: uid(), name: d.name.trim(), calories: d.calories, proteinG: d.proteinG, carbsG: d.carbsG, fatG: d.fatG, createdAt: Date.now() });
                  else toast('A favourite with that name already exists', 'info');
                }
                setDraft(blankFood(date, d.meal));
                setSaveFav(false);
              }
            }}
          >
            Add to {MEALS.find((m) => m.value === draft.meal)?.label}
          </Button>
        </div>
        {favorites.length > 0 && (
          <div className="mt-4 border-t border-line pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Favourites — tap to add 1 serving</p>
            <ul className="flex flex-wrap gap-2">
              {favorites.map((f) => (
                <li key={f.id} className="flex items-center rounded-xl border border-line bg-surface-2">
                  <button type="button" onClick={() => addFavorite(f)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm">
                    <Star className="h-3.5 w-3.5 text-accent-ink" aria-hidden /> {f.name} <span className="text-xs text-subtle">{Math.round(caloriesPerServing(f))} kcal · {f.proteinG} g P</span>
                  </button>
                  <IconButton icon={Trash2} label={`Delete favourite ${f.name}`} className="h-8 w-8" onClick={async () => { if (await confirm({ title: `Delete favourite "${f.name}"?`, message: 'Logged entries are not affected.', danger: true, confirmLabel: 'Delete' })) await db.favorites.delete(f.id); }} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card title={`Meals · ${formatDate(date, { weekday: 'short', day: 'numeric', month: 'short' })}`}>
        {dayEntries.length === 0 ? (
          <EmptyState icon={Salad} title="No food logged for this day">Use the form above or tap a favourite.</EmptyState>
        ) : (
          <div className="space-y-4">
            {MEALS.map((m) => {
              const list = dayEntries.filter((f) => f.meal === m.value);
              if (!list.length) return null;
              const t = dayTotals(list, date);
              return (
                <div key={m.value}>
                  <div className="mb-1 flex items-baseline justify-between">
                    <h3 className="text-sm font-bold">{m.label}</h3>
                    <span className="text-xs tabular text-muted">{Math.round(t.calories)} kcal · {Math.round(t.proteinG)} g protein</span>
                  </div>
                  <ul className="divide-y divide-line rounded-xl border border-line">
                    {list.map((f) => (
                      <li key={f.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{f.name}{f.servings !== 1 && <span className="text-muted"> × {f.servings}</span>}</p>
                          <p className="text-xs tabular text-muted">{Math.round(caloriesPerServing(f) * f.servings)} kcal{f.calories == null && '*'} · P {+(f.proteinG * f.servings).toFixed(1)} g · C {+(f.carbsG * f.servings).toFixed(1)} g · F {+(f.fatG * f.servings).toFixed(1)} g</p>
                        </div>
                        <IconButton icon={Pencil} label={`Edit ${f.name}`} onClick={() => setEditing({ ...f })} />
                        <IconButton icon={Trash2} label={`Delete ${f.name}`} onClick={async () => { if (await confirm({ title: 'Delete this entry?', message: f.name, danger: true, confirmLabel: 'Delete' })) await db.foods.delete(f.id); }} />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            <p className="text-[11px] text-subtle">* calories derived from macros: protein × 4 + carbs × 4 + fat × 9.</p>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Calories · last 14 days">
          <SeriesChart
            title="Daily calories"
            data={last14.map((d) => ({ x: d.date, label: formatDate(d.date), kcal: d.entries ? Math.round(d.calories) : null }))}
            series={[{ key: 'kcal', label: 'Calories', kind: 'bar', colorVar: '--accent', unit: 'kcal' }]}
            referenceY={target}
            referenceLabel="target"
            empty={<EmptyState title="No data available">Log food to see daily calories.</EmptyState>}
          />
        </Card>
        <Card title="Macros · last 14 days">
          <SeriesChart
            title="Daily macros"
            data={last14.map((d) => ({ x: d.date, label: formatDate(d.date), p: d.entries ? Math.round(d.proteinG) : null, c: d.entries ? Math.round(d.carbsG) : null, f: d.entries ? Math.round(d.fatG) : null }))}
            series={[
              { key: 'p', label: 'Protein', kind: 'bar', colorVar: '--chart-1', unit: 'g', stackId: 'm' },
              { key: 'c', label: 'Carbs', kind: 'bar', colorVar: '--chart-2', unit: 'g', stackId: 'm' },
              { key: 'f', label: 'Fat', kind: 'bar', colorVar: '--chart-3', unit: 'g', stackId: 'm' },
            ]}
            empty={<EmptyState title="No data available">Log food to see macros.</EmptyState>}
          />
        </Card>
      </div>

      <Card title="This week">
        {weekAvg ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <Stat label="Days logged" value={weekAvg.days} />
            <Stat label="Avg calories" value={Math.round(weekAvg.calories).toLocaleString()} unit="kcal" />
            <Stat label="Avg protein" value={Math.round(weekAvg.proteinG)} unit="g" />
            <Stat label="Avg carbs" value={Math.round(weekAvg.carbsG)} unit="g" />
            <Stat label="Avg fat" value={Math.round(weekAvg.fatG)} unit="g" />
          </div>
        ) : (
          <EmptyState title="No data available this week" />
        )}
        <p className="mt-3 text-xs text-subtle">Averages include only days with at least one entry; unlogged days are not counted as zero.</p>
      </Card>

      <MaintenanceCard profile={profile} foods={foods} todayDate={todayDate} />

      <Dialog open={!!editing} onClose={() => setEditing(null)} title="Edit food entry" footer={<><Button onClick={() => setEditing(null)}>Cancel</Button><Button variant="primary" onClick={async () => { if (editing && (await saveFood(editing))) setEditing(null); }}>Save</Button></>}>
        {editing && (
          <div className="space-y-3">
            <TextInput label="Date" type="date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} />
            <FoodForm d={editing} set={setEditing} />
          </div>
        )}
      </Dialog>
    </div>
  );
}

function MaintenanceCard({ profile, foods, todayDate }: { profile: Profile; foods: FoodEntry[]; todayDate: string }) {
  const weights = useBodyWeights() ?? [];
  const toast = useToast();
  const [manual, setManual] = useState<number | null>(null);
  const trend = useMemo(() => movingAverage7(weights), [weights]);
  const latest = trend[trend.length - 1];
  const weightForFormula = latest?.avg7Kg ?? profile.startWeightKg;
  const formula = formulaMaintenance(weightForFormula, profile.heightCm, profile.age, profile.sex, profile.activityLevel);
  const fromLogs = logsMaintenance(foods, weights, todayDate);
  const target = calorieTarget(profile);

  const use = async (method: 'formula' | 'logs' | 'manual', kcal: number) => {
    await updateProfile({ maintenance: { method, kcal: Math.round(kcal), setOn: todayDate } });
    toast('Maintenance estimate saved');
  };

  return (
    <Card title="Calorie target (optional)" id="maintenance">
      <p className="text-sm text-muted">FORGE does not invent a calorie target. Choose an estimate below if you want one — every estimate is approximate. Protein ({profile.proteinMinG}–{profile.proteinMaxG} g/day) is tracked regardless.</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-surface-2 p-4">
          <h3 className="flex items-center gap-2 font-semibold"><Calculator className="h-4 w-4 text-accent-ink" aria-hidden /> Formula estimate</h3>
          <p className="mt-1 text-xs text-muted">
            Mifflin–St Jeor resting energy × activity factor. Inputs: {formatWeight(weightForFormula, profile.units)} ({latest ? '7-day average of your weigh-ins' : 'profile weight'}), {profile.heightCm} cm, {profile.age} y, sex: {profile.sex === 'unspecified' ? 'not specified (range covers both equations)' : profile.sex}, activity × {formula.factor} ({ACTIVITY_FACTORS[profile.activityLevel].label.split(' — ')[0]}).
          </p>
          <p className="mt-3 text-2xl font-bold tabular">≈ {Math.round(formula.estimate).toLocaleString()} <span className="text-sm font-medium text-muted">kcal/day</span></p>
          <p className="text-xs text-muted">Plausible range {Math.round(formula.low).toLocaleString()}–{Math.round(formula.high).toLocaleString()} kcal (±10% individual variation{profile.sex === 'unspecified' ? ', widened for unspecified sex' : ''}).</p>
          <Button size="sm" className="mt-3" onClick={() => use('formula', formula.estimate)}>Use formula estimate</Button>
        </div>
        <div className="rounded-xl bg-surface-2 p-4">
          <h3 className="font-semibold">Estimate from your logs</h3>
          <p className="mt-1 text-xs text-muted">Average logged intake − (change in weight trend × 7,700 kcal/kg) ÷ days, over the last 28 days. Needs ≥10 days of food logs and ≥6 weigh-ins spanning ≥14 days.</p>
          {fromLogs.ok ? (
            <>
              <p className="mt-3 text-2xl font-bold tabular">≈ {Math.round(fromLogs.estimate).toLocaleString()} <span className="text-sm font-medium text-muted">kcal/day</span></p>
              <p className="text-xs text-muted">Avg intake {Math.round(fromLogs.avgIntake)} kcal over {fromLogs.loggedFoodDays} logged days; trend change {fromLogs.weightChangeKg >= 0 ? '+' : ''}{formatWeight(fromLogs.weightChangeKg, profile.units, 2)} over {fromLogs.days} days. Accuracy depends on complete logging.</p>
              <Button size="sm" className="mt-3" onClick={() => use('logs', fromLogs.estimate)}>Use log-based estimate</Button>
            </>
          ) : (
            <p className="mt-3 text-sm">{fromLogs.reason}</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <NumberField label="Or enter your own maintenance" unit="kcal" value={manual} onChange={setManual} className="sm:w-64" />
        <Button disabled={manual == null || manual < 1000 || manual > 6000} onClick={() => manual && use('manual', manual)}>Save manual value</Button>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        {profile.maintenance ? (
          <div className="space-y-3">
            <p className="text-sm">
              Current maintenance estimate: <strong className="tabular">{profile.maintenance.kcal.toLocaleString()} kcal</strong>{' '}
              <span className="text-muted">({profile.maintenance.method === 'formula' ? 'formula' : profile.maintenance.method === 'logs' ? 'from your logs' : 'manual'}, set {formatDate(profile.maintenance.setOn)})</span>
              <button type="button" className="ml-2 text-xs font-semibold text-muted underline" onClick={() => updateProfile({ maintenance: null, deficitEnabled: false })}>Clear</button>
            </p>
            <Toggle checked={profile.deficitEnabled} onChange={(v) => updateProfile({ deficitEnabled: v })} label="Apply a modest deficit" description="For gradual fat loss while preserving muscle: 250–400 kcal below maintenance." />
            {profile.deficitEnabled && (
              <div>
                <label htmlFor="deficit" className="text-xs font-semibold uppercase tracking-wider text-muted">Deficit: {clampDeficit(profile.deficitKcal)} kcal/day</label>
                <input id="deficit" type="range" min={250} max={400} step={25} value={clampDeficit(profile.deficitKcal)} onChange={(e) => updateProfile({ deficitKcal: Number(e.target.value) })} className="mt-2 w-full accent-[var(--accent)]" />
              </div>
            )}
            <p className={cx('rounded-xl p-3 text-sm', 'bg-accent/10')}>
              Daily calorie target: <strong className="tabular">{target?.toLocaleString()} kcal</strong> — an estimate. Review it after 2–3 weeks against your weight trend.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted">No maintenance estimate set, so no calorie target is shown. The deficit option becomes available once you choose one.</p>
        )}
      </div>
    </Card>
  );
}
