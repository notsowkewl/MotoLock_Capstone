import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import SettingsSave from './SettingsSave';

afterEach(cleanup);

it('keeps unchanged settings inactive and enables saving for modified settings', async () => {
  const onSave = vi.fn(async () => {});
  const view = render(<SettingsSave dirty={false} onSave={onSave} />);
  expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole('status').textContent).toBe('No unsaved changes');
  view.rerender(<SettingsSave dirty onSave={onSave} />);
  expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false);
  expect(screen.getByRole('status').textContent).toBe('Unsaved changes');
  await act(async () => { fireEvent.click(screen.getByRole('button')); });
  expect(onSave).toHaveBeenCalledOnce();
  // A handler reporting failure leaves dirty state intact until persistence succeeds.
  expect(screen.getByRole('status').textContent).toBe('Unsaved changes');
  view.rerender(<SettingsSave dirty={false} onSave={onSave} />);
  expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
});

it('prevents duplicate submissions while saving', async () => {
  let finish!: () => void;
  const onSave = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  render(<SettingsSave dirty onSave={onSave} />);
  fireEvent.click(screen.getByRole('button'));
  expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button'));
  expect(onSave).toHaveBeenCalledOnce();
  await act(async () => { finish(); });
  expect(screen.getByRole('status').textContent).toBe('Unsaved changes');
});
