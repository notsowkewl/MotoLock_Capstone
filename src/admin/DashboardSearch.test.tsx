import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import DashboardSearch from './DashboardSearch';

afterEach(cleanup);
const props = {
  riders: [{ id: 'rider-123', full_name: 'Jenna Diaz', email: 'jenna@example.com', role: 'rider', motorcycles: [{ id: 1, plate_number: 'ABC-123', model: 'Honda' }] }],
  devices: [{ id: 'device-456', user_id: 'rider-123', rider_name: 'Jenna Diaz' }],
  rides: [{ id: 'ride-789', full_name: 'Jenna Diaz', email: 'jenna@example.com', status: 'failed_face', created_at: '', brac: '' }],
  logs: [{ id: 1, admin_name: 'Jenna Diaz', action: 'alert_resolved', module: 'alert', target_record: 'Ride: ride-789', created_at: '' }],
  onNavigate: vi.fn(),
};
const search = (value: string) => fireEvent.change(screen.getByLabelText('Search MotoLock'), { target: { value } });

it('searches loaded data across categories, including full IDs, plates and friendly activity labels', () => {
  render(<DashboardSearch {...props} />);
  search('JENNA');
  expect(screen.getByRole('status').textContent).toContain('5 results');
  search('ABC-123');
  expect(screen.getByText('Jenna Diaz')).toBeTruthy();
  search('SIM-789');
  expect(screen.getByRole('status').textContent).toContain('No matching records');
  search('device-456');
  expect(screen.getByText('DEV-DEVICE-4')).toBeTruthy();
  search('alert resolved');
  expect(screen.getByText('Alert Resolved')).toBeTruthy();
  search('ride-789');
  expect(screen.getByRole('status').textContent).toContain('3 results');
  expect(props.logs[0].action).toBe('alert_resolved');
});

it('opens existing pages, clears results, and handles no matches', () => {
  const onNavigate = vi.fn();
  render(<DashboardSearch {...props} onNavigate={onNavigate} />);
  search('device-456');
  fireEvent.click(screen.getByRole('button', { name: 'Open Live Monitoring' }));
  expect(onNavigate).toHaveBeenCalledWith('live-monitoring');
  search('settings');
  fireEvent.click(screen.getByRole('button', { name: 'Open Settings' }));
  expect(onNavigate).toHaveBeenCalledWith('settings');
  search('no-such-record');
  expect(screen.getByRole('status').textContent).toContain('No matching records');
  fireEvent.click(screen.getByText('Clear'));
  expect(screen.queryByRole('status')).toBeNull();
});

it('makes additional matches available without a nested scrolling panel', () => {
  render(<DashboardSearch {...props} devices={Array.from({ length: 12 }, (_, i) => ({ id: `unique-${i}`, user_id: '' }))} />);
  search('unique');
  expect(screen.getByRole('status').textContent).toBe('12 results · Showing 8');
  fireEvent.click(screen.getByText('Show more results'));
  expect(screen.getByRole('status').textContent).toBe('12 results · Showing 12');
  fireEvent.keyDown(screen.getByLabelText('Search MotoLock'), { key: 'Escape' });
  expect(screen.queryByRole('status')).toBeNull();
});
