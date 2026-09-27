import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import RidersPage from './RidersPage';
import type { Rider } from './types';

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(cleanup);
const riders: Rider[] = [
  { id: 'jenna', full_name: 'Jenna Diaz', email: 'jenna@example.com', phone: '09123456789', role: 'rider', face_enrolled: true,
    motorcycles: [{ id: 1, plate_number: 'CDH976', model: 'Dominar', year: 2024, color: 'Black' }, { id: 2, plate_number: 'UNKNOWN', model: 'Barako II' }],
    contacts: [{ id: 1, name: 'Mama', role: 'Family', phone: '09312345606' }, { id: 2, name: 'Ate Yanna', role: 'Friend', phone_number: '09112345607' }] },
  { id: 'ana', full_name: 'Ana Reyes', email: 'ana@example.com', role: 'admin', face_enrolled: false },
];
function setup(data = riders) {
  const callbacks = { onAdd: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() };
  render(<RidersPage riders={data} styles={{}} maskPhone={phone => phone ? `${phone.slice(0, 3)}******${phone.slice(-2)}` : 'N/A'} {...callbacks} />);
  return callbacks;
}

it('retains eight columns and all motorcycles and contacts, with read-only details', () => {
  setup();
  expect(screen.getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(['Rider Name', 'Email', 'Mobile', 'Motorcycle', 'Emergency Contacts', 'Role', 'Face ID Status', 'Actions']);
  expect(screen.getByText('No plate recorded')).toBeTruthy();
  expect(screen.getByText('Mama')).toBeTruthy();
  expect(screen.queryByText('Ate Yanna')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '+1 more contact' }));
  expect(within(screen.getByRole('dialog')).getByText('Ate Yanna')).toBeTruthy();
  expect(within(screen.getByRole('dialog')).getByText('Friend · 091******07')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  fireEvent.click(screen.getByRole('button', { name: 'View rider Jenna Diaz' }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText('09123456789')).toBeTruthy();
  expect(within(dialog).getByText('2024 · Black')).toBeTruthy();
  expect(within(dialog).getByText('Friend · 09112345607')).toBeTruthy();
  expect(within(dialog).queryByRole('textbox')).toBeNull();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(riders[0].motorcycles?.[1].plate_number).toBe('UNKNOWN');
});

it('filters by email, role and Face ID without changing source data', () => {
  setup();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: ' JENNA@ ' } });
  expect(screen.getByText('Showing 1–1 of 1 riders')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Face ID Status'), { target: { value: 'missing' } });
  expect(screen.getByText('No matching riders')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'admin' } });
  expect(screen.getByRole('button', { name: 'View rider Ana Reyes' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
});

it('sorts names and preserves edit, delete-confirmation, and add callbacks', () => {
  const callbacks = setup();
  const names = () => screen.getAllByRole('button', { name: /^View rider/ }).map(button => button.textContent);
  expect(names()).toEqual(['Ana Reyes', 'Jenna Diaz']);
  fireEvent.change(screen.getByLabelText('Sort Order'), { target: { value: 'name-desc' } });
  expect(names()).toEqual(['Jenna Diaz', 'Ana Reyes']);
  const row = screen.getByRole('button', { name: 'View rider Jenna Diaz' }).closest('tr')!;
  fireEvent.click(within(row).getByRole('button', { name: 'Edit' }));
  expect(callbacks.onEdit).toHaveBeenCalledWith(riders[0]);
  fireEvent.click(within(row).getByRole('button', { name: 'Delete' }));
  expect(callbacks.onDelete).toHaveBeenCalledWith(riders[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Add User' }));
  expect(callbacks.onAdd).toHaveBeenCalledOnce();
});

it('keeps pagination and resets the page when filtering', () => {
  setup(Array.from({ length: 12 }, (_, index) => ({ id: String(index), full_name: `Rider ${index}`, email: `rider${index}@example.com`, role: 'rider' })));
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText('Showing 11–12 of 12 riders')).toBeTruthy();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'rider11@' } });
  expect(screen.getByText('Showing 1–1 of 1 riders')).toBeTruthy();
});

it('handles no contacts, a single contact, and plural additional counts', () => {
  setup([
    riders[1],
    { ...riders[0], id: 'single', full_name: 'Single Contact', contacts: riders[0].contacts!.slice(0, 1) },
    { ...riders[0], contacts: [...riders[0].contacts!, { id: 3, name: 'Daniel', role: 'Sibling', phone: '09212345668' }] },
  ]);
  expect(screen.getByText('No emergency contact')).toBeTruthy();
  const singleRow = screen.getByRole('button', { name: 'View rider Single Contact' }).closest('tr')!;
  expect(within(singleRow).queryByRole('button', { name: /more contact/ })).toBeNull();
  expect(screen.queryByText('Daniel')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '+2 more contacts' }));
  expect(within(screen.getByRole('dialog')).getByText('Daniel')).toBeTruthy();
  expect(within(screen.getByRole('dialog')).getByText('Sibling · 092******68')).toBeTruthy();
});
