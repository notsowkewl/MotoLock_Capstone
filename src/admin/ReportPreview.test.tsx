import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import ReportPreview from './ReportPreview';
import { createReportSnapshot } from './report-snapshot';

afterEach(cleanup);

it('summarizes the full filtered snapshot and exposes both export formats', () => {
  const report = createReportSnapshot('alcohol-detection', Array.from({ length: 12 }, (_, id) => ({ id, full_name: `Rider ${id}`, email: `rider${id}@example.com`, brac: '0', status: 'ongoing' })), { coverage: 'All dates', filters: 'Sober', hasFilters: true });
  const onExport = vi.fn();
  const { container } = render(<ReportPreview report={report} exporting={false} onExport={onExport} />);
  expect(screen.getByText('Showing 12 records matching your filters')).toBeTruthy();
  expect(screen.getByText(/Last updated:/)).toBeTruthy();
  const summary = container.querySelector('.reports-summary') as HTMLElement;
  expect(within(summary).getAllByText('12')).toHaveLength(3);
  expect(screen.queryByText('Rider 11')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText('Rider 11')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Export PDF' }));
  fireEvent.click(screen.getByRole('button', { name: 'Export Excel' }));
  expect(onExport.mock.calls).toEqual([['pdf'], ['excel']]);
});

it('provides guidance for empty results', () => {
  const report = createReportSnapshot('alcohol-detection', [], { coverage: 'All dates', filters: 'All' });
  render(<ReportPreview report={report} exporting={false} onExport={vi.fn()} />);
  expect(screen.getByText('No matching records')).toBeTruthy();
  expect(screen.getByText('Try adjusting your filters or date range.')).toBeTruthy();
});
