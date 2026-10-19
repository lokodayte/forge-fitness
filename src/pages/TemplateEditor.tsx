import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUp, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import type { TemplateExercise, WorkoutTemplate } from '../db/types';
import { db } from '../db/db';
import { resetTemplates, saveTemplate } from '../db/actions';
import { useTemplates } from '../hooks/useData';
import { EXERCISES, getExercise } from '../data/exercises';
import { uid } from '../lib/id';
import { Button, Card, IconButton, NumberField, PageHeader, SelectInput, Tabs, TextInput, useConfirm, useToast } from '../components/ui';
import { prescriptionLabel } from './Workout';

export function validateTemplate(t: WorkoutTemplate): string | null {
  if (!t.name.trim()) return 'Give the workout a name.';
  for (const e of t.exercises) {
    const n = getExercise(e.exerciseId)?.name ?? e.exerciseId;
    if (!Number.isInteger(e.sets) || e.sets < 1 || e.sets > 10) return `${n}: sets must be 1–10.`;
    if (e.repMin < 1 || e.repMax < e.repMin) return `${n}: the rep/time range is invalid.`;
    if (e.restMinSec < 0 || e.restMaxSec < e.restMinSec) return `${n}: the rest range is invalid.`;
  }
  return null;
}

export function TemplateEditor() {
  const templates = useTemplates();
  const [selected, setSelected] = useState('A');
  const [draft, setDraft] = useState<WorkoutTemplate | null>(null);
  const [dirty, setDirty] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    const t = templates.find((x) => x.id === selected) ?? templates[0];
    if (t && (!draft || draft.id !== t.id || !dirty)) {
      setDraft(structuredClone(t));
      setSelected(t.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, selected]);

  const change = (fn: (t: WorkoutTemplate) => WorkoutTemplate) => {
    setDraft((d) => (d ? fn(d) : d));
    setDirty(true);
  };
  const changeEx = (u: string, patch: Partial<TemplateExercise>) => change((t) => ({ ...t, exercises: t.exercises.map((e) => (e.uid === u ? { ...e, ...patch } : e)) }));

  const switchTo = async (id: string) => {
    if (dirty && !(await confirm({ title: 'Discard unsaved changes?', message: 'You have edits that are not saved yet.', confirmLabel: 'Discard', danger: true }))) return;
    setDirty(false);
    setSelected(id);
    setDraft(structuredClone(templates.find((t) => t.id === id)!));
  };

  const save = async () => {
    if (!draft) return;
    const err = validateTemplate(draft);
    if (err) return toast(err, 'error');
    await saveTemplate(draft);
    setDirty(false);
    toast('Workout saved. Past sessions are unchanged.');
  };

  if (!draft) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="space-y-4">
      <Link to="/workout" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to tracker
      </Link>
      <PageHeader
        title="Edit workouts"
        subtitle="Change exercises, sets, rep ranges and rest. Your history keeps a snapshot of each session, so editing never alters past records."
        actions={
          <>
            <Button
              icon={Plus}
              onClick={async () => {
                const t: WorkoutTemplate = { id: uid(), name: `Workout ${templates.length + 1}`, exercises: [], updatedAt: Date.now() };
                await saveTemplate(t);
                setDirty(false);
                setSelected(t.id);
                setDraft(t);
              }}
            >
              New workout
            </Button>
            <Button
              icon={RotateCcw}
              onClick={async () => {
                if (await confirm({ title: 'Reset all workouts to defaults?', message: 'Workouts A, B and C return to the original program and custom workouts are removed. History is not affected.', danger: true, confirmLabel: 'Reset' })) {
                  await resetTemplates();
                  setDirty(false);
                  setSelected('A');
                  toast('Workouts reset');
                }
              }}
            >
              Reset defaults
            </Button>
          </>
        }
      />

      <Tabs label="Workouts" value={selected} onChange={switchTo} tabs={templates.map((t) => ({ value: t.id, label: t.name }))} />

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <TextInput label="Workout name" value={draft.name} onChange={(e) => change((t) => ({ ...t, name: e.target.value }))} className="flex-1" />
          {!['A', 'B', 'C'].includes(draft.id) && (
            <Button
              variant="danger"
              icon={Trash2}
              onClick={async () => {
                if (await confirm({ title: `Delete ${draft.name}?`, message: 'Past sessions using it remain in history. Calendar days scheduled with it become unassigned workouts.', danger: true, confirmLabel: 'Delete' })) {
                  await db.templates.delete(draft.id);
                  setDirty(false);
                  setSelected('A');
                }
              }}
            >
              Delete workout
            </Button>
          )}
        </div>
      </Card>

      {draft.exercises.map((e, i) => {
        const info = getExercise(e.exerciseId);
        return (
          <Card key={e.uid}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                <span className="mr-1 text-subtle">{i + 1}.</span> {info?.name ?? e.exerciseId}
                <span className="ml-2 text-xs font-normal text-muted">{prescriptionLabel(e)}</span>
              </p>
              <div className="flex">
                <IconButton icon={ArrowUp} label="Move up" disabled={i === 0} onClick={() => change((t) => { const l = [...t.exercises]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; return { ...t, exercises: l }; })} />
                <IconButton icon={ArrowDown} label="Move down" disabled={i === draft.exercises.length - 1} onClick={() => change((t) => { const l = [...t.exercises]; [l[i + 1], l[i]] = [l[i], l[i + 1]]; return { ...t, exercises: l }; })} />
                <IconButton icon={Trash2} label={`Remove ${info?.name ?? 'exercise'}`} onClick={() => change((t) => ({ ...t, exercises: t.exercises.filter((x) => x.uid !== e.uid) }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              <SelectInput label="Exercise" value={e.exerciseId} className="col-span-2" onChange={(ev) => { const inf = getExercise(ev.target.value); changeEx(e.uid, { exerciseId: ev.target.value, measure: inf?.measure ?? 'reps', perSide: inf?.perSide }); }}>
                {EXERCISES.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </SelectInput>
              <NumberField label="Sets" value={e.sets} onChange={(v) => v != null && changeEx(e.uid, { sets: Math.round(v) })} />
              <NumberField label={e.measure === 'time' ? 'Min sec' : 'Min reps'} value={e.repMin} onChange={(v) => v != null && changeEx(e.uid, { repMin: Math.round(v) })} />
              <NumberField label={e.measure === 'time' ? 'Max sec' : 'Max reps'} value={e.repMax} onChange={(v) => v != null && changeEx(e.uid, { repMax: Math.round(v) })} />
              <NumberField label="Rest min" unit="s" value={e.restMinSec} onChange={(v) => v != null && changeEx(e.uid, { restMinSec: Math.round(v) })} />
              <NumberField label="Rest max" unit="s" value={e.restMaxSec} onChange={(v) => v != null && changeEx(e.uid, { restMaxSec: Math.round(v) })} />
              <SelectInput label="Measured in" value={e.measure} onChange={(ev) => changeEx(e.uid, { measure: ev.target.value as 'reps' | 'time' })}>
                <option value="reps">Reps</option>
                <option value="time">Seconds (hold)</option>
              </SelectInput>
              <SelectInput label="Per side?" value={e.perSide ? 'yes' : 'no'} onChange={(ev) => changeEx(e.uid, { perSide: ev.target.value === 'yes' })}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </SelectInput>
            </div>
          </Card>
        );
      })}

      <div className="flex flex-wrap justify-between gap-2">
        <Button
          icon={Plus}
          onClick={() => change((t) => ({ ...t, exercises: [...t.exercises, { uid: uid(), exerciseId: 'leg-press', sets: 3, repMin: 8, repMax: 12, measure: 'reps', restMinSec: 90, restMaxSec: 120 }] }))}
        >
          Add exercise
        </Button>
        <Button variant="primary" icon={Save} onClick={save} disabled={!dirty}>
          {dirty ? 'Save changes' : 'Saved'}
        </Button>
      </div>
    </div>
  );
}
