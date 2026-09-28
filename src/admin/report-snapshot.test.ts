import { describe, expect, it } from 'vitest';
import { createReportSnapshot, reportRideStatus } from './report-snapshot';

describe('report state presentation', () => {
  it('maps recorded ride outcomes without adding session or ignition columns to reports', () => {
    expect(reportRideStatus({ id: 1, status: 'ongoing' })).toBe('Ongoing');
    expect(reportRideStatus({ id: 1, status: 'completed' })).toBe('Passed');
    expect(reportRideStatus({ id: 1, status: 'failed_face' })).toBe('Failed');
    expect(reportRideStatus({ id: 1, status: 'unknown' })).toBe('Not Recorded');
  });

  it('preserves threshold precision and omits session and ignition values from report rows', () => {
    const snapshot = createReportSnapshot('alcohol-detection', [
      { id: 1, brac: '0.051', status: 'ongoing' },
      { id: 2, brac: '0', status: 'failed_face', unlock_status: 'locked' },
      { id: 3, brac: '' },
    ], { coverage: 'All dates', filters: 'All', alcoholThreshold: '0.05' });
    expect(snapshot.headers).toEqual(['Date & Time', 'Rider Details', 'BAC Level', 'Sobriety Status', 'Failure Reason']);
    expect(snapshot.rows[0].slice(2)).toEqual(['0.051 BAC', 'Not Sober', 'Not Recorded']);
    expect(snapshot.rows[1].slice(2)).toEqual(['0.00 BAC', 'Sober', 'Not Recorded']);
    expect(snapshot.rows[2][3]).toBe('Not Tested');
  });

  it('does not add ignition state to report columns', () => {
    const snapshot = createReportSnapshot('sobriety-test', [{ id: 1, brac: '0' }], { coverage: 'All', filters: 'All' });
    expect(snapshot.headers).not.toContain('Ignition State');
  });

  it('keeps recorded failure reasons and normalizes supported ride prefixes without using ignition as an outcome', () => {
    expect(reportRideStatus({ id: 1, status: 'ride_ongoing' })).toBe('Ongoing');
    expect(reportRideStatus({ id: 1, status: 'ride_passed' })).toBe('Passed');
    expect(reportRideStatus({ id: 1, unlock_status: 'passed' })).toBe('Not Recorded');
    const row = { id: 1, brac: '0', status: 'failed_face', failure_reason: 'Face did not match' };
    const snapshot = createReportSnapshot('alcohol-detection', [row], { coverage: 'All', filters: 'All', alcoholThreshold: '0.05' });
    expect(snapshot.rows[0][3]).toBe('Sober');
    expect(snapshot.rows[0][4]).toBe('Face did not match');
    expect(row.status).toBe('failed_face');
  });

  it('sorts both ways with missing dates last', () => {
    const records = [{ id: 1 }, { id: 2, created_at: '2026-09-02' }, { id: 3, created_at: '2026-09-01' }];
    const metadata = { coverage: 'All', filters: 'All' };
    expect(createReportSnapshot('audit-trail', records, metadata).rows.map(row => row[1])).toEqual(['ID-2', 'ID-3', 'ID-1']);
    expect(createReportSnapshot('audit-trail', records, { ...metadata, sortOrder: 'oldest' }).rows.map(row => row[1])).toEqual(['ID-3', 'ID-2', 'ID-1']);
  });
});
