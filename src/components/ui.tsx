import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { X, type LucideIcon } from 'lucide-react';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/* ---------- Layout primitives ---------- */

export function PageHeader({ title, subtitle, actions, icon: Icon }: { title: string; subtitle?: ReactNode; actions?: ReactNode; icon?: LucideIcon }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3 animate-in">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight sm:text-3xl">
          {Icon && <Icon className="h-6 w-6 text-accent-ink" aria-hidden />}
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ children, className, title, action, as: Tag = 'section', id }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; as?: 'section' | 'div' | 'article'; id?: string }) {
  return (
    <Tag id={id} className={cx('rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5 animate-in', className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </Tag>
  );
}

export function Stat({ label, value, unit, hint, tone }: { label: string; value: ReactNode; unit?: string; hint?: ReactNode; tone?: 'accent' | 'default' }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium uppercase tracking-wider text-subtle">{label}</div>
      <div className={cx('mt-1 truncate text-2xl font-bold tabular', tone === 'accent' && 'text-accent-ink')}>
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-muted">{unit}</span>}
      </div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }: { icon?: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line px-4 py-8 text-center">
      {Icon && (
        <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-surface-2">
          <Icon className="h-5 w-5 text-subtle" aria-hidden />
        </div>
      )}
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Badge({ children, tone = 'default', className }: { children: ReactNode; tone?: 'default' | 'accent' | 'warn' | 'danger' | 'ok'; className?: string }) {
  const tones = {
    default: 'bg-surface-2 text-muted border-line',
    accent: 'bg-accent/15 text-accent-ink border-accent/40',
    warn: 'bg-warn-bg text-warn border-warn/40',
    danger: 'bg-danger/10 text-danger border-danger/40',
    ok: 'bg-ok/10 text-ok border-ok/40',
  };
  return <span className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold', tones[tone], className)}>{children}</span>;
}

export function ProgressBar({ value, max, label, className }: { value: number; max: number; label: string; className?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={cx('h-2 w-full overflow-hidden rounded-full bg-surface-2', className)} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)}>
      <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ---------- Buttons ---------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'lg'; icon?: LucideIcon };

export function Button({ variant = 'secondary', size = 'md', icon: Icon, className, children, type = 'button', ...rest }: ButtonProps) {
  const variants = {
    primary: 'bg-accent text-accent-fg hover:brightness-110 font-semibold',
    secondary: 'bg-surface-2 text-fg border border-line hover:border-subtle',
    ghost: 'text-muted hover:text-fg hover:bg-surface-2',
    danger: 'bg-danger/10 text-danger border border-danger/40 hover:bg-danger/20',
  };
  const sizes = { sm: 'h-8 px-3 text-xs gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-5 text-base gap-2' };
  return (
    <button type={type} className={cx('inline-flex shrink-0 items-center justify-center rounded-xl font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45', variants[variant], sizes[size], className)} {...rest}>
      {Icon && <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden />}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, label, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string }) {
  return (
    <button type="button" aria-label={label} title={label} className={cx('inline-grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg disabled:opacity-40', className)} {...rest}>
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}

/* ---------- Form fields ---------- */

const inputCls = 'w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-fg placeholder:text-subtle focus:border-accent focus:outline-none disabled:opacity-50';

export function Field({ label, hint, children, error, htmlFor, className }: { label: string; hint?: ReactNode; children: ReactNode; error?: string | null; htmlFor?: string; className?: string }) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-xs font-semibold uppercase tracking-wider text-muted">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-subtle">{hint}</p>}
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput({ label, hint, error, className, id, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; error?: string | null }) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={fid} className={className}>
      <input id={fid} className={inputCls} aria-invalid={!!error} {...rest} />
    </Field>
  );
}

export function SelectInput({ label, hint, className, id, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: ReactNode }) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Field label={label} hint={hint} htmlFor={fid} className={className}>
      <select id={fid} className={inputCls} {...rest}>
        {children}
      </select>
    </Field>
  );
}

export function TextArea({ label, hint, className, id, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: ReactNode }) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Field label={label} hint={hint} htmlFor={fid} className={className}>
      <textarea id={fid} className={cx(inputCls, 'min-h-20')} {...rest} />
    </Field>
  );
}

export const inputClass = inputCls;

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: ReactNode }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {description && <p className="text-xs text-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative h-6 w-11 shrink-0 rounded-full border transition', checked ? 'border-accent bg-accent' : 'border-line bg-surface-2')}
      >
        <span className={cx('absolute top-0.5 h-4.5 w-4.5 rounded-full transition-all', checked ? 'left-[22px] bg-accent-fg' : 'left-0.5 bg-subtle')} />
      </button>
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-line bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx('rounded-lg px-3 py-1.5 text-xs font-semibold transition', value === o.value ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs, label }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string; icon?: LucideIcon }[]; label: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    onChange(tabs[n].value);
    refs.current[n]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1 pb-1">
      {tabs.map((t, i) => (
        <button
          key={t.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          role="tab"
          type="button"
          aria-selected={value === t.value}
          tabIndex={value === t.value ? 0 : -1}
          onKeyDown={(e) => onKey(e, i)}
          onClick={() => onChange(t.value)}
          className={cx('inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition', value === t.value ? 'bg-fg text-bg' : 'bg-surface text-muted hover:text-fg border border-line')}
        >
          {t.icon && <t.icon className="h-4 w-4" aria-hidden />}
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** 1–5 rating buttons. */
export function Rating({ value, onChange, label, low, high }: { value: number | null; onChange: (v: number | null) => void; label: string; low: string; high: string }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">{label}</legend>
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            aria-label={`${label} ${n} of 5`}
            onClick={() => onChange(value === n ? null : n)}
            className={cx('h-9 w-9 rounded-lg border text-sm font-semibold tabular transition', value === n ? 'border-accent bg-accent text-accent-fg' : 'border-line bg-surface-2 text-muted hover:text-fg')}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-subtle" style={{ maxWidth: 216 }}>
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </fieldset>
  );
}

/* ---------- Dialog ---------- */

export function Dialog({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    } else if (!open && d.open) {
      if (typeof d.close === 'function') d.close();
      else d.removeAttribute('open');
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
      className={cx('m-auto w-[calc(100%-2rem)] rounded-2xl border border-line bg-surface p-0 text-fg shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm', wide ? 'max-w-3xl' : 'max-w-lg')}
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-lg font-bold">{title}</h2>
            <IconButton icon={X} label="Close dialog" onClick={onClose} />
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  /** Require typing this word to confirm. */
  typeToConfirm?: string;
}

const ConfirmCtx = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const [typed, setTyped] = useState('');
  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => {
    setTyped('');
    setState({ ...o, resolve });
  }), []);
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  const blocked = !!state?.typeToConfirm && typed.trim() !== state.typeToConfirm;
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Dialog
        open={!!state}
        onClose={() => close(false)}
        title={state?.title ?? ''}
        footer={
          <>
            <Button onClick={() => close(false)}>Cancel</Button>
            <Button variant={state?.danger ? 'danger' : 'primary'} disabled={blocked} onClick={() => close(true)}>
              {state?.confirmLabel ?? 'Confirm'}
            </Button>
          </>
        }
      >
        <div className="text-sm text-muted">{state?.message}</div>
        {state?.typeToConfirm && (
          <TextInput className="mt-4" label={`Type "${state.typeToConfirm}" to confirm`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        )}
      </Dialog>
    </ConfirmCtx.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmCtx);

/* ---------- Toasts ---------- */

interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'error' | 'info';
}
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {toasts.map((t) => (
          <div key={t.id} role="status" className={cx('pointer-events-auto rounded-xl border px-4 py-2.5 text-sm font-medium shadow-xl animate-in', t.tone === 'error' ? 'border-danger/50 bg-surface text-danger' : 'border-line bg-fg text-bg')}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

/* ---------- Number input helper ---------- */

/** Text-based numeric input that accepts comma decimals and empty values. */
export function NumberField({ label, value, onChange, unit, step = 'any', min = 0, hint, className, placeholder, id }: { label: string; value: number | null; onChange: (v: number | null) => void; unit?: string; step?: string; min?: number; hint?: ReactNode; className?: string; placeholder?: string; id?: string }) {
  const [text, setText] = useState(value == null ? '' : String(value));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      setText(value == null ? '' : String(value));
      last.current = value;
    }
  }, [value]);
  const auto = useId();
  const fid = id ?? auto;
  const [err, setErr] = useState<string | null>(null);
  return (
    <Field label={unit ? `${label} (${unit})` : label} hint={hint} htmlFor={fid} className={className} error={err}>
      <input
        id={fid}
        inputMode="decimal"
        className={inputCls + ' tabular'}
        value={text}
        placeholder={placeholder}
        data-step={step}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          const trimmed = t.trim().replace(',', '.');
          if (trimmed === '') {
            setErr(null);
            last.current = null;
            onChange(null);
            return;
          }
          const n = Number(trimmed);
          if (!Number.isFinite(n) || n < min) {
            setErr(`Enter a number${min != null ? ` ≥ ${min}` : ''}.`);
            return;
          }
          setErr(null);
          last.current = n;
          onChange(n);
        }}
      />
    </Field>
  );
}
