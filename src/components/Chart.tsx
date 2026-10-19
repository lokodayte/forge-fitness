import { useEffect, useState, type ReactNode } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts';
import { BarChart3, Table2 } from 'lucide-react';
import { IconButton } from './ui';

export interface Series {
  key: string;
  label: string;
  kind: 'line' | 'bar' | 'dots';
  /** CSS custom property name, e.g. '--accent' or '--chart-1' */
  colorVar: string;
  unit?: string;
  stackId?: string;
  digits?: number;
}

export interface ChartRow {
  x: string;
  label: string;
  [k: string]: string | number | null;
}

/** Resolves CSS variables to concrete colours, refreshing on theme change. */
export function useCssVars(names: string[]): Record<string, string> {
  const read = () => {
    const cs = getComputedStyle(document.documentElement);
    return Object.fromEntries(names.map((n) => [n, cs.getPropertyValue(n).trim() || '#888']));
  };
  const [vals, setVals] = useState<Record<string, string>>(read);
  const sig = names.join(',');
  useEffect(() => {
    setVals(read());
    const obs = new MutationObserver(() => setVals(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return vals;
}

const fmt = (v: unknown, digits = 0) => (typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 }) : '—');

function TooltipBox({ active, payload, series }: TooltipContentProps<number, string> & { series: Series[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as ChartRow;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 font-semibold text-fg">{row.label}</div>
      {series.map((s) => (
        <div key={s.key} className="flex items-center justify-between gap-4 text-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: `var(${s.colorVar})` }} />
            {s.label}
          </span>
          <span className="font-semibold tabular text-fg">
            {fmt(row[s.key], s.digits)}
            {row[s.key] != null && s.unit ? ` ${s.unit}` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Single-y-axis chart with hover tooltip, legend (≥2 series) and an accessible table view.
 * Renders an empty state when there are no non-null values.
 */
export function SeriesChart({ data, series, height = 220, empty, referenceY, referenceLabel, yDomain, title }: { data: ChartRow[]; series: Series[]; height?: number; empty: ReactNode; referenceY?: number | null; referenceLabel?: string; yDomain?: [number | 'auto' | 'dataMin', number | 'auto' | 'dataMax']; title: string }) {
  const [table, setTable] = useState(false);
  const colors = useCssVars([...series.map((s) => s.colorVar), '--subtle', '--line', '--muted', '--surface']);
  const hasData = data.some((r) => series.some((s) => typeof r[s.key] === 'number' && (r[s.key] as number) !== 0));
  if (!hasData) return <>{empty}</>;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        {series.length > 1 ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legend">
            {series.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span className={s.kind === 'dots' ? 'h-2.5 w-2.5 rounded-full' : s.kind === 'line' ? 'h-0.5 w-4 rounded' : 'h-2.5 w-2.5 rounded-sm'} style={{ background: colors[s.colorVar] }} />
                {s.label}
              </li>
            ))}
          </ul>
        ) : (
          <span />
        )}
        <IconButton icon={table ? BarChart3 : Table2} label={table ? `Show ${title} chart` : `Show ${title} as table`} onClick={() => setTable((t) => !t)} />
      </div>
      {table ? (
        <div className="max-h-72 overflow-auto rounded-xl border border-line">
          <table className="w-full text-left text-xs tabular">
            <caption className="sr-only">{title}</caption>
            <thead className="sticky top-0 bg-surface-2 text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Period</th>
                {series.map((s) => (
                  <th key={s.key} className="px-3 py-2 font-semibold">
                    {s.label}
                    {s.unit ? ` (${s.unit})` : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.x} className="border-t border-line">
                  <td className="px-3 py-1.5">{r.label}</td>
                  {series.map((s) => (
                    <td key={s.key} className="px-3 py-1.5">
                      {fmt(r[s.key], s.digits)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ height }} role="img" aria-label={`${title} chart. Use the table button for exact values.`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap="22%">
              <CartesianGrid vertical={false} strokeDasharray="0" stroke={colors['--line']} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={16} tick={{ fill: colors['--subtle'], fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} width={48} domain={yDomain ?? [0, 'auto']} tick={{ fill: colors['--subtle'], fontSize: 11 }} allowDecimals />
              <Tooltip cursor={{ stroke: colors['--subtle'], strokeWidth: 1, fill: 'transparent' }} content={(p) => <TooltipBox {...(p as TooltipContentProps<number, string>)} series={series} />} />
              {referenceY != null && <ReferenceLine y={referenceY} stroke={colors['--muted']} strokeDasharray="4 4" label={{ value: referenceLabel, position: 'insideTopRight', fill: colors['--muted'], fontSize: 11 }} />}
              {series.map((s) =>
                s.kind === 'bar' ? (
                  <Bar key={s.key} dataKey={s.key} name={s.label} fill={colors[s.colorVar]} radius={s.stackId ? 0 : [4, 4, 0, 0]} stackId={s.stackId} maxBarSize={36} isAnimationActive={false} stroke={s.stackId ? colors['--surface'] : undefined} strokeWidth={s.stackId ? 1 : 0} />
                ) : s.kind === 'dots' ? (
                  <Scatter key={s.key} dataKey={s.key} name={s.label} fill={colors[s.colorVar]} isAnimationActive={false} shape={(props: { cx?: number; cy?: number }) => (props.cx == null || props.cy == null ? <g /> : <circle cx={props.cx} cy={props.cy} r={4} fill={colors[s.colorVar]} stroke={colors['--surface']} strokeWidth={2} />)} />
                ) : (
                  <Line key={s.key} dataKey={s.key} name={s.label} stroke={colors[s.colorVar]} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: colors['--surface'] }} connectNulls isAnimationActive={false} type="monotone" />
                ),
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
