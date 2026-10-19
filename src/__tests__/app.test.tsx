import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({ offlineReady: [false, () => {}], needRefresh: [false, () => {}], updateServiceWorker: () => {} }),
}));

describe('App', () => {
  it('seeds an empty editable profile and shows onboarding on first run — without inventing logs', async () => {
    const { App } = await import('../App');
    const { db } = await import('../db/db');
    render(<App />);
    expect(await screen.findByText('Welcome to FORGE')).toBeInTheDocument();
    const p = await db.profile.get('me');
    expect(p).toMatchObject({ age: 0, heightCm: 0, startWeightKg: 0, healthNotes: '', onboarded: false });
    expect(await db.templates.count()).toBe(3);
    expect(await db.sessions.count()).toBe(0);
    expect(await db.bodyweights.count()).toBe(0);
    expect(await db.measurements.count()).toBe(0);
  });
});
