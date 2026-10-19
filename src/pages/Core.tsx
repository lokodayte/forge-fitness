import { Link } from 'react-router-dom';
import { AlertTriangle, Flame, Target, TrendingUp, Wind } from 'lucide-react';
import type { CoreOption, TemplateKey } from '../db/types';
import { updateProfile } from '../db/actions';
import { useProfile, useTemplates } from '../hooks/useData';
import { CORE_EXERCISE_IDS, getExercise } from '../data/exercises';
import { applyCoreOption } from '../data/program';
import { Badge, Card, PageHeader, Segmented, SelectInput, useToast } from '../components/ui';
import { ExerciseImage } from '../components/ExerciseImage';
import { MedicalNotice, PendingBadge } from '../components/MedicalNotice';
import { prescriptionLabel } from './Workout';
import { needsClearance } from '../lib/health';

const ANATOMY = [
  { name: 'Rectus abdominis', text: 'The long "six-pack" muscle running from the ribs to the pubic bone. It flexes the spine (curling ribs toward pelvis) and resists the lower back over-arching.' },
  { name: 'External & internal obliques', text: 'Diagonal layers on the sides of the trunk. They rotate and side-bend the spine and — just as importantly — resist rotation and side-bending (Pallof press, side plank).' },
  { name: 'Transverse abdominis', text: 'The deepest layer, wrapping around the trunk like a belt. It helps create stiffness and pressure when you brace.' },
  { name: 'Supporting muscles', text: 'Hip flexors, glutes, spinal erectors and the diaphragm all contribute to trunk control. Core training works with them, not in isolation.' },
];

const DAY_LABEL: Record<TemplateKey, string> = { A: 'Monday · Workout A', B: 'Wednesday · Workout B', C: 'Friday · Workout C' };

export function CorePage() {
  const profile = useProfile();
  const templates = useTemplates();
  const toast = useToast();
  if (!profile) return null;

  const setOption = async (v: CoreOption) => {
    await updateProfile({ coreOption: v });
    toast(v === 'revised' ? 'Revised core programming selected' : 'Original core programming selected');
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Abs & Core" icon={Target} subtitle={<span className="flex flex-wrap items-center gap-2">Anatomy, technique and programming for a strong, stable trunk. <PendingBadge profile={profile} /></span>} />
      <MedicalNotice profile={profile} compact />

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card title="Your core programming">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented<CoreOption> label="Core program" value={profile.coreOption} onChange={setOption} options={[{ value: 'original', label: 'Original' }, { value: 'revised', label: 'Revised' }]} />
            {profile.coreOption === 'revised' && needsClearance(profile) && <Badge tone="warn">Intended for after medical clearance</Badge>}
          </div>
          <p className="mt-3 text-sm text-muted">
            {profile.coreOption === 'original'
              ? 'Abdominal crunch machine, 2 × 12–15, at the end of Workouts A and C.'
              : 'Monday: cable crunch replaces the crunch machine (2 × 10–15). Wednesday: dead bug (2 × 8–12 per side). Friday: reverse crunch replaces the crunch machine (2 × 8–12).'}{' '}
            Duplicate exercises are never stacked — if a workout already contains an exercise, it is not added again.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {(['A', 'B', 'C'] as TemplateKey[]).map((k) => {
              const t = templates.find((x) => x.id === k);
              const core = t ? applyCoreOption(k, t.exercises, profile.coreOption, profile.sidePlankOn).filter((e) => CORE_EXERCISE_IDS.includes(e.exerciseId)) : [];
              return (
                <div key={k} className="rounded-xl bg-surface-2 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-subtle">{DAY_LABEL[k]}</p>
                  {core.length === 0 ? (
                    <p className="mt-1 text-sm text-muted">No core exercise</p>
                  ) : (
                    <ul className="mt-1 space-y-1 text-sm">
                      {core.map((e) => (
                        <li key={e.uid}>
                          <span className="font-semibold">{getExercise(e.exerciseId)?.name}</span>
                          <span className="block text-xs text-muted">{prescriptionLabel(e)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
          <SelectInput
            className="mt-4"
            label="Optional side plank (2 × 20–40 s per side)"
            value={profile.sidePlankOn ?? ''}
            onChange={async (e) => {
              await updateProfile({ sidePlankOn: (e.target.value || null) as TemplateKey | null });
              toast('Side plank setting saved');
            }}
            hint="Add it to one workout, depending on how well you're recovering."
          >
            <option value="">Not included</option>
            <option value="A">Add to Workout A</option>
            <option value="B">Add to Workout B</option>
            <option value="C">Add to Workout C</option>
          </SelectInput>
        </Card>

        <Card title="Visible abs & body fat">
          <div className="flex gap-3 text-sm">
            <Flame className="mt-0.5 h-5 w-5 shrink-0 text-accent-ink" aria-hidden />
            <div className="space-y-2">
              <p>How visible your abdominal muscles are depends mostly on your overall body-fat level — and on genetics and where your body tends to store fat.</p>
              <p>
                <strong>Ab exercises cannot selectively burn belly fat.</strong> "Spot reduction" does not work; fat is lost across the whole body through a sustained, modest energy deficit over time.
              </p>
              <p>Core training still matters: it builds the muscle underneath and improves trunk control for everything else you do.</p>
            </div>
          </div>
        </Card>
      </div>

      <section aria-labelledby="core-ex">
        <h2 id="core-ex" className="mb-3 text-lg font-bold">Core exercise demonstrations</h2>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {CORE_EXERCISE_IDS.map((id) => {
            const e = getExercise(id)!;
            return (
              <li key={id}>
                <Link to={`/exercises/${id}`} className="group block h-full">
                  <Card className="h-full transition group-hover:border-accent/50" as="article">
                    <ExerciseImage id={id} />
                    <h3 className="mt-3 font-bold">{e.name}</h3>
                    <p className="text-xs text-muted">{e.primary.join(', ')}</p>
                    <p className="mt-1 text-sm text-muted">{e.summary}</p>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Anatomy">
          <dl className="space-y-3 text-sm">
            {ANATOMY.map((a) => (
              <div key={a.name}>
                <dt className="font-semibold">{a.name}</dt>
                <dd className="text-muted">{a.text}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card title="Breathing & bracing">
          <div className="space-y-2 text-sm">
            <p className="flex gap-2"><Wind className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" aria-hidden />Brace lightly — as if preparing for a gentle poke in the stomach — without sucking in or holding your breath.</p>
            <p>On flexion exercises (crunches), <strong>exhale as you curl</strong>; it helps the ribs move down toward the pelvis. Inhale on the return.</p>
            <p>On holds (planks), breathe slowly and continuously. If you can't breathe normally, the variation is too hard right now.</p>
            <p>Avoid long breath-holds, and stop if breathing becomes difficult or you feel dizzy.</p>
          </div>
        </Card>
        <Card title="Movement technique">
          <ul className="list-disc space-y-1.5 pl-5 text-sm">
            <li>Flexion (cable crunch, reverse crunch, crunch machine): move the ribcage and pelvis toward each other by rounding the spine — not by hinging at the hips or pulling with the arms.</li>
            <li>Anti-extension (dead bug, plank): keep the lower back from arching while limbs move or the body is held.</li>
            <li>Anti-rotation and anti-lateral-flexion (Pallof press, side plank): stay square and straight while a force tries to twist or bend you.</li>
            <li>Slow, controlled reps beat fast, high-rep sets.</li>
          </ul>
        </Card>
        <Card title="Progression">
          <ul className="space-y-1.5 text-sm">
            {[
              'Reps first: reach the top of the range on all sets with good form.',
              'Then add a little load (cable/machine) or a harder lever (straighter legs on dead bug, feet stacked on side plank).',
              'For holds, add 5–10 seconds at a time, up to the top of the range, then progress the variation.',
              'Core work is low-risk to keep at 1–3 reps in reserve — no need to grind.',
            ].map((t) => (
              <li key={t} className="flex gap-2"><TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" aria-hidden />{t}</li>
            ))}
          </ul>
        </Card>
        <Card title="Common mistakes" className="md:col-span-2">
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {[
              'Pulling on the neck or rope with the arms instead of curling the trunk.',
              'Swinging the legs for momentum on reverse crunches.',
              'Letting the lower back arch off the floor during dead bugs.',
              'Hips sagging or piking in planks and side planks.',
              'Holding the breath throughout a set.',
              'Doing very high volumes expecting to lose belly fat — it will not target fat in that area.',
            ].map((t) => (
              <li key={t} className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden />{t}</li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
