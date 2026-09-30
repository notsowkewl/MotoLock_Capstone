import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import TablePagination, { useTablePagination } from './TablePagination';

it('pages results and resets for filters and page size, clamping when records disappear', () => {
  const records = Array.from({ length: 26 }, (_, index) => index);
  const { result, rerender } = renderHook(({ rows, filter }) => useTablePagination(rows, filter), {
    initialProps: { rows: records, filter: '' },
  });
  expect(result.current.rows).toEqual(records.slice(0, 10));
  act(() => result.current.setPage(3));
  expect(result.current.rows).toEqual(records.slice(20));
  rerender({ rows: records.slice(0, 11), filter: '' });
  expect(result.current.page).toBe(2);
  expect(result.current.rows).toEqual([10]);
  rerender({ rows: records, filter: 'new search' });
  expect(result.current.page).toBe(1);
  act(() => result.current.setSize(25));
  expect(result.current.rows).toHaveLength(25);
  rerender({ rows: [], filter: 'empty' });
  expect(result.current).toMatchObject({ start: 0, end: 0, total: 0, page: 1, pages: 1 });
});

it('renders working controls with disabled boundaries', () => {
  function Table() {
    const pagination = useTablePagination(Array.from({ length: 11 }, (_, i) => i));
    return <TablePagination pagination={pagination} label="Test" styles={{}} />;
  }
  render(<Table />);
  const nav = within(screen.getByRole('navigation', { name: 'Test pagination' }));
  expect((nav.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(nav.getByRole('button', { name: 'Next' }));
  expect(nav.getByRole('status').textContent).toBe('Showing 11-11 of 11 records');
  expect((nav.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(nav.getByRole('button', { name: 'Page 1' }));
  expect(nav.getByRole('status').textContent).toBe('Showing 1-10 of 11 records');
  expect(nav.getByRole('button', { name: 'Page 1' }).getAttribute('aria-current')).toBe('page');
});

it('keeps numbered buttons near the selected page for longer tables', () => {
  function Table() {
    const pagination = useTablePagination(Array.from({ length: 100 }, (_, i) => i));
    return <TablePagination pagination={pagination} label="Long table" styles={{}} />;
  }
  render(<Table />);
  const nav = within(screen.getByRole('navigation', { name: 'Long table pagination' }));
  fireEvent.click(nav.getByRole('button', { name: 'Page 5' }));
  expect(nav.getByRole('button', { name: 'Page 7' })).toBeTruthy();
  expect(nav.queryByRole('button', { name: 'Page 1' })).toBeNull();
  fireEvent.click(nav.getByRole('button', { name: 'Page 7' }));
  fireEvent.click(nav.getByRole('button', { name: 'Page 9' }));
  fireEvent.click(nav.getByRole('button', { name: 'Page 10' }));
  expect((nav.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);
});
