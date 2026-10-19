import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Search } from 'lucide-react';
import { EXERCISES, type ExerciseCategory } from '../data/exercises';
import { Badge, Card, EmptyState, PageHeader, cx, inputClass } from '../components/ui';
import { ExerciseImage } from '../components/ExerciseImage';

const CATS: ('All' | ExerciseCategory)[] = ['All', 'Legs', 'Push', 'Pull', 'Shoulders', 'Arms', 'Core'];

export function ExerciseLibrary() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<(typeof CATS)[number]>('All');
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return EXERCISES.filter((e) => (cat === 'All' || e.category === cat) && (!t || [e.name, e.equipment, ...e.primary, ...e.secondary].join(' ').toLowerCase().includes(t)));
  }, [q, cat]);
  return (
    <div>
      <PageHeader title="Exercise Library" icon={BookOpen} subtitle={`${EXERCISES.length} exercises with original instructional illustrations, form cues and safer alternatives.`} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search exercises</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
          <input className={cx(inputClass, 'pl-9')} placeholder="Search by name, muscle or equipment" value={q} onChange={(e) => setQ(e.target.value)} type="search" />
        </label>
        <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filter by category">
          {CATS.map((c) => (
            <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)} className={cx('shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold', cat === c ? 'border-accent bg-accent text-accent-fg' : 'border-line bg-surface text-muted hover:text-fg')}>
              {c}
            </button>
          ))}
        </div>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={Search} title="No exercises match">Try a different search or category.</EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((e) => (
            <li key={e.id}>
              <Link to={`/exercises/${e.id}`} className="group block h-full rounded-2xl focus-visible:outline-2">
                <Card className="h-full transition group-hover:border-accent/50" as="article">
                  <ExerciseImage id={e.id} />
                  <div className="mt-3 flex items-start justify-between gap-2">
                    <h2 className="font-bold">{e.name}</h2>
                    <Badge>{e.category}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted">{e.primary.join(', ')}</p>
                  <p className="mt-2 line-clamp-2 text-sm text-muted">{e.summary}</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
