import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import ReportPreview from './ReportPreview';
import { createReportSnapshot } from './report-snapshot';

afterEach(cleanup);

it('distinguishes sober from a failed ride and keeps missing lock information neutral', () => {
  const report = createReportSnapshot('alcohol-detection', [
    { id: 1, full_name: 'Rider A', brac: '0', status: 'failed_face', failure_reason: 'Face did not match' },
    { id: 2, full_name: 'Rider B', brac: '0.08', status: 'passed', is_locked: false },
  ], { coverage: 'All', filters: 'All', alcoholThreshold: '0.05' });
  const { container, rerender } = render(<ReportPreview report={report} exporting={false} onExport={vi.fn()} />);
  expect(screen.getByRole('heading', { name: 'Alcohol Detection Report' })).toBeTruthy();
  const summary = container.querySelector('.reports-summary')!;
  expect([...summary.querySelectorAll('.reports-stat')].map(card => card.textContent)).toEqual([
    'Total Records2', 'Sober1', 'Not Sober1', 'Failed1',
  ]);
  const row = screen.getByText('Rider A').closest('tr')!;
  expect(row.cells[2].textContent).toBe('0.00 BAC');
  expect(row.cells[3].textContent).toBe('✓ Sober');
  expect(row.cells[5].textContent).toBe('FailedReason: Face did not match');
  const unknown = within(row).getByTitle('Lock status is unavailable or not recognized.');
  expect(unknown.className).toBe('reports-ignition');
  expect(unknown.getAttribute('tabindex')).toBe('0');
  expect(screen.getByText('Unlocked')).toBeTruthy();
  expect(screen.queryByText(/Failed does not necessarily mean/)).toBeNull();
  rerender(<ReportPreview report={{ ...report, rows: [report.rows[0]] }} exporting={false} onExport={vi.fn()} />);
  expect(summary.querySelector('.reports-stat')?.textContent).toBe('Total Records1');
});

it('summarizes the full filtered snapshot and exposes both export formats', () => {
  const report = createReportSnapshot('alcohol-detection', Array.from({ length: 12 }, (_, id) => ({ id, full_name: `Rider ${id}`, email: `rider${id}@example.com`, brac: '0', status: 'ongoing' })), { coverage: 'All dates', filters: 'Sober', hasFilters: true });
  const onExport = vi.fn();
  const { container } = render(<ReportPreview report={report} exporting={false} onExport={onExport} />);
  expect(screen.queryByText(/matching your filters/)).toBeNull();
  expect(screen.getByText(/Last updated:/)).toBeTruthy();
  const summary = container.querySelector('.reports-summary') as HTMLElement;
  expect(within(summary).getAllByText('12')).toHaveLength(2);
  expect(screen.getByText('0 Passed · 0 Failed · 12 Ongoing')).toBeTruthy();
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
