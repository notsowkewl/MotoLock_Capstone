import { describe, expect, it } from 'vitest';
import { buildOrganizedReport, defaultReportFilters, emptyReportSources } from './organized-report-data';
import type { ReportFilters, ReportSources } from './organized-report-data';
import { reportGroups, reportOptions } from './report-options';
import { buildReportPdf, buildReportWorkbook } from './report-export';

const data: ReportSources = {
  ...emptyReportSources,
  users: [{ id: 'a', name: 'Ana', email: 'ana@example.com', role: 'rider', created_at: '2026-09-01T10:00:00Z', face_enrolled: true }, { id: 'b', name: 'Ben', email: 'ben@example.com', role: 'rider' }],
  rides: [
    { id: '1', user_id: 'a', start_time: '2026-09-01T10:00:00Z', initial_brac_level: 0, status: 'failed_face', failure_reason: 'Face mismatch' },
    { id: '2', user_id: 'a', start_time: '2026-09-02T10:00:00Z', initial_brac_level: 0.08, status: 'failed_brac', failure_reason: 'Alcohol above limit', is_locked: true },
    { id: '3', user_id: 'b', start_time: '2026-09-02T11:00:00Z', initial_brac_level: 0, status: 'completed', is_locked: false },
    { id: '4', user_id: 'b', start_time: '2026-09-03T11:00:00Z', status: 'ongoing', is_locked: true },
    { id: '5', user_id: 'b', initial_brac_level: 0.01, status: 'passed' },
  ],
  devices: [{ id: 'd', user_id: 'a', motorcycle_id: 'm', status: 'offline', last_ping_at: '2026-09-01T10:00:00Z' }],
  motorcycles: [{ id: 'm', user_id: 'a', model: 'Motorcycle model', plate_number: 'ABC123' }],
  events: [
    { id: 'event1', user_id: 'a', created_at: '2026-09-02T10:00:00Z', action_type: 'sobriety_test_failed', action_details: { ride_id: '2', reason: 'Alcohol above limit' } },
    { id: 'event2', user_id: 'b', created_at: '2026-09-03T12:00:00Z', action_type: 'lockout_triggered', action_details: { reason: 'Recorded lockout reason', is_locked: true } },
    { id: 'event3', user_id: 'a', created_at: '2026-09-03T12:00:00Z', action_type: 'device_fault', action_details: { device_id: 'd', reason: 'Recorded device fault' } },
  ],
};
const report = (type = 'safety-sobriety', view = 'details', filters: Partial<ReportFilters> = {}, sources = data) => buildOrganizedReport(type, view, sources, { ...defaultReportFilters, ...filters }, '0.05');
const stats = (snapshot: ReturnType<typeof report>) => Object.fromEntries(snapshot.summary!.map(item => [item.label, item.value]));

it('offers distinct safety, rider, admin and device report groups', () => {
  expect(reportGroups.map(group => group.options.length)).toEqual([1, 5, 2, 7]);
  expect(reportOptions.some(option => option.value === 'alcohol-detection')).toBe(false);
  expect(reportGroups[1].options.find(option => option.value === 'rider-safety')).toBeTruthy();
});

it('keeps sobriety results and failure reasons while omitting session and ignition columns', () => {
  const original = JSON.stringify(data);
  const snapshot = report('safety-sobriety', 'details', { search: 'ana@', sobriety: 'Sober' });
  expect(snapshot.rows).toHaveLength(1);
  expect(snapshot.rows[0].slice(2)).toEqual(['0.00 BAC', 'Sober', 'Face mismatch']);
  expect(snapshot.headers).not.toContain('Ride Status');
  expect(snapshot.headers).not.toContain('Session Status');
  expect(snapshot.headers).not.toContain('Ignition State');
  expect(stats(snapshot)).toMatchObject({ 'Total Records': 1, Sober: 1, Failed: 1, Passed: 0 });
  expect(JSON.stringify(data)).toBe(original);
  expect(report('safety-sobriety', 'details', { search: 'locked' }).rows).toHaveLength(0);
});

it('selects explicit sobriety failures and lockout events without treating every failed or locked ride as a lockout', () => {
  const snapshot = report('safety-sobriety', 'failures');
  expect(snapshot.rows).toHaveLength(2);
  expect(snapshot.headers).toContain('Failure / Lockout Reason');
  expect(snapshot.headers).not.toContain('Ride Status');
  expect(snapshot.headers).not.toContain('Ignition State');
  expect(snapshot.rows.flat()).not.toContain('Face mismatch');
  expect(stats(snapshot)).toEqual({ 'Total Failed Events': 2, 'Sobriety Failures': 1, Lockouts: 1, 'Riders Affected': 2 });
  expect(report('safety-sobriety', 'failures', { failure: 'lockout' }).rows).toHaveLength(1);
  const noReasons = { ...emptyReportSources, rides: [{ id: 'x', status: 'failed_brac' }] };
  expect(report('safety-sobriety', 'failures', {}, noReasons).headers).toContain('Failure / Lockout Reason');
});

it('trends aggregate only measured tests, retain undated tests in exports, and define pass rate independently from sobriety', () => {
  const snapshot = report('safety-sobriety', 'trends');
  expect(stats(snapshot)).toEqual({ 'Total Tests': 4, Passed: 2, Failed: 2, Sober: 3, 'Not Sober': 1, 'Pass Rate': '50.0%' });
  expect(snapshot.chart!.reduce((sum, point) => sum + point.total, 0)).toBe(3);
  expect(snapshot.rows.at(-1)![0]).toBe('Not Recorded');
  expect(snapshot.rows.reduce((sum, row) => sum + Number(row[1]), 0)).toBe(4);
  const filtered = report('safety-sobriety', 'trends', { start: '2026-09-02', end: '2026-09-02' });
  expect(stats(filtered)['Total Tests']).toBe(2);
  expect(filtered.chart).toHaveLength(1);
});

it('ignores filters that are irrelevant to the selected view', () => {
  expect(report('safety-sobriety', 'trends', { failure: 'lockout' }).rows).toEqual(report('safety-sobriety', 'trends').rows);
  expect(report('device-inventory', 'details', { start: '2099-01-01' }).rows).toHaveLength(1);
});

it('aggregates safety per rider and makes master, activity, registration and incident reports distinct', () => {
  expect(report('rider-safety').rows.find(row => row[0].startsWith('Ana'))?.slice(1)).toEqual(['2', '1', '1', '0', '2']);
  const headers = ['rider-master', 'rider-activity', 'rider-reg', 'rider-incident-hist'].map(type => report(type).headers.join('|'));
  expect(new Set(headers).size).toBe(4);
  expect(report('rider-master').headers).not.toContain('Mobile');
  expect(report('rider-master').headers).not.toContain('Account Status');
  expect(report('rider-activity').rows).toHaveLength(3);
});

it('uses motorcycle and device records directly without showing phone SIM data', () => {
  expect(report('motorcycle-reg').rows[0]).toContain('ABC123');
  expect(report('device-inventory').rows[0]).toEqual(['d', 'Ana\nana@example.com']);
  expect(report('device-connection').rows[0]).toContain('Offline');
  expect(report('device-pairing').rows[0]).toContain('m');
  expect(report('helmet-unit').rows).toEqual([]);
  expect(report('motorcycle-unit').rows).toEqual([]);
  expect(report('device-fault').rows).toHaveLength(1);
  expect(report('device-fault', 'details', {}, { ...data, events: [] }).rows).toHaveLength(0);
  const typed = { ...data, devices: [{ ...data.devices[0], device_type: 'helmet', sim_number: 'SIM-1' }] };
  expect(report('helmet-unit', 'details', {}, typed).rows[0]).not.toContain('SIM-1');
  expect(report('device-fault').headers).not.toContain('SIM Card Slot');
});

it('keeps dated rider registrations separate from the current master list without inventing historical metadata', () => {
  const sources = { ...data, users: [
    ...data.users,
    { id: 'c', name: 'Cara', email: 'cara@example.com', role: 'rider', created_at: '2026-09-03T10:00:00Z', updated_at: '2026-09-10T10:00:00Z', status: 'active' },
    { id: 'admin', name: 'Administrator', role: 'admin', created_at: '2026-09-04T10:00:00Z' },
    { id: 'invalid', name: 'Invalid date', role: 'rider', created_at: 'invalid' },
  ] };
  const before = JSON.stringify(sources);
  const history = report('rider-reg', 'details', {}, sources);
  expect(history.headers).toEqual(['Registration Date & Time', 'Rider', 'Account ID']);
  expect(history.rows.map(row => row[2])).toEqual(['c', 'a']);
  expect(history.headers).not.toContain('Account Status');
  expect(history.headers).not.toContain('Registered By');
  expect(report('rider-master', 'details', {}, sources).rows).toHaveLength(4);
  expect(report('rider-reg', 'details', { start: '2026-09-03', end: '2026-09-03' }, sources).rows.map(row => row[2])).toEqual(['c']);
  expect(report('rider-reg', 'details', { search: 'ana@' }, sources).rows.map(row => row[2])).toEqual(['a']);
  expect(report('rider-reg', 'details', { start: '2026-09-10' }, sources).rows).toEqual([]);
  const sheet = buildReportWorkbook(history).getWorksheet('Report')!;
  expect(sheet.getRow(7).values).toEqual([undefined, ...history.headers]);
  history.rows.forEach((row, index) => expect(sheet.getRow(index + 8).values).toEqual([undefined, ...row]));
  expect(JSON.stringify(sources)).toBe(before);
});

describe('exports match each safety view', () => {
  it.each(['details', 'failures', 'trends'])('%s exports only the current filtered snapshot', view => {
    const snapshot = report('safety-sobriety', view, { search: 'ana' });
    expect(snapshot.headers).not.toContain('Ride Status');
    expect(snapshot.headers).not.toContain('Session Status');
    expect(snapshot.headers).not.toContain('Ignition State');
    const workbook = buildReportWorkbook(snapshot);
    const sheet = workbook.getWorksheet('Report')!;
    expect(sheet.getRow(7).values).toEqual([undefined, ...snapshot.headers]);
    snapshot.rows.forEach((row, index) => expect(sheet.getRow(index + 8).values).toEqual([undefined, ...row]));
    const pdf = buildReportPdf(snapshot).output();
    expect(pdf).toContain(snapshot.title);
    expect(pdf).not.toContain('Ben');
  });
});
