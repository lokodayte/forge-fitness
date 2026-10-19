import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Activity, BookOpen, CalendarDays, Dumbbell, History, LayoutDashboard, Menu, Salad, Scale, Settings, Target, Timer, X, type LucideIcon } from 'lucide-react';
import { cx } from './ui';
import { useActiveSession } from '../hooks/useData';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/workout', label: 'Workout', icon: Dumbbell },
  { to: '/exercises', label: 'Exercise Library', icon: BookOpen },
  { to: '/core', label: 'Abs & Core', icon: Target },
  { to: '/cardio', label: 'Cardio', icon: Activity },
  { to: '/nutrition', label: 'Nutrition', icon: Salad },
  { to: '/body', label: 'Body Progress', icon: Scale },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/history', label: 'History', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const MOBILE_PRIMARY = ['/', '/workout', '/nutrition', '/body'];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <rect width="32" height="32" rx="9" fill="var(--accent)" />
        <path d="M10 8h13v4h-8.5v3.5H21v4h-6.5V24H10z" fill="var(--accent-fg)" />
      </svg>
      <span className="text-lg font-black tracking-[0.18em]">FORGE</span>
    </div>
  );
}

function SideLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cx('group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition', isActive ? 'bg-accent/15 text-accent-ink' : 'text-muted hover:bg-surface-2 hover:text-fg')
      }
    >
      <item.icon className="h-[18px] w-[18px]" aria-hidden />
      {item.label}
    </NavLink>
  );
}

function ActiveSessionPill() {
  const active = useActiveSession();
  const { pathname } = useLocation();
  if (!active || pathname === '/workout') return null;
  return (
    <NavLink to="/workout" className="fixed right-4 top-4 z-40 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-fg shadow-lg pulse-ring lg:right-6 lg:top-5">
      <Timer className="h-4 w-4" aria-hidden />
      {active.status === 'paused' ? 'Workout paused' : 'Workout in progress'}
    </NavLink>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setMoreOpen(false);
    window.scrollTo({ top: 0 });
    // Move focus to main content on route change for screen-reader & keyboard users.
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  const moreItems = NAV.filter((n) => !MOBILE_PRIMARY.includes(n.to));
  const moreActive = moreItems.some((n) => (n.to === '/' ? pathname === '/' : pathname.startsWith(n.to)));

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only z-50 rounded-lg bg-accent px-4 py-2 font-semibold text-accent-fg focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface/80 px-4 py-6 backdrop-blur lg:flex" aria-label="Primary">
        <div className="mb-8 px-2">
          <Logo />
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto" aria-label="Main navigation">
          {NAV.map((n) => (
            <SideLink key={n.to} item={n} />
          ))}
        </nav>
        <p className="mt-4 px-2 text-[11px] leading-relaxed text-subtle">Your data stays on this device. No account, no tracking.</p>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-bg/85 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
      </div>

      <ActiveSessionPill />

      <div className="lg:pl-64">
        <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto max-w-6xl px-4 pb-28 pt-5 outline-none sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:hidden" aria-label="Main navigation">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.filter((n) => MOBILE_PRIMARY.includes(n.to)).map((n) => (
            <li key={n.to}>
              <NavLink
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) => cx('flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition', isActive ? 'text-accent-ink' : 'text-subtle hover:text-fg')}
              >
                <n.icon className="h-5 w-5" aria-hidden />
                {n.label === 'Body Progress' ? 'Body' : n.label}
              </NavLink>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={cx('flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-semibold', moreActive ? 'text-accent-ink' : 'text-subtle')}
            >
              <Menu className="h-5 w-5" aria-hidden />
              More
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="More pages" onKeyDown={(e) => e.key === 'Escape' && setMoreOpen(false)}>
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMoreOpen(false)} />
          <div className="safe-bottom absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-line bg-surface p-4 pb-6 animate-in">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold uppercase tracking-wider text-muted">More</span>
              <button type="button" autoFocus onClick={() => setMoreOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2" aria-label="Close menu">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <ul className="grid grid-cols-3 gap-2">
              {moreItems.map((n) => (
                <li key={n.to}>
                  <NavLink to={n.to} className={({ isActive }) => cx('flex flex-col items-center gap-2 rounded-2xl border p-3 text-center text-xs font-semibold', isActive ? 'border-accent/50 bg-accent/10 text-accent-ink' : 'border-line bg-surface-2 text-fg')}>
                    <n.icon className="h-5 w-5" aria-hidden />
                    {n.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
