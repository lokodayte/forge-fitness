import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Lock, ShieldAlert } from 'lucide-react';
import type { ActivityLevel, CoreOption, Experience, Profile, Sex, ThemePref, WeightUnit } from '../db/types';
import { updateProfile } from '../db/actions';
import { db } from '../db/db';
import { Button, Card, NumberField, Segmented, SelectInput, TextArea, TextInput, Toggle, cx } from '../components/ui';
import { suggestedProtein } from '../lib/health';
import { MedicalNotice } from '../components/MedicalNotice';
import { ACTIVITY_FACTORS } from '../lib/metrics';
import { isLocalDate, today } from '../lib/dates';
import { kgToUnit, round, unitToKg } from '../lib/units';
import { uid } from '../lib/id';

const STEPS = ['Welcome', 'Profile', 'Preferences', 'Health & safety'];

export function Onboarding({ profile }: { profile: Profile }) {
  const [step, setStep] = useState(0);
  const [p, setP] = useState<Profile>(profile);
  const [logWeight, setLogWeight] = useState(false);
  const [ack, setAck] = useState(false);
  const [concern, setConcern] = useState<boolean | null>(null);
  const [notes, setNotes] = useState(profile.healthNotes);
  const [proteinTouched, setProteinTouched] = useState(false);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((x) => ({ ...x, [k]: v }));

  const profileValid = p.age >= 10 && p.age <= 100 && p.heightCm >= 100 && p.heightCm <= 250 && p.startWeightKg >= 30 && p.startWeightKg <= 300;
  const prefsValid = isLocalDate(p.programStartDate) && p.proteinMinG > 0 && p.proteinMaxG >= p.proteinMinG;

  const finish = async () => {
    await updateProfile({ ...p, healthConcerns: concern ?? true, healthNotes: concern ? notes.trim() : '', medicalNoticeAcknowledged: true, onboarded: true });
    if (logWeight) {
      const d = today();
      const existing = await db.bodyweights.where('date').equals(d).first();
      if (!existing) await db.bodyweights.add({ id: uid(), date: d, weightKg: p.startWeightKg, note: 'Entered during setup', createdAt: Date.now() });
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 py-8 sm:py-12">
      <div className="mb-8 flex items-center gap-3">
        <svg viewBox="0 0 32 32" className="h-9 w-9" aria-hidden>
          <rect width="32" height="32" rx="9" fill="var(--accent)" />
          <path d="M10 8h13v4h-8.5v3.5H21v4h-6.5V24H10z" fill="var(--accent-fg)" />
        </svg>
        <span className="text-xl font-black tracking-[0.18em]">FORGE</span>
      </div>

      <ol className="mb-6 flex gap-2" aria-label="Setup progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <div className={cx('h-1.5 rounded-full', i <= step ? 'bg-accent' : 'bg-surface-2')} />
            <span className={cx('mt-1.5 hidden text-xs sm:block', i === step ? 'font-semibold text-fg' : 'text-subtle')} aria-current={i === step ? 'step' : undefined}>
              {s}
            </span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Card>
          <h1 className="text-3xl font-bold tracking-tight">Welcome to FORGE</h1>
          <p className="mt-3 text-muted">A private training, cardio, nutrition, body-progress and recovery tracker. A 3-day machine-based program is pre-loaded, and you can edit everything. Your details are entered next and stay on this device.</p>
          <ul className="mt-5 space-y-3 text-sm">
            {[
              'Everything is stored only in this browser on this device (IndexedDB). No account, no tracking, no servers.',
              'Nothing is invented: charts and statistics only use what you log. Empty sections say so.',
              'Works offline after the first load and can be installed to your home screen.',
              'Export a JSON backup regularly — clearing browser data deletes your logs.',
            ].map((t) => (
              <li key={t} className="flex gap-3">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" aria-hidden />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {step === 1 && (
        <Card title="Your profile">
          <p className="mb-4 text-sm text-muted">These details stay on this device — FORGE never uploads them. They are used for the optional calorie estimate and protein suggestion.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Name (optional)" value={p.name} onChange={(e) => set('name', e.target.value)} autoComplete="given-name" />
            <NumberField label="Age" unit="years" value={p.age || null} onChange={(v) => v != null && set('age', Math.round(v))} />
            <NumberField label="Height" unit="cm" value={p.heightCm || null} onChange={(v) => v != null && set('heightCm', v)} />
            <NumberField label="Current weight" unit={p.units} value={p.startWeightKg ? round(kgToUnit(p.startWeightKg, p.units), 0.1) : null} onChange={(v) => v != null && set('startWeightKg', unitToKg(v, p.units))} />
            <SelectInput label="Sex (for the calorie formula only)" value={p.sex} onChange={(e) => set('sex', e.target.value as Sex)} hint="“Prefer not to say” shows a wider estimate range.">
              <option value="unspecified">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </SelectInput>
            <SelectInput label="Training experience" value={p.experience} onChange={(e) => set('experience', e.target.value as Experience)}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </SelectInput>
            <NumberField label="Gym sessions per week" value={p.sessionsPerWeek} onChange={(v) => v != null && set('sessionsPerWeek', Math.round(v))} />
            <TextInput label="Goal" value={p.goal} onChange={(e) => set('goal', e.target.value)} className="sm:col-span-2" />
          </div>
          <div className="mt-4 rounded-xl bg-surface-2 p-3">
            <Toggle checked={logWeight} onChange={setLogWeight} label="Also save this as today's weigh-in" description="Off by default — FORGE never creates measurements you did not explicitly record." />
          </div>
          {!profileValid && <p className="mt-3 text-sm text-danger">Please check age (10–100), height (100–250 cm) and weight (30–300 kg).</p>}
        </Card>
      )}

      {step === 2 && (
        <Card title="Preferences">
          <div className="grid gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-medium">Weight units</span>
              <Segmented<WeightUnit> label="Weight units" value={p.units} onChange={(v) => set('units', v)} options={[{ value: 'kg', label: 'Kilograms' }, { value: 'lb', label: 'Pounds' }]} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-medium">Appearance</span>
              <Segmented<ThemePref> label="Theme" value={p.theme} onChange={(v) => set('theme', v)} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'System' }]} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="Program start date (week 1)" type="date" value={p.programStartDate} onChange={(e) => set('programStartDate', e.target.value)} hint="Sets the current week of the 12-week block." />
              <SelectInput label="Daily activity level" value={p.activityLevel} onChange={(e) => set('activityLevel', e.target.value as ActivityLevel)} hint="Used only for the optional maintenance-calorie estimate.">
                {Object.entries(ACTIVITY_FACTORS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </SelectInput>
              <NumberField label="Protein target – low" unit="g/day" value={p.proteinMinG} onChange={(v) => { if (v != null) { setProteinTouched(true); set('proteinMinG', v); } }} hint="Suggested from your weight: 1.6–2.0 g per kg." />
              <NumberField label="Protein target – high" unit="g/day" value={p.proteinMaxG} onChange={(v) => { if (v != null) { setProteinTouched(true); set('proteinMaxG', v); } }} />
              <NumberField label="Water target" unit="ml/day" value={p.waterTargetMl} onChange={(v) => v != null && set('waterTargetMl', v)} />
              <SelectInput label="Core programming" value={p.coreOption} onChange={(e) => set('coreOption', e.target.value as CoreOption)} hint="Revised option is intended for after medical clearance. Change any time in Abs & Core.">
                <option value="original">Original (crunch machine in A and C)</option>
                <option value="revised">Revised (cable crunch / dead bug / reverse crunch)</option>
              </SelectInput>
            </div>
            <Toggle checked={p.reduceMotion} onChange={(v) => set('reduceMotion', v)} label="Reduce motion" description="Turns off animations even if your system setting allows them." />
          </div>
          {!prefsValid && <p className="mt-3 text-sm text-danger">Check the start date and that the protein high target is at least the low target.</p>}
        </Card>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Card title="Health & safety">
            <p className="text-sm">Do you have any symptoms or conditions that a doctor should check before you start resistance training?</p>
            <p className="mt-1 text-xs text-muted">For example unexplained tremors, breathlessness, chest pain, fainting, dizziness, or a heart or lung condition.</p>
            <div className="mt-3">
              <Segmented<'yes' | 'no' | ''>
                label="Health concerns"
                value={concern === null ? '' : concern ? 'yes' : 'no'}
                onChange={(v) => {
                  setConcern(v === 'yes');
                  setAck(false);
                }}
                options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
              />
            </div>
            {concern && (
              <TextArea className="mt-4" label="Describe them (stored only on this device)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What have you noticed, and since when?" />
            )}
          </Card>
          {concern !== null && <MedicalNotice profile={{ ...p, healthConcerns: concern, healthNotes: notes, medicalClearance: { cleared: false, date: null, note: '' } }} />}
          {concern !== null && (
            <Card>
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[var(--accent)]" />
                {concern ? (
                  <span>
                    I understand that FORGE is not medical advice, that the training program is <strong>pending medical clearance</strong>, and that I should get what I reported evaluated
                    before resistance training.
                  </span>
                ) : (
                  <span>I understand that FORGE is not medical advice, and that I should stop and seek medical advice if symptoms appear.</span>
                )}
              </label>
            </Card>
          )}
          {concern && (
            <p className="flex items-center gap-2 text-xs text-subtle">
              <ShieldAlert className="h-4 w-4" aria-hidden /> You can record clearance later in Settings once a clinician has evaluated you.
            </p>
          )}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <Button icon={ArrowLeft} variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            variant="primary"
            onClick={() => {
              if (step === 1 && !proteinTouched) {
                const sp = suggestedProtein(p.startWeightKg);
                setP((x) => ({ ...x, proteinMinG: sp.min, proteinMaxG: sp.max }));
              }
              setStep((s) => s + 1);
            }}
            disabled={(step === 1 && !profileValid) || (step === 2 && !prefsValid)}>
            Continue <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        ) : (
          <Button variant="primary" icon={Check} onClick={finish} disabled={!ack || concern === null}>
            Finish setup
          </Button>
        )}
      </div>
    </div>
  );
}
