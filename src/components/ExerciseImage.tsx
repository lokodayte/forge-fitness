import { useState } from 'react';
import { ImageOff, Pause, Play } from 'lucide-react';
import { animatedMediaPath, getExercise, mediaPath } from '../data/exercises';
import { cx } from './ui';

const BASE = import.meta.env.BASE_URL;

export function mediaUrl(id: string, animated = false): string {
  return `${BASE}${animated ? animatedMediaPath(id) : mediaPath(id)}`;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('reduce-motion'));
}

/** Bundled, original instructional illustration (CC0). Optionally animated. */
export function ExerciseImage({ id, size = 'card', allowAnimation = false, className }: { id: string; size?: 'thumb' | 'card' | 'large'; allowAnimation?: boolean; className?: string }) {
  const ex = getExercise(id);
  const [failed, setFailed] = useState(false);
  const [animated, setAnimated] = useState(() => allowAnimation && size === 'large' && !prefersReducedMotion());
  const alt = `Illustration of ${ex?.name ?? id}: ${ex?.direction ?? ''}`;
  return (
    <figure className={cx('relative overflow-hidden rounded-xl bg-[#121417]', size === 'thumb' ? 'w-20 shrink-0' : 'w-full', className)}>
      {failed ? (
        <div className="grid aspect-[4/3] place-items-center p-3 text-center text-xs text-[#a8afb8]">
          <div>
            <ImageOff className="mx-auto mb-1 h-5 w-5" aria-hidden />
            Illustration could not be loaded
          </div>
        </div>
      ) : (
        <img src={mediaUrl(id, animated)} alt={alt} loading={size === 'large' ? 'eager' : 'lazy'} decoding="async" width={400} height={300} className="block aspect-[4/3] h-auto w-full" onError={() => setFailed(true)} />
      )}
      {allowAnimation && !failed && (
        <button
          type="button"
          onClick={() => setAnimated((a) => !a)}
          className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-black/85"
          aria-pressed={animated}
        >
          {animated ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
          {animated ? 'Show static diagram' : 'Play animation'}
        </button>
      )}
    </figure>
  );
}
