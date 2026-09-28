import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import LiveMonitoringPage from './LiveMonitoringPage';
import type { Device } from './types';
import { attachMonitoringRecords } from './monitoring-records';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(cleanup);
const devices: Device[] = [
  { id: '15a143a0-1234-4567-8901-123456789012', user_id: '39004512-1234-4567-8901-123456789012', rider_name: 'Jenna Diaz', relay_status: false, is_locked: false },
  { id: 'second-device', user_id: 'other-user', relay_status: true, is_locked: true },
  { id: 'unknown-device', user_id: '', rider_name: 'Unassigned' },
];
const props = { devices, styles: {}, onRefresh: vi.fn(async () => {}), lockIcon: () => null };

it('shows dated history without the source label in the table and details', () => {
  const recorded = attachMonitoringRecords([{ id: 'device', user_id: '' }], [], [{
    id: 'event', created_at: '2026-09-18T08:00:00Z',
    action_details: { device_id: 'device', ignition: 'locked', synthetic: true },
  }]);
  render(<LiveMonitoringPage {...props} devices={recorded} />);
  const row = screen.getAllByRole('row')[1];
  expect(row.children[1].textContent).toBe('Not Recorded');
  expect(row.children[2].textContent).toContain('Locked');
  expect(row.children[2].textContent).toContain('Last recorded status');
  expect(row.children[2].textContent).not.toContain('Sample data');
  expect(row.children[2].textContent).not.toContain('Audit event');
  expect(row.querySelector('time')?.dateTime).toBe('2026-09-18T08:00:00Z');
  fireEvent.click(within(row).getByRole('button'));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).queryByText('Audit event · Sample data')).toBeNull();
  expect(dialog.querySelector('time')?.dateTime).toBe('2026-09-18T08:00:00Z');
});

it('keeps available device readings ahead of historical fallback', () => {
  const recorded = attachMonitoringRecords([{ id: 'device', user_id: '', is_locked: false }], [], [{
    id: 'event', created_at: '2026-09-18T08:00:00Z', action_details: { device_id: 'device', ignition: 'locked' },
  }]);
  render(<LiveMonitoringPage {...props} devices={recorded} />);
  expect(screen.getAllByRole('row')[1].children[2].textContent).toBe('Unlocked');
  expect(screen.queryByText(/Last recorded status ·/)).toBeNull();
});

it.each([
  [true, 'Locked'], [1, 'Locked'], [false, 'Unlocked'], [0, 'Unlocked'],
  [null, 'Not Recorded'], [undefined, 'Not Recorded'], ['true', 'Not Recorded'],
  ['false', 'Not Recorded'], [2, 'Not Recorded'], ['', 'Not Recorded'],
])('displays is_locked=%s as %s without changing its value', (value, label) => {
  const device = { id: 'device', user_id: '', is_locked: value } as unknown as Device;
  const lockIcon = vi.fn(() => null);
  render(<LiveMonitoringPage {...props} devices={[device]} lockIcon={lockIcon} />);
  const cell = screen.getAllByRole('row')[1].children[2] as HTMLElement;
  expect(cell.textContent).toBe(label);
  if (label === 'Not Recorded') {
    expect(within(cell).getByTitle('Lock status is unavailable or not recognized.')).toBeTruthy();
    expect(lockIcon).not.toHaveBeenCalled();
  } else {
    expect(lockIcon).toHaveBeenCalledWith(label === 'Locked');
  }
  expect(device.is_locked).toBe(value);
});

it('shows device hardware states and full identifiers without phone SIM data', () => {
  render(<LiveMonitoringPage {...props} />);
  expect(screen.getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(['Device ID', 'Relay Control', 'Lock Status', 'Assigned Rider', 'Actions']);
  expect(screen.getByText('DEV-15A143A0').getAttribute('title')).toBe(devices[0].id);
  const row = screen.getByText('Jenna Diaz').closest('tr')!;
  expect(within(row).getByText('Locked')).toBeTruthy();
  expect(within(row).getByText('Unlocked')).toBeTruthy();
  expect(screen.getByText('Active')).toBeTruthy();
  fireEvent.click(within(row).getByRole('button'));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText(String(devices[0].id))).toBeTruthy();
  expect(within(dialog).queryByText(/SIM Card Slot/)).toBeNull();
  expect(within(dialog).getByText(`User ID: ${devices[0].user_id}`)).toBeTruthy();
  fireEvent.click(within(dialog).getByText('Close'));
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('combines rider/device search with lock filters and counts unknown readings honestly', () => {
  render(<LiveMonitoringPage {...props} />);
  expect(screen.getByLabelText('Monitoring summary').textContent).toBe('3 Devices1 Unlocked1 Locked1 Not Recorded');
  fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'jenna' } });
  expect(screen.getAllByRole('row')).toHaveLength(2);
  fireEvent.change(screen.getByLabelText('Lock Status'), { target: { value: 'Locked' } });
  expect(screen.getByText('No devices match your search or lock status filter.')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'other-user' } });
  expect(screen.queryByText('SIM-2')).toBeNull();
  fireEvent.change(screen.getByLabelText('Lock Status'), { target: { value: 'All' } });
  fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'DEV-15A143A0' } });
  expect(screen.getByText('Jenna Diaz')).toBeTruthy();
});

it('uses the supplied refresh operation and does not claim automatic updates', async () => {
  let finish!: () => void;
  const onRefresh = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  render(<LiveMonitoringPage {...props} onRefresh={onRefresh} />);
  expect(screen.getByText('Device monitoring · Manual refresh')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '↻ Refresh' }));
  expect(onRefresh).toHaveBeenCalledTimes(1);
  expect((screen.getByRole('button', { name: 'Refreshing…' }) as HTMLButtonElement).disabled).toBe(true);
  finish();
  await waitFor(() => expect((screen.getByRole('button', { name: '↻ Refresh' }) as HTMLButtonElement).disabled).toBe(false));
});
