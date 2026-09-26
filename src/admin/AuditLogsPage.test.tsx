import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import AuditLogsPage from './AuditLogsPage';
import { normalizeAuditLog, sortAuditLogs } from './audit-records';
import { activityLabel, areaLabel, performerLabel } from './audit-presentation';

afterEach(cleanup);

it('shows friendly labels, preserves full IDs, and filters by original values', () => {
  const target = 'Ride: d8208ae2-48bb-5af0-af01-b303dbf5ade4';
  const log = { id: 1, created_at: '2026-09-26T10:00:00Z', action: 'ride_ongoing', module: 'ride', admin_name: 'Ana', target_record: target };
  render(<AuditLogsPage logs={[log]} styles={{}} />);
  expect(screen.getByRole('columnheader', { name: 'Date & Time' })).toBeTruthy();
  expect(screen.getByTitle(target).textContent).toBe('Ride · d8208ae2...');
  expect(screen.getByRole('option', { name: 'Ride In Progress' }).getAttribute('value')).toBe('ride_ongoing');
  fireEvent.change(screen.getByLabelText('Activity'), { target: { value: 'ride_ongoing' } });
  fireEvent.change(screen.getByLabelText('Area'), { target: { value: 'ride' } });
  fireEvent.change(screen.getByLabelText('Search Logs'), { target: { value: 'b303dbf5ade4' } });
  expect(screen.getByTitle(target)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Search Logs'), { target: { value: 'absent' } });
  expect(screen.getByText('No audit logs match the selected filters.')).toBeTruthy();
  fireEvent.click(screen.getByText('Clear Filters'));
  expect(screen.getByTitle(target)).toBeTruthy();
  expect(log.action).toBe('ride_ongoing');
  expect(log.target_record).toBe(target);
});

it('formats activities and areas without guessing automation from a person name', () => {
  expect(activityLabel('login_success')).toBe('Successful Login');
  expect(activityLabel('incident_opened')).toBe('Incident Reported');
  expect(activityLabel('alert_deleted')).toBe('Alert Deleted');
  expect(areaLabel('device')).toBe('MotoLock Devices');
  expect(areaLabel('sobriety_test')).toBe('Sobriety Tests');
  const actor = { admin_name: 'MotoLock Developers', action: 'alert_resolved', module: 'alert' };
  expect(performerLabel(actor)).toBe('MotoLock Developers');
  expect(performerLabel({ ...actor, module: 'system' })).toBe('System');
});
const logs = Array.from({ length: 45 }, (_, i) => normalizeAuditLog({ id: i + 1, created_at: new Date(2026, 8, i + 1, 12).toISOString(), action_type: i % 2 ? 'update' : 'create', action_details: { module: 'Riders', target_record: `User: ${i + 1}` } }, 'Ana'));

it('paginates, sorts, resets pages for searches and clears combined filters', () => {
  render(<AuditLogsPage logs={logs} styles={{}} />);
  expect(screen.getByText('Showing 1–20 of 45 logs')).toBeTruthy();
  expect(screen.getAllByRole('row')[1].textContent).toContain('User · 45');
  fireEvent.click(screen.getByLabelText('Next page'));
  expect(screen.getByText('Showing 21–40 of 45 logs')).toBeTruthy();
  fireEvent.click(screen.getByLabelText('Next page'));
  expect(screen.getByText('Showing 41–45 of 45 logs')).toBeTruthy();
  expect((screen.getByLabelText('Next page') as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Sort Order'), { target: { value: 'oldest' } });
  expect(screen.getAllByRole('row')[1].textContent).toContain('User · 1');
  fireEvent.change(screen.getByLabelText('Search Logs'), { target: { value: 'USER: 2' } });
  fireEvent.change(screen.getByLabelText('Activity'), { target: { value: 'update' } });
  fireEvent.change(screen.getByLabelText('Area'), { target: { value: 'Riders' } });
  fireEvent.change(screen.getByLabelText('Performed By'), { target: { value: 'Ana' } });
  expect(screen.getByText('Showing 1–6 of 6 logs')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('From Date'), { target: { value: '2026-09-20' } });
  fireEvent.change(screen.getByLabelText('To Date'), { target: { value: '2026-09-20' } });
  expect(screen.getByText('Showing 1–1 of 1 logs')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Search Logs'), { target: { value: 'absent' } });
  expect(screen.getByText('Showing 0–0 of 0 logs')).toBeTruthy();
  fireEvent.click(screen.getByText('Clear Filters'));
  expect(screen.getByText('Showing 1–20 of 45 logs')).toBeTruthy();
  expect(screen.getAllByRole('row')[1].textContent).toContain('User · 45');
});

it('preserves saved targets and modules without substituting a test result or actor', () => {
  expect(normalizeAuditLog({ action_type: 'update_user', action_details: JSON.stringify({ module: 'Rider Management', target_record: 'User: abc', result: 'passed' }) })).toMatchObject({ module: 'Rider Management', target_record: 'User: abc' });
  expect(normalizeAuditLog({ target_record: 'Device: 7', action_details: '{broken' }).target_record).toBe('Device: 7');
  expect(normalizeAuditLog({ action_details: { ride_id: 0, result: 'failed' } }).target_record).toBe('Ride: 0');
  expect(normalizeAuditLog({ action_details: { result: 'passed', name: 'Actor' } }).target_record).toBe('Not Recorded');
  const tied = [logs[0], { ...logs[0], id: 99 }, { ...logs[0], id: 100, created_at: '' }];
  expect(sortAuditLogs(tied).map(log => log.id)).toEqual([99, 1, 100]);
  expect(sortAuditLogs(tied, true).map(log => log.id)).toEqual([1, 99, 100]);
});
