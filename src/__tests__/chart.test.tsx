import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SeriesChart } from '../components/Chart';

const series = [{ key: 'v', label: 'Volume', kind: 'bar' as const, colorVar: '--accent', unit: 'kg' }];

describe('SeriesChart', () => {
  it('shows the empty state when there is no real data (no placeholder chart)', () => {
    render(<SeriesChart title="Volume" data={[{ x: 'a', label: 'A', v: null }, { x: 'b', label: 'B', v: 0 }]} series={series} empty={<p>No data available</p>} />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('renders a chart and an accessible table view of the same values', () => {
    render(<SeriesChart title="Volume" data={[{ x: 'a', label: 'Week 1', v: 1200 }, { x: 'b', label: 'Week 2', v: null }]} series={series} empty={<p>none</p>} />);
    expect(screen.getByRole('img', { name: /Volume chart/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /as table/ }));
    const table = screen.getByRole('table');
    expect(table).toHaveTextContent('Week 1');
    expect(table).toHaveTextContent('1,200');
    expect(table).toHaveTextContent('—');
  });

  it('shows a legend only for multiple series', () => {
    const two = [...series, { key: 'w', label: 'Sets', kind: 'line' as const, colorVar: '--chart-1' }];
    render(<SeriesChart title="Mixed" data={[{ x: 'a', label: 'A', v: 1, w: 2 }]} series={two} empty={null} />);
    expect(screen.getByRole('list', { name: 'Legend' })).toHaveTextContent('Sets');
  });
});
