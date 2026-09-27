import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import LiveMonitoringPage from './LiveMonitoringPage';
import type { Device } from './types';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(cleanup);
const devices: Device[] = [
  { id: '15a143a0-1234-4567-8901-123456789012', user_id: '39004512-1234-4567-8901-123456789012', rider_name: 'Jenna Diaz', sim_number: 'N/A', relay_status: false, is_locked: false },
  { id: 'second-device', user_id: 'other-user', sim_number: 'SIM-2', relay_status: true, is_locked: true },
  { id: 'unknown-device', user_id: '', rider_name: 'Unassigned' },
];
const props = { devices, styles: {}, onRefresh: vi.fn(async () => {}), lockIcon: () => null };

it.each([
  [true, 'Locked'], [1, 'Locked'], [false, 'Unlocked'], [0, 'Unlocked'],
  [null, 'Not Recorded'], [undefined, 'Not Recorded'], ['true', 'Not Recorded'],
  ['false', 'Not Recorded'], [2, 'Not Recorded'], ['', 'Not Recorded'],
])('displays is_locked=%s as %s without changing its value', (value, label) => {
  const device = { id: 'device', user_id: '', is_locked: value } as unknown as Device;
  const lockIcon = vi.fn(() => null);
  render(<LiveMonitoringPage {...props} devices={[device]} lockIcon={lockIcon} />);
  const cell = screen.getAllByRole('row')[1].children[3] as HTMLElement;
  expect(cell.textContent).toBe(label);
  if (label === 'Not Recorded') {
    expect(within(cell).getByTitle('Lock status is unavailable or not recognized.')).toBeTruthy();
    expect(lockIcon).not.toHaveBeenCalled();
  } else {
    expect(lockIcon).toHaveBeenCalledWith(label === 'Locked');
  }
  expect(device.is_locked).toBe(value);
});

it('preserves SIM data, distinct relay values and full identifiers in details', () => {
  render(<LiveMonitoringPage {...props} />);
  expect(screen.getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(['Device ID', 'SIM Card Slot', 'Relay Control', 'Lock Status', 'Assigned Rider', 'Actions']);
  expect(screen.getByText('DEV-15A143A0').getAttribute('title')).toBe(devices[0].id);
  const row = screen.getByText('Jenna Diaz').closest('tr')!;
  expect(within(row).getByText('N/A')).toBeTruthy();
  expect(within(row).getByText('Locked')).toBeTruthy();
  expect(within(row).getByText('Unlocked')).toBeTruthy();
  expect(screen.getByText('Active')).toBeTruthy();
  fireEvent.click(within(row).getByRole('button'));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText(String(devices[0].id))).toBeTruthy();
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
  expect(screen.getByText('SIM-2')).toBeTruthy();
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
