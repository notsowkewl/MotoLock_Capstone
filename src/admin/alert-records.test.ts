import { describe, expect, it, vi } from 'vitest';
import { ALERT_RESOLVED, buildIncidents, filterIncidents, resolveIncident, deleteResolvedIncident, triggerLabel } from './alert-records';
import type { AlertStore } from './alert-records';

const users = [{ id: 'rider', name: 'Ana Cruz', email: 'ana@example.test' }];
const ride = { id: 'ride-1', user_id: 'rider', start_time: '2026-09-26T09:00:00+08:00', status: 'failed_brac', initial_brac_level: '0.05', failure_reason: 'Recorded alcohol check failure' };
const incident = () => buildIncidents([ride], users, [], '0.05')[0];

describe('incident records', () => {
  it('soft deletes only saved resolved alerts and keeps their history without reactivating them', async () => {
    const events: Record<string, unknown>[] = [];
    const store: AlertStore = {
      read: vi.fn(async table => table === 'users' ? [{ id: 'profile', email: 'admin@example.test', role: 'admin' }] : [...events]),
      getActor: vi.fn().mockResolvedValue({ id: 'auth', email: 'admin@example.test' }),
      insert: vi.fn(async event => { events.push(event); return event; }),
    };
    await expect(deleteResolvedIncident(store, incident())).rejects.toThrow('Only resolved');
    await expect(deleteResolvedIncident(store, { ...incident(), status: 'Resolved' })).rejects.toThrow('no saved resolution');
    expect(events).toHaveLength(0);
    await resolveIncident(store, incident(), 'Reviewed');
    const resolved = buildIncidents([ride], users, events, '0.05')[0];
    await deleteResolvedIncident(store, resolved);
    expect(events).toHaveLength(2);
    expect(events[0].action_type).toBe(ALERT_RESOLVED);
    expect(events[1]).toMatchObject({ user_id: 'profile', action_type: 'alert_deleted' });
    expect(buildIncidents([ride], users, events, '0.05')).toEqual([]);
    await deleteResolvedIncident(store, resolved);
    expect(events).toHaveLength(2);
  });
  it('uses the existing profile ID, with a case-insensitive email fallback for legacy admins', async () => {
    for (const profile of [
      { id: 'auth-admin', email: 'old@example.test', role: 'superadmin' },
      { id: 'legacy-admin', email: 'ADMIN@example.test', role: 'admin' },
    ]) {
      const store: AlertStore = {
        read: vi.fn(async table => table === 'users' ? [profile] : []),
        getActor: vi.fn().mockResolvedValue({ id: 'auth-admin', email: 'admin@example.test' }),
        insert: vi.fn(async event => {
          if (event.user_id !== profile.id) throw new Error('audit_logs_user_id_fkey');
          return event;
        }),
      };
      const event = await resolveIncident(store, incident(), 'Reviewed');
      expect(event.user_id).toBe(profile.id);
      expect(event.action_details).toMatchObject({ resolved_by_auth_id: 'auth-admin', resolution_note: 'Reviewed' });
    }
  });

  it('does not save an invalid or ambiguous administrator reference', async () => {
    for (const profiles of [
      [],
      [{ id: 'rider', email: 'admin@example.test', role: 'rider' }],
      [{ id: 'one', email: 'admin@example.test', role: 'admin' }, { id: 'two', email: 'admin@example.test', role: 'admin' }],
    ]) {
      const store: AlertStore = {
        read: vi.fn(async table => table === 'users' ? profiles : []),
        getActor: vi.fn().mockResolvedValue({ id: 'auth-admin', email: 'admin@example.test' }),
        insert: vi.fn(),
      };
      await expect(resolveIncident(store, incident(), '')).rejects.toThrow('administrator profile');
      expect(store.insert).not.toHaveBeenCalled();
    }
  });

  it('uses recorded failures and readings without inventing severity, action or BrAC', () => {
    const original = incident();
    expect(triggerLabel(original)).toBe('Alcohol Above Limit — 0.05 BAC');
    expect(original).toMatchObject({ severity: '', systemAction: '', brac: '0.05', status: 'Active' });
    const failedFace = buildIncidents([{ ...ride, status: 'failed_face', initial_brac_level: null }], users, [], '0.05')[0];
    expect(triggerLabel(failedFace)).toBe('Identity Verification Failed');
    expect(failedFace.brac).toBe('');
    expect(buildIncidents([{ ...ride, status: 'passed' }], users, [], '0.05')).toEqual([]);
  });

  it('sorts by timestamp instants and combines all search and filter criteria', () => {
    const rows = buildIncidents([
      { ...ride, id: 'old', start_time: '2026-09-26T09:00:00+08:00', severity: 'High' },
      { ...ride, id: 'new', start_time: '2026-09-26T02:00:00Z', severity: 'High' },
      { ...ride, id: 'unknown', start_time: '', severity: 'Low' },
    ], users, [], '0.05');
    expect(rows.map(row => row.id)).toEqual(['new', 'old', 'unknown']);
    expect(filterIncidents(rows, ' ANA ', 'Active', 'High', 'Alcohol Above Limit').map(row => row.id)).toEqual(['new', 'old']);
    expect(filterIncidents(rows, 'ana', 'Resolved', 'High', 'Alcohol Above Limit')).toEqual([]);
    expect(filterIncidents(rows, 'missing', 'all', 'all', 'all')).toEqual([]);
  });

  it('persists a separate resolution and reconstructs it after reload without modifying the ride', async () => {
    const before = { ...ride };
    const store: AlertStore = {
      read: vi.fn(async table => table === 'users' ? [{ id: 'admin-profile', email: 'admin@example.test', role: 'admin' }] : []),
      getActor: vi.fn().mockResolvedValue({ id: 'admin', email: 'admin@example.test' }),
      insert: vi.fn(async event => ({ ...event, id: 'event-1' })),
    };
    const event = await resolveIncident(store, incident(), '  Rider contacted.  ');
    expect(store.insert).toHaveBeenCalledOnce();
    expect(event).toMatchObject({ action_type: ALERT_RESOLVED, user_id: 'admin-profile', action_details: {
      ride_id: 'ride-1', status: 'Resolved', resolution_note: 'Rider contacted.', resolved_by: 'admin@example.test', resolved_by_auth_id: 'admin',
      incident: { brac: '0.05', originalStatus: 'failed_brac', details: 'Recorded alcohol check failure' },
    } });
    const restored = buildIncidents([ride], users, [event], '0.1')[0];
    expect(restored).toMatchObject({ status: 'Resolved', note: 'Rider contacted.', resolvedBy: 'admin@example.test', brac: '0.05' });
    expect(restored.resolvedAt).toBe(event.created_at);
    expect(ride).toEqual(before);
    // The recorded snapshot also survives the original ride becoming unavailable.
    expect(buildIncidents([], [], [event], '0.1')[0]).toEqual(restored);
  });

  it('preserves the first resolution and ignores unrelated legacy audit messages', async () => {
    const first = { id: 1, created_at: '2026-09-26T02:00:00Z', action_type: ALERT_RESOLVED, action_details: { ride_id: 'ride-1', status: 'Resolved', resolution_note: 'First note' } };
    const later = { ...first, id: 2, created_at: '2026-09-26T03:00:00Z', action_details: { ...first.action_details, resolution_note: 'Later note' } };
    expect(buildIncidents([ride], users, [later, first], '0.05')[0].note).toBe('First note');
    const store: AlertStore = { read: vi.fn().mockResolvedValue([first]), getActor: vi.fn().mockResolvedValue(null), insert: vi.fn() };
    expect(await resolveIncident(store, incident(), 'Replacement')).toBe(first);
    expect(store.insert).not.toHaveBeenCalled();
    expect(buildIncidents([ride], users, [{ action_type: 'Resolved safety incident for ana@example.test', action_details: '{invalid' }], '0.05')[0].status).toBe('Active');
  });

  it('propagates save failures and does not invent unavailable administrator information', async () => {
    const store: AlertStore = { read: vi.fn().mockResolvedValue([]), getActor: vi.fn().mockResolvedValue(null), insert: vi.fn().mockRejectedValue(new Error('Permission denied')) };
    await expect(resolveIncident(store, incident(), '')).rejects.toThrow('Permission denied');
    expect(store.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: null, action_details: expect.objectContaining({ resolved_by: null, resolution_note: null }) }));
  });
});
