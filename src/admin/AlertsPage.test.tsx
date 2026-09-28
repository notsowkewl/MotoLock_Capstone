import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AlertsPage from './AlertsPage';
import type { AlertRow, AlertStore } from './alert-records';

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(cleanup);

function setup() {
  const events: AlertRow[] = [];
  const rides = [
    { id: 'one', user_id: 'ana', start_time: '2026-09-24T12:00:00Z', initial_brac_level: '0.05', status: 'failed_brac', severity: 'High', unlock_status: 'Locked' },
    { id: 'two', user_id: 'ben', start_time: '2026-09-25T12:00:00Z', status: 'failed_face', severity: 'Medium' },
  ];
  const store: AlertStore = {
    read: vi.fn(async table => table === 'audit_logs' ? [...events] : table === 'ride_history' ? rides : [{ id: 'ana', name: 'Ana Cruz' }, { id: 'ben', name: 'Ben Reyes' }, { id: 'admin-profile', email: 'admin@example.test', role: 'admin' }]),
    getActor: vi.fn().mockResolvedValue({ id: 'admin', email: 'admin@example.test' }),
    insert: vi.fn(async event => { const saved = { ...event, id: events.length + 1 }; events.push(saved); return saved; }),
  };
  const rendered = render(<AlertsPage store={store} threshold="0.05" styles={{}} />);
  return { store, events, rides, ...rendered };
}

it('combines live rider search and filters and clears them without changing the table order', async () => {
  setup();
  await screen.findByText('Showing 2 of 2 alerts');
  expect(screen.getAllByRole('row')[1].textContent).toContain('Ben Reyes');
  fireEvent.change(screen.getByLabelText('Search Rider'), { target: { value: 'aNA' } });
  expect(screen.queryByLabelText('Severity')).toBeNull();
  fireEvent.change(screen.getByLabelText('Trigger Reason'), { target: { value: 'Alcohol Above Limit' } });
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'Active' } });
  expect(screen.getByText('Showing 1 of 2 alerts')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
  expect(screen.getByText('Showing 2 of 2 alerts')).toBeTruthy();
  expect((screen.getByLabelText('Search Rider') as HTMLInputElement).value).toBe('');
  fireEvent.change(screen.getByLabelText('Search Rider'), { target: { value: 'missing rider' } });
  fireEvent.change(screen.getByLabelText('Trigger Reason'), { target: { value: 'Alcohol Above Limit' } });
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'Resolved' } });
  expect(screen.getByRole('tab', { name: 'Resolved (0)' }).getAttribute('aria-selected')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
  expect(screen.getByRole('tab', { name: 'Active Alerts (2)' }).getAttribute('aria-selected')).toBe('true');
  expect(screen.getByText('Showing 2 of 2 alerts')).toBeTruthy();
  for (const label of ['Status', 'Trigger Reason']) {
    expect((screen.getByLabelText(label) as HTMLSelectElement).value).toBe('all');
  }
  expect((screen.getByLabelText('Search Rider') as HTMLInputElement).value).toBe('');
});

it('requires confirmation, saves the optional note, and restores resolved details after remount', async () => {
  const { store, rides, unmount } = setup();
  await screen.findByText('Showing 2 of 2 alerts');
  fireEvent.click(within(screen.getByText('Ana Cruz').closest('tr')!).getByRole('button', { name: 'Resolve Alert' }));
  expect(store.insert).not.toHaveBeenCalled();
  let modal = screen.getByRole('dialog');
  expect(within(modal).getByText('Locked')).toBeTruthy();
  fireEvent.click(within(modal).getByRole('button', { name: 'Cancel' }));
  expect(store.insert).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByText('Ana Cruz').closest('tr')!).getByRole('button', { name: 'Resolve Alert' }));
  modal = screen.getByRole('dialog');
  fireEvent.change(within(modal).getByLabelText('Resolution Note (Optional)'), { target: { value: 'Contacted rider.' } });
  fireEvent.click(within(modal).getByRole('button', { name: 'Resolve Alert' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(screen.queryByText('Ana Cruz')).toBeNull();
  expect(rides[0]).toMatchObject({ initial_brac_level: '0.05', status: 'failed_brac' });
  unmount();
  render(<AlertsPage store={store} threshold="0.05" styles={{}} />);
  await screen.findByText('Showing 1 of 1 alerts');
  fireEvent.click(screen.getByRole('tab', { name: 'Resolved (1)' }));
  fireEvent.click(screen.getByRole('button', { name: 'View Details' }));
  modal = screen.getByRole('dialog');
  expect(within(modal).getByText('Contacted rider.')).toBeTruthy();
  expect(within(modal).getByText('admin@example.test')).toBeTruthy();
  expect(within(modal).getByText('Alcohol Above Limit — 0.05 BAC')).toBeTruthy();
  fireEvent.click(within(modal).getByRole('button', { name: 'Close' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  modal = screen.getByRole('dialog');
  fireEvent.click(within(modal).getByRole('button', { name: 'Cancel' }));
  expect(screen.getByRole('tab', { name: 'Resolved (1)' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  modal = screen.getByRole('dialog');
  vi.mocked(store.insert).mockRejectedValueOnce(new Error('Delete denied'));
  fireEvent.click(within(modal).getByRole('button', { name: 'Delete Alert' }));
  await screen.findByText('Delete denied');
  expect(screen.getByRole('tab', { name: 'Resolved (1)' })).toBeTruthy();
  fireEvent.click(within(modal).getByRole('button', { name: 'Delete Alert' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(screen.getByRole('tab', { name: 'Resolved (0)' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Active Alerts (1)' })).toBeTruthy();
});

it('keeps the alert active and the note available when Supabase rejects a save', async () => {
  const { store } = setup();
  vi.mocked(store.insert).mockRejectedValue(new Error('Permission denied'));
  await screen.findByText('Showing 2 of 2 alerts');
  fireEvent.click(screen.getAllByRole('button', { name: 'Resolve Alert' })[0]);
  const modal = screen.getByRole('dialog');
  fireEvent.change(within(modal).getByLabelText('Resolution Note (Optional)'), { target: { value: 'Keep this note' } });
  fireEvent.click(within(modal).getByRole('button', { name: 'Resolve Alert' }));
  await screen.findByText('Permission denied');
  expect((within(modal).getByLabelText('Resolution Note (Optional)') as HTMLTextAreaElement).value).toBe('Keep this note');
  expect(screen.getByText('Showing 2 of 2 alerts')).toBeTruthy();
});

it('does not present load failures as successfully loaded empty records', async () => {
  const store: AlertStore = { read: vi.fn().mockRejectedValue(new Error('Offline')), getActor: vi.fn(), insert: vi.fn() };
  render(<AlertsPage store={store} threshold="0.05" styles={{}} />);
  await screen.findByText('Alerts could not be loaded.');
  expect(screen.getByRole('alert').textContent).toContain('Offline');
  expect(store.insert).not.toHaveBeenCalled();
});
