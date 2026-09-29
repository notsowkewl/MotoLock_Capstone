import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import DevicesPage from './DevicesPage';
import type { Device } from './types';

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(cleanup);

const devices: Device[] = [
  { id: '15a143a0-1111-2222-3333-123456789abc', user_id: 'rider-1', is_locked: false, model: 'MotoLock device' },
  { id: '25b143b0-1111-2222-3333-987654321abc', user_id: 'rider-2', is_locked: true },
  { id: 'unknown-device', user_id: 'rider-3' },
];

it('shows recorded states, abbreviated IDs, and a navigation-only override flow', () => {
  const onOpenAlerts = vi.fn();
  render(<DevicesPage devices={devices} styles={{}} onOpenAlerts={onOpenAlerts} />);
  expect(screen.getByText('DEV-15A143A0').getAttribute('title')).toBe(devices[0].id);
  expect(within(screen.getByRole('table')).getByText(/Awaiting Hardware/)).toBeTruthy();
  expect(within(screen.getByLabelText('Device summary')).getByText('Awaiting Hardware')).toBeTruthy();
  expect(screen.queryByText('Offline')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: `Manage device ${devices[0].id}` }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText(devices[0].id)).toBeTruthy();
  expect(within(dialog).queryByText(/SIM Card/)).toBeNull();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Device Override' }));
  expect(within(dialog).getByText('Device override actions are managed through Alerts & Incidents. Open an active alert to continue.')).toBeTruthy();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Go to Alerts & Incidents' }));
  expect(onOpenAlerts).toHaveBeenCalledOnce();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(devices[0].is_locked).toBe(false);
});

it('combines full and abbreviated ID search with ignition filtering and clear filters', () => {
  render(<DevicesPage devices={devices} styles={{}} onOpenAlerts={vi.fn()} />);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'DEV-15A143A0' } });
  expect(screen.getByText('Showing 1-1 of 1 records')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Ignition Status'), { target: { value: 'Ignition Locked' } });
  expect(screen.getByText('No matching devices')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Ignition Status'), { target: { value: 'Awaiting Hardware' } });
  expect(screen.getByText('Showing 1-1 of 1 records')).toBeTruthy();
  expect(within(screen.getByRole('table')).getByText('DEV-UNKNOWN-')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(screen.getByText('Showing 1-3 of 3 records')).toBeTruthy();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '987654321abc' } });
  expect(screen.getByText('DEV-25B143B0')).toBeTruthy();
  expect(screen.queryByText('DEV-15A143A0')).toBeNull();
});

it('resets pagination for filtered results and supports cancelling the dialog', () => {
  const onOpenAlerts = vi.fn();
  render(<DevicesPage devices={Array.from({ length: 12 }, (_, index) => ({ id: `device-${index}`, user_id: 'rider', is_locked: false }))} styles={{}} onOpenAlerts={onOpenAlerts} />);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText('Showing 11-12 of 12 records')).toBeTruthy();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'device-11' } });
  expect(screen.getByText('Showing 1-1 of 1 records')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Manage device device-11' }));
  fireEvent.click(screen.getByRole('button', { name: 'Device Override' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onOpenAlerts).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('shows an empty state when no devices exist', () => {
  render(<DevicesPage devices={[]} styles={{}} onOpenAlerts={vi.fn()} />);
  expect(screen.getByText('No devices available')).toBeTruthy();
  expect(screen.getByText('Showing 0-0 of 0 records')).toBeTruthy();
});

it('opens a sticker for the selected device visual ID and supports searching it', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer });
  vi.stubGlobal('fetch', fetchMock);
  try {
    render(<DevicesPage devices={[
      { ...devices[0], helmet_visual_id: 'MOTO-01D44' },
      { ...devices[1], helmet_visual_id: 'MOTO-2ABCD' },
    ]} styles={{}} onOpenAlerts={vi.fn()} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'MOTO-2ABCD' } });
    expect(screen.getByText('Showing 1-1 of 1 records')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: `Generate sticker for device ${devices[1].id}` }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('MOTO-2ABCD')).toBeTruthy();
    const image = await within(dialog).findByRole('img', { name: 'Encoded helmet sticker MOTO-2ABCD' });
    expect(decodeURIComponent(image.getAttribute('src')!)).toContain('MOTO-2ABCD');
    expect(decodeURIComponent(image.getAttribute('src')!)).not.toContain('#80FF80');
    fireEvent.change(within(dialog).getByLabelText('Background'), { target: { value: 'green' } });
    expect(decodeURIComponent(image.getAttribute('src')!)).toContain('#80FF80');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  } finally { vi.unstubAllGlobals(); }
});

it('does not invent a sticker ID for an unsynced device', () => {
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
  try {
    render(<DevicesPage devices={devices} styles={{}} onOpenAlerts={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: `Generate sticker for device ${devices[0].id}` }));
    expect(screen.getByRole('alert').textContent).toContain('Pair and sync');
    expect((screen.getByRole('button', { name: 'Download SVG' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Download PNG' }) as HTMLButtonElement).disabled).toBe(true);
  } finally { vi.unstubAllGlobals(); }
});
