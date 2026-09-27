import { describe, expect, it } from 'vitest';
import { createReportSnapshot, reportIgnitionState, reportRideStatus } from './report-snapshot';

describe('report state presentation', () => {
  it('keeps ignition independent from ride results and access permission', () => {
    for (const status of ['ongoing', 'passed', 'failed_brac']) {
      expect(reportIgnitionState({ id: 1, status })).toBe('Not Recorded');
    }
    expect(reportIgnitionState({ id: 1, unlock_status: 'Ignition access granted' })).toBe('Not Recorded');
    expect(reportIgnitionState({ id: 1, unlock_status: 'on' })).toBe('On');
    expect(reportIgnitionState({ id: 1, unlock_status: 'off' })).toBe('Off');
    expect(reportIgnitionState({ id: 1, is_locked: true, status: 'ongoing' })).toBe('Locked');
    expect(reportRideStatus({ id: 1, status: 'ongoing' })).toBe('Ongoing');
    expect(reportRideStatus({ id: 1, status: 'completed' })).toBe('Passed');
    expect(reportRideStatus({ id: 1, status: 'failed_face' })).toBe('Failed');
    expect(reportRideStatus({ id: 1, status: 'unknown' })).toBe('Not Recorded');
  });

  it('preserves threshold precision and separates sobriety from the ride outcome', () => {
    const snapshot = createReportSnapshot('alcohol-detection', [
      { id: 1, brac: '0.051', status: 'ongoing' },
      { id: 2, brac: '0', status: 'failed_face', unlock_status: 'locked' },
      { id: 3, brac: '' },
    ], { coverage: 'All dates', filters: 'All', alcoholThreshold: '0.05' });
    expect(snapshot.headers).toEqual(['Date & Time', 'Rider Details', 'BAC Level', 'Sobriety Status', 'Ignition State', 'Ride Status']);
    expect(snapshot.rows[0].slice(2)).toEqual(['0.051 BAC', 'Not Sober', 'Not Recorded', 'Ongoing']);
    expect(snapshot.rows[1].slice(2)).toEqual(['0.00 BAC', 'Sober', 'Locked', 'Failed']);
    expect(snapshot.rows[2][3]).toBe('Not Tested');
  });

  it('sorts both ways with missing dates last', () => {
    const records = [{ id: 1 }, { id: 2, created_at: '2026-09-02' }, { id: 3, created_at: '2026-09-01' }];
    const metadata = { coverage: 'All', filters: 'All' };
    expect(createReportSnapshot('audit-trail', records, metadata).rows.map(row => row[1])).toEqual(['ID-2', 'ID-3', 'ID-1']);
    expect(createReportSnapshot('audit-trail', records, { ...metadata, sortOrder: 'oldest' }).rows.map(row => row[1])).toEqual(['ID-3', 'ID-2', 'ID-1']);
  });
});
