import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, Database, Download, FileJson, FileSpreadsheet, HardDrive, Info, Settings as SettingsIcon, ShieldCheck, Smartphone, Trash2, Upload } from 'lucide-react';
import type { ActivityLevel, Experience, Profile, Sex, ThemePref, WeightUnit } from '../db/types';
import { db, requestPersistence } from '../db/db';
import { ensureSeeded, updateProfile } from '../db/actions';
import { useProfile } from '../hooks/useData';
import { useToday } from '../hooks/useNow';
import { ACTIVITY_FACTORS } from '../lib/metrics';
import { createBackup, deleteAllData, downloadFile, importBackup, validateBackup, type ImportMode, type ValidationResult } from '../lib/backup';
import { cardioCsv, foodCsv, measurementsCsv, recoveryCsv, waterCsv, weightCsv, workoutSetsCsv } from '../lib/csv';
import { formatDate, isLocalDate } from '../lib/dates';
import { kgToUnit, round, unitToKg } from '../lib/units';
import { Badge, Button, Card, NumberField, PageHeader, Segmented, SelectInput, TextArea, TextInput, Toggle, useConfirm, useToast } from '../components/ui';
import { MedicalNotice } from '../components/MedicalNotice';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function SettingsPage() {
  const profile = useProfile();
  useEffect(() => {
    if (location.hash.includes('#medical') || location.hash.endsWith('medical')) document.getElementById('medical')?.scrollIntoView();
  }, []);
  if (!profile) return null;
  return (
    <div className="space-y-5">
      <PageHeader title="Settings" icon={SettingsIcon} subtitle="Profile, preferences, health & safety, and your data." />
      <ProfileSection profile={profile} />
      <HealthSection profile={profile} />
      <PreferencesSection profile={profile} />
      <DataSection />
      <InstallSection />
      <AboutSection />
    </div>
  );
}

function ProfileSection({ profile }: { profile: Profile }) {
  const [p, setP] = useState(profile);
  const toast = useToast();
  useEffect(() => setP(profile), [profile]);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((x) => ({ ...x, [k]: v }));
  const valid = p.age >= 10 && p.age <= 100 && p.heightCm >= 100 && p.heightCm <= 250 && p.startWeightKg >= 30 && p.startWeightKg <= 300;
  return (
    <Card title="Profile">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <TextInput label="Name" value={p.name} onChange={(e) => set('name', e.target.value)} />
        <NumberField label="Age" unit="years" value={p.age} onChange={(v) => v != null && set('age', Math.round(v))} />
        <NumberField label="Height" unit="cm" value={p.heightCm} onChange={(v) => v != null && set('heightCm', v)} />
        <NumberField label="Starting weight" unit={p.units} value={round(kgToUnit(p.startWeightKg, p.units), 0.1)} onChange={(v) => v != null && set('startWeightKg', unitToKg(v, p.units))} hint="Used for the calorie formula until you log weigh-ins." />
        <SelectInput label="Sex (calorie formula only)" value={p.sex} onChange={(e) => set('sex', e.target.value as Sex)}>
          <option value="unspecified">Prefer not to say</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </SelectInput>
        <SelectInput label="Experience" value={p.experience} onChange={(e) => set('experience', e.target.value as Experience)}>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </SelectInput>
        <NumberField label="Gym sessions per week" value={p.sessionsPerWeek} onChange={(v) => v != null && set('sessionsPerWeek', Math.round(v))} />
        <SelectInput label="Activity level" value={p.activityLevel} onChange={(e) => set('activityLevel', e.target.value as ActivityLevel)}>
          {Object.entries(ACTIVITY_FACTORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </SelectInput>
        <TextInput label="Goal" value={p.goal} onChange={(e) => set('goal', e.target.value)} />
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="primary" disabled={!valid} onClick={async () => { await updateProfile({ name: p.name, age: p.age, heightCm: p.heightCm, startWeightKg: p.startWeightKg, sex: p.sex, experience: p.experience, sessionsPerWeek: p.sessionsPerWeek, activityLevel: p.activityLevel, goal: p.goal }); toast('Profile saved'); }}>Save profile</Button>
      </div>
    </Card>
  );
}

function HealthSection({ profile }: { profile: Profile }) {
  const todayDate = useToday();
  const [date, setDate] = useState(todayDate);
  const [note, setNote] = useState('');
  const [notes, setNotes] = useState(profile.healthNotes);
  useEffect(() => setNotes(profile.healthNotes), [profile.healthNotes]);
  const confirm = useConfirm();
  const toast = useToast();
  const c = profile.medicalClearance;
  return (
    <Card title="Health & safety" id="medical">
      <MedicalNotice profile={profile} />
      <div className="mt-4 space-y-3 rounded-xl bg-surface-2 p-3">
        <Toggle
          checked={profile.healthConcerns}
          onChange={async (v) => {
            if (!v && !(await confirm({ title: 'No health concerns to check?', message: 'Only turn this off if you have no symptoms or conditions that a doctor should check before you do resistance training. The program will no longer be labelled as pending clearance.', confirmLabel: 'Turn off' }))) return;
            await updateProfile({ healthConcerns: v });
          }}
          label="I have symptoms or conditions to check before training"
          description="For example unexplained tremors, breathlessness, chest pain, dizziness or a heart condition. While on, the program is pending medical clearance."
        />
        {profile.healthConcerns && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <TextArea label="Describe them (stored only on this device)" value={notes} onChange={(e) => setNotes(e.target.value)} className="flex-1" />
            <Button disabled={notes === profile.healthNotes} onClick={async () => { await updateProfile({ healthNotes: notes.trim() }); toast('Saved'); }}>Save</Button>
          </div>
        )}
      </div>
      {profile.healthConcerns && !c.cleared && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted">After a clinician has evaluated what you reported and told you resistance training is appropriate, you can record it here. This unlocks optional load and cardio progression suggestions. FORGE cannot verify it — please only record clearance you have actually received.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label="Date of evaluation" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <TextArea label="Any restrictions or advice given (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button
            icon={ShieldCheck}
            disabled={!isLocalDate(date) || date > todayDate}
            onClick={async () => {
              const ok = await confirm({ title: 'Record medical clearance?', message: 'Confirm that a doctor or qualified clinician has evaluated you and cleared you for resistance training. Follow any restrictions they gave you.', confirmLabel: 'Yes, I was cleared' });
              if (!ok) return;
              await updateProfile({ medicalClearance: { cleared: true, date, note } });
              toast('Clearance recorded');
            }}
          >
            Record clearance
          </Button>
        </div>
      )}
      {profile.healthConcerns && c.cleared && (
        <div className="mt-4 space-y-2 text-sm">
          {c.note && <p><strong>Clinician advice noted:</strong> {c.note}</p>}
          <Button variant="ghost" onClick={async () => { if (await confirm({ title: 'Mark as not cleared?', message: 'Progression suggestions will be paused again.', confirmLabel: 'Mark not cleared' })) await updateProfile({ medicalClearance: { cleared: false, date: null, note: '' } }); }}>Mark as not cleared</Button>
        </div>
      )}
    </Card>
  );
}

function PreferencesSection({ profile }: { profile: Profile }) {
  const toast = useToast();
  const todayDate = useToday();
  const confirm = useConfirm();
  return (
    <Card title="Preferences">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Weight units</p>
            <p className="text-xs text-muted">Data is stored in kilograms; switching only changes display and input.</p>
          </div>
          <Segmented<WeightUnit> label="Weight units" value={profile.units} onChange={(v) => updateProfile({ units: v })} options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium">Theme</p>
          <Segmented<ThemePref> label="Theme" value={profile.theme} onChange={(v) => updateProfile({ theme: v })} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'System' }]} />
        </div>
        <Toggle checked={profile.reduceMotion} onChange={(v) => updateProfile({ reduceMotion: v })} label="Reduce motion" description="Disables animations and stops illustrations from auto-playing. Your system setting is also respected." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField label="Smallest load increment" unit={profile.units} value={round(kgToUnit(profile.incrementKg, profile.units), 0.01)} onChange={(v) => v != null && v > 0 && updateProfile({ incrementKg: unitToKg(v, profile.units) })} hint="Used for optional progression suggestions." />
          <NumberField label="Protein target – low" unit="g" value={profile.proteinMinG} onChange={(v) => v != null && v > 0 && v <= profile.proteinMaxG && updateProfile({ proteinMinG: v })} />
          <NumberField label="Protein target – high" unit="g" value={profile.proteinMaxG} onChange={(v) => v != null && v >= profile.proteinMinG && updateProfile({ proteinMaxG: v })} />
          <NumberField label="Water target" unit="ml" value={profile.waterTargetMl} onChange={(v) => v != null && v > 0 && updateProfile({ waterTargetMl: v })} />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <TextInput label="12-week program start date" type="date" value={profile.programStartDate} onChange={(e) => isLocalDate(e.target.value) && updateProfile({ programStartDate: e.target.value })} />
          <Button
            onClick={async () => {
              if (await confirm({ title: 'Start a new 12-week block today?', message: 'Week 1 will begin today. Your history is kept.', confirmLabel: 'Start new block' })) {
                await updateProfile({ programStartDate: todayDate });
                toast('New block started');
              }
            }}
          >
            Start new block today
          </Button>
        </div>
      </div>
    </Card>
  );
}

function DataSection() {
  const toast = useToast();
  const confirm = useConfirm();
  const lastBackup = useLiveQuery(() => db.meta.get('lastBackupAt'), []);
  const [includePhotos, setIncludePhotos] = useState(false);
  const [estimate, setEstimate] = useState<{ usage?: number; quota?: number; persisted?: boolean } | null>(null);
  const [pending, setPending] = useState<{ name: string; result: ValidationResult } | null>(null);
  const [mode, setMode] = useState<ImportMode>('merge');

  const refreshEstimate = async () => {
    try {
      const e = await navigator.storage?.estimate?.();
      const persisted = await navigator.storage?.persisted?.();
      setEstimate({ usage: e?.usage, quota: e?.quota, persisted });
    } catch {
      setEstimate({});
    }
  };
  useEffect(() => {
    void refreshEstimate();
  }, []);

  const backup = async () => {
    const data = await createBackup(db, includePhotos);
    const stamp = new Date();
    const name = `forge-backup-${stamp.getFullYear()}-${String(stamp.getMonth() + 1).padStart(2, '0')}-${String(stamp.getDate()).padStart(2, '0')}.json`;
    downloadFile(name, JSON.stringify(data, null, 2));
    await db.meta.put({ key: 'lastBackupAt', value: Date.now() });
    toast('Backup downloaded');
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 200 * 1024 * 1024) return toast('File is too large to be a FORGE backup', 'error');
    try {
      const json = JSON.parse(await file.text());
      setPending({ name: file.name, result: validateBackup(json) });
    } catch {
      setPending({ name: file.name, result: { ok: false, errors: ['The file is not valid JSON.'], backup: null, counts: {} } });
    }
  };

  const runImport = async () => {
    if (!pending?.result.backup) return;
    if (mode === 'replace') {
      const ok = await confirm({ title: 'Replace ALL current data?', message: 'Everything currently stored in FORGE on this device will be deleted and replaced by the backup. Download a backup of your current data first if you might need it.', danger: true, confirmLabel: 'Replace everything', typeToConfirm: 'REPLACE' });
      if (!ok) return;
    }
    try {
      const report = await importBackup(db, pending.result.backup, mode);
      await ensureSeeded();
      const added = Object.values(report.added).reduce((a, b) => a + (b ?? 0), 0);
      const skipped = Object.values(report.skipped).reduce((a, b) => a + (b ?? 0), 0);
      toast(`Import complete: ${added} records added${skipped ? `, ${skipped} duplicates skipped` : ''}`);
      setPending(null);
    } catch (e) {
      toast(`Import failed — nothing was changed (${e instanceof Error ? e.message : 'error'})`, 'error');
    }
  };

  const csv = async (name: string, make: () => Promise<string>) => downloadFile(`forge-${name}.csv`, await make(), 'text/csv;charset=utf-8');

  const mb = (n?: number) => (n == null ? '—' : `${(n / 1024 / 1024).toFixed(1)} MB`);
  const daysSinceBackup = lastBackup ? Math.floor((Date.now() - Number(lastBackup.value)) / 86_400_000) : null;

  return (
    <Card title="Your data" id="data">
      <div className="space-y-5">
        <div className="flex gap-3 rounded-xl bg-surface-2 p-3 text-sm">
          <HardDrive className="mt-0.5 h-5 w-5 shrink-0 text-accent-ink" aria-hidden />
          <div className="space-y-1">
            <p><strong>Stored locally only.</strong> FORGE keeps your data in this browser's IndexedDB on this device. There is no account, server, analytics or sync.</p>
            <p className="text-muted">Clearing site data, uninstalling the browser, using private browsing, or (on iOS Safari) not opening the site for several weeks can erase it. Data does not move between browsers or devices — use backups.</p>
            <p className="text-muted">
              Storage used: {mb(estimate?.usage)} of {mb(estimate?.quota)} available ·{' '}
              {estimate?.persisted ? <Badge tone="ok">Persistent storage granted</Badge> : (
                <button type="button" className="font-semibold underline" onClick={async () => { const r = await requestPersistence(); toast(r ? 'Persistent storage granted' : 'The browser did not grant persistent storage', r ? 'ok' : 'info'); void refreshEstimate(); }}>Request persistent storage</button>
              )}
            </p>
          </div>
        </div>

        <div>
          <h3 className="mb-2 flex items-center gap-2 font-semibold"><FileJson className="h-4 w-4" aria-hidden /> JSON backup</h3>
          <p className="mb-2 text-sm text-muted">
            {lastBackup ? `Last backup ${formatDate(new Date(Number(lastBackup.value)).toLocaleDateString('sv'))}${daysSinceBackup != null && daysSinceBackup >= 14 ? ` — ${daysSinceBackup} days ago, consider a new one.` : '.'}` : 'No backup made yet from this device.'}
          </p>
          <Toggle checked={includePhotos} onChange={setIncludePhotos} label="Include progress photos" description="Makes the file much larger. Keep backups containing photos somewhere private." />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" icon={Download} onClick={backup}>Download backup</Button>
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface-2 px-4 text-sm font-medium">
              <Upload className="h-4 w-4" aria-hidden /> Restore from file…
              <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          </div>
          {pending && (
            <div className="mt-3 rounded-xl border border-line p-3 text-sm" role="region" aria-label="Import preview">
              <p className="font-semibold">{pending.name}</p>
              {pending.result.ok ? (
                <>
                  <p className="mt-1 text-muted">Valid FORGE backup{pending.result.backup ? ` exported ${new Date(pending.result.backup.exportedAt).toLocaleString()}` : ''}. Contains: {Object.entries(pending.result.counts).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`).join(', ') || 'no records'}.</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Segmented<ImportMode> label="Import mode" value={mode} onChange={setMode} options={[{ value: 'merge', label: 'Merge (safe)' }, { value: 'replace', label: 'Replace all' }]} />
                    <Button variant={mode === 'replace' ? 'danger' : 'primary'} onClick={runImport}>Import</Button>
                    <Button variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
                  </div>
                  <p className="mt-2 text-xs text-subtle">Merge adds only records that don't already exist (matched by id, and by date for weigh-ins and recovery). Existing records are never overwritten.</p>
                </>
              ) : (
                <>
                  <p className="mt-1 flex items-center gap-1 text-danger"><AlertTriangle className="h-4 w-4" aria-hidden /> This file can't be imported. Nothing was changed.</p>
                  <ul className="mt-1 max-h-32 list-disc overflow-y-auto pl-5 text-xs text-muted">{pending.result.errors.map((e) => <li key={e}>{e}</li>)}</ul>
                  <Button size="sm" className="mt-2" onClick={() => setPending(null)}>Dismiss</Button>
                </>
              )}
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-2 flex items-center gap-2 font-semibold"><FileSpreadsheet className="h-4 w-4" aria-hidden /> CSV export (for spreadsheets)</h3>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => csv('workout-sets', async () => workoutSetsCsv(await db.sessions.toArray()))}>Workout sets</Button>
            <Button size="sm" onClick={() => csv('cardio', async () => cardioCsv(await db.cardio.orderBy('date').toArray()))}>Cardio</Button>
            <Button size="sm" onClick={() => csv('food', async () => foodCsv(await db.foods.orderBy('date').toArray()))}>Food</Button>
            <Button size="sm" onClick={() => csv('water', async () => waterCsv(await db.water.orderBy('date').toArray()))}>Water</Button>
            <Button size="sm" onClick={() => csv('body-weight', async () => weightCsv(await db.bodyweights.orderBy('date').toArray()))}>Body weight</Button>
            <Button size="sm" onClick={() => csv('measurements', async () => measurementsCsv(await db.measurements.orderBy('date').toArray()))}>Measurements</Button>
            <Button size="sm" onClick={() => csv('recovery', async () => recoveryCsv(await db.recovery.orderBy('date').toArray()))}>Recovery</Button>
          </div>
        </div>

        <div className="border-t border-line pt-4">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-danger"><Trash2 className="h-4 w-4" aria-hidden /> Delete all data</h3>
          <p className="mb-2 text-sm text-muted">Permanently deletes every log, photo, setting and template from this device. This cannot be undone.</p>
          <Button
            variant="danger"
            icon={Trash2}
            onClick={async () => {
              const ok = await confirm({ title: 'Delete all FORGE data?', message: 'All workouts, logs, photos and settings on this device will be erased permanently. Download a backup first if you want to keep anything.', danger: true, confirmLabel: 'Delete everything', typeToConfirm: 'DELETE' });
              if (!ok) return;
              await deleteAllData(db);
              await ensureSeeded();
              toast('All data deleted');
            }}
          >
            Delete all data
          </Button>
        </div>
      </div>
    </Card>
  );
}

function InstallSection() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches);
  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    const done = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', h);
    window.addEventListener('appinstalled', done);
    return () => {
      window.removeEventListener('beforeinstallprompt', h);
      window.removeEventListener('appinstalled', done);
    };
  }, []);
  return (
    <Card title="Install & offline">
      <div className="flex gap-3 text-sm">
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-accent-ink" aria-hidden />
        <div className="space-y-2">
          {installed ? <p><Badge tone="ok">Installed</Badge> FORGE is running as an installed app.</p> : evt ? (
            <Button variant="primary" onClick={async () => { await evt.prompt(); const r = await evt.userChoice; if (r.outcome === 'accepted') setInstalled(true); setEvt(null); }}>Install FORGE</Button>
          ) : (
            <p>To install: on Android/Chrome/Edge use the browser menu → <em>Install app</em>; on iPhone/iPad Safari use Share → <em>Add to Home Screen</em>; on desktop Chrome/Edge use the install icon in the address bar.</p>
          )}
          <p className="text-muted">After the first visit, the app, exercise illustrations and your logs work without an internet connection. Updates download automatically when you're online and you'll be asked to reload.</p>
        </div>
      </div>
    </Card>
  );
}

function AboutSection() {
  return (
    <Card title="About, formulas & credits">
      <div className="grid gap-4 text-sm md:grid-cols-2">
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 font-semibold"><Info className="h-4 w-4" aria-hidden /> How numbers are calculated</h3>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            <li><strong>Volume</strong> = load × reps for completed working sets (warm-ups and timed holds excluded).</li>
            <li><strong>Weekly frequency</strong> = completed sessions dated Monday–Sunday.</li>
            <li><strong>Completed vs planned</strong> = completed sessions ÷ scheduled workout days (from program start to today), capped at 100%.</li>
            <li><strong>Consistency</strong> = share of full weeks in which completed sessions ≥ planned workouts.</li>
            <li><strong>7-day weight average</strong> = mean of weigh-ins within the 7 calendar days ending on each date.</li>
            <li><strong>Calories</strong> = entered value × servings, or protein×4 + carbs×4 + fat×9 when left blank.</li>
            <li><strong>Maintenance (formula)</strong> = Mifflin–St Jeor × activity factor (estimate, ±10%).</li>
            <li><strong>Maintenance (logs)</strong> = average intake − weight-trend change × 7,700 kcal/kg ÷ days (estimate).</li>
            <li><strong>Progression</strong>: all prescribed sets at the top of the rep range at one load with technique confirmed → optional +1 increment.</li>
            <li>All dates use your device's local time zone; weeks start on Monday.</li>
          </ul>
        </div>
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 font-semibold"><Database className="h-4 w-4" aria-hidden /> Media credits & licences</h3>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            <li>All 25 exercise illustrations and animations are <strong>original diagrams created for FORGE</strong> and released under <strong>CC0 1.0</strong> (public domain). They are labelled as illustrations, not photographs. No third-party or stock images are used.</li>
            <li>Icons: Lucide (ISC licence).</li>
            <li>Typeface: Inter by Rasmus Andersson (SIL Open Font License 1.1), bundled locally.</li>
            <li>Charts: Recharts (MIT). Storage: Dexie.js (Apache-2.0).</li>
          </ul>
          <p className="text-xs text-subtle">FORGE provides general fitness information, not medical advice, diagnosis or treatment.</p>
        </div>
      </div>
    </Card>
  );
}
