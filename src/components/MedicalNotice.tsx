import { Link } from 'react-router-dom';
import { ShieldAlert, ShieldCheck, Info } from 'lucide-react';
import type { Profile } from '../db/types';
import { formatDate } from '../lib/dates';
import { needsClearance } from '../lib/health';
import { cx } from './ui';

/** The user's own description of their concerns, or a neutral fallback. */
export function concernsText(p: Pick<Profile, 'healthNotes'>): string {
  const t = p.healthNotes.trim();
  return t ? `“${t}”` : 'health concerns that should be checked';
}

/**
 * Clear, non-diagnostic health-safety notice. When the user reported health concerns it labels
 * the program as pending medical clearance until clearance is recorded.
 */
export function MedicalNotice({ profile, compact, className }: { profile: Profile | undefined; compact?: boolean; className?: string }) {
  if (!profile) return null;
  const { cleared, date } = profile.medicalClearance;

  if (!profile.healthConcerns) {
    if (compact) return null;
    return (
      <div className={cx('flex items-start gap-3 rounded-2xl border border-line bg-surface-2 p-4 text-sm', className)}>
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-accent-ink" aria-hidden />
        <p>
          You told FORGE you have no symptoms or conditions to check before training. If anything changes — or if you have chest pain, fainting, unusual breathlessness, dizziness or
          tremors — stop and seek medical advice. FORGE does not give medical advice.
        </p>
      </div>
    );
  }

  if (cleared) {
    if (compact) return null;
    return (
      <div className={cx('flex items-start gap-3 rounded-2xl border border-ok/40 bg-ok/10 p-4 text-sm', className)}>
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-ok" aria-hidden />
        <p>
          You recorded medical clearance{date ? ` on ${formatDate(date, { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}. FORGE does not verify this. Stop and seek
          medical advice if your symptoms return or worsen, or if chest pain, dizziness or other unusual symptoms occur.
        </p>
      </div>
    );
  }

  return (
    <aside role="note" aria-label="Health safety notice" className={cx('flex items-start gap-3 rounded-2xl border border-warn/50 bg-warn-bg p-4 text-sm', className)}>
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warn" aria-hidden />
      <div className="space-y-1.5">
        <p className="font-semibold text-warn">Program pending medical clearance</p>
        {compact ? (
          <p className="text-fg/90">
            You reported {concernsText(profile)}. Please get a medical evaluation before resistance training.{' '}
            <Link to="/settings#medical" className="font-semibold underline underline-offset-2">Details</Link>
          </p>
        ) : (
          <>
            <p className="text-fg/90">
              You reported {concernsText(profile)}. FORGE cannot assess this and does not diagnose anything. Please see a doctor for an evaluation{' '}
              <strong>before starting resistance training</strong>, and ask what activity is appropriate for you.
            </p>
            <ul className="list-disc space-y-0.5 pl-5 text-fg/90">
              <li>The workout program is a plan only — it is labelled as pending clearance.</li>
              <li>FORGE will not suggest load increases or cardio progressions until you record clearance.</li>
              <li>Planning, nutrition, body-weight, sleep and recovery tracking work normally.</li>
              <li>If you have chest pain, fainting, severe breathlessness or sudden weakness, seek urgent medical help.</li>
            </ul>
            <p className="text-fg/90">
              After an evaluation you can record clearance in <Link to="/settings#medical" className="font-semibold underline underline-offset-2">Settings → Health &amp; safety</Link>.
            </p>
          </>
        )}
      </div>
    </aside>
  );
}

export function PendingBadge({ profile }: { profile: Profile | undefined }) {
  if (!profile || !needsClearance(profile)) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-warn/50 bg-warn-bg px-2 py-0.5 text-xs font-semibold text-warn">
      <ShieldAlert className="h-3 w-3" aria-hidden /> Pending medical clearance
    </span>
  );
}
