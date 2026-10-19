import { useEffect, useState } from 'react';
import { today } from '../lib/dates';

/** Re-renders every `ms` milliseconds and returns Date.now(). */
export function useNow(ms = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms, enabled]);
  return now;
}

/** Today's local date, updated after midnight. */
export function useToday(): string {
  const now = useNow(60_000);
  return today(new Date(now));
}
