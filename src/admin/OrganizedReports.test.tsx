import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import OrganizedReports from './OrganizedReports';
import { emptyReportSources } from './organized-report-data';
import { buildOrganizedReport, defaultReportFilters } from './organized-report-data';

afterEach(cleanup);

it('offers Not Active even without matches and filters recorded inactive values without treating missing status as inactive', () => {
  const sources = { ...data, users: [
    { id: 'active', name: 'Active Rider', role: 'rider', status: 'active' },
    { id: 'inactive', name: 'Inactive Rider', role: 'rider', status: 'inactive' },
    { id: 'not-active', name: 'Not Active Rider', role: 'rider', status: 'not_active' },
    { id: 'unknown', name: 'Unknown Status', role: 'rider' },
  ] };
  const { rerender } = render(<OrganizedReports data={sources} threshold="0.05" styles={{}} onExport={vi.fn(async () => {})} />);
  fireEvent.change(screen.getByLabelText('Report Type'), { target: { value: 'rider' } });
  const filter = screen.getByLabelText('Account Status');
  expect(within(filter).getAllByRole('option').map(option => option.textContent)).toEqual(['All', 'Active', 'Not Active']);
  fireEvent.change(filter, { target: { value: 'not_active' } });
  expect(screen.getAllByRole('row')).toHaveLength(3);
  expect(screen.queryByText('Unknown Status')).toBeNull();
  expect(screen.queryByText('Active Rider')).toBeNull();
  expect(sources.users[1].status).toBe('inactive');
  rerender(<OrganizedReports data={{ ...sources, users: [sources.users[0]] }} threshold="0.05" styles={{}} onExport={vi.fn(async () => {})} />);
  expect(within(screen.getByLabelText('Account Status')).getByRole('option', { name: 'Not Active' })).toBeTruthy();
  expect(screen.getByText('No matching records')).toBeTruthy();
});
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

it.each([
  ['rider', ['Master List', 'Activity', 'Safety Summary', 'Incident History', 'Registration History'], ['rider-master', 'rider-activity', 'rider-safety', 'rider-incident-hist', 'rider-reg']],
  ['motorcycle', ['Registry', 'Unit Details'], ['motorcycle-reg', 'motorcycle-unit']],
  ['device', ['Device Inventory', 'Helmet Units', 'Device Pairing', 'Connection Status', 'Faults & Failures'], ['device-inventory', 'helmet-unit', 'device-pairing', 'device-connection', 'device-fault']],
] as const)('keeps every %s report accessible and exports its existing dataset', async (area, labels, reportIds) => {
  const onExport = vi.fn(async () => {});
  const sources = { ...data, users: [{ ...data.users[0], created_at: '2026-09-01T10:00:00Z' }] };
  const { container } = render(<OrganizedReports data={sources} threshold="0.05" styles={{}} onExport={onExport} />);
  fireEvent.change(screen.getByLabelText('Report Type'), { target: { value: area } });
  expect(within(screen.getByLabelText('View')).getAllByRole('option').map(option => option.textContent)).toEqual(labels);
  for (const id of reportIds) {
    fireEvent.change(screen.getByLabelText('View'), { target: { value: id } });
    const existing = buildOrganizedReport(id, id, sources, defaultReportFilters, '0.05');
    expect(screen.getByRole('heading', { name: existing.title })).toBeTruthy();
    const inlineSummary = container.querySelector('.reports-summary-inline');
    expect(inlineSummary).toBeTruthy();
    expect(container.querySelector('.reports-summary:not(.reports-summary-inline)')).toBeNull();
    const metricLabels = [...inlineSummary!.querySelectorAll('.reports-stat span')].map(label => label.textContent);
    expect(new Set(metricLabels).size).toBe(metricLabels.length);
    for (const outcome of ['Passed', 'Failed', 'Ongoing']) expect(metricLabels).not.toContain(outcome);
    onExport.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Export Excel' }));
    await waitFor(() => expect(onExport).toHaveBeenCalledOnce());
    expect(onExport.mock.calls[0]).toMatchObject([{ type: id, headers: existing.headers, rows: existing.rows }, 'excel']);
    await waitFor(() => expect((screen.getByRole('button', { name: 'Export Excel' }) as HTMLButtonElement).disabled).toBe(false));
  }
  fireEvent.change(screen.getByLabelText('Report Type'), { target: { value: 'safety-sobriety' } });
  expect((screen.getByLabelText('View') as HTMLSelectElement).value).toBe('details');
  expect(screen.getByLabelText('Sobriety Status')).toBeTruthy();
});
const data = { ...emptyReportSources,
  users: [{ id: 'rider', name: 'Ana', email: 'ana@example.com', role: 'rider' }],
  rides: [
    { id: 'ride', user_id: 'rider', start_time: '2026-09-02T10:00:00Z', initial_brac_level: 0.08, status: 'failed_brac', failure_reason: 'Recorded alcohol failure' },
    { id: 'ride2', user_id: 'rider', start_time: '2026-09-03T10:00:00Z', initial_brac_level: 0, status: 'completed' },
  ],
};

it('switches safety views, shows contextual filters and exports the displayed view', async () => {
  const onExport = vi.fn(async () => {});
  const { container } = render(<OrganizedReports data={data} threshold="0.05" styles={{}} onExport={onExport} />);
  const expectInlineSummaryOnly = () => {
    expect(container.querySelector('.reports-summary-inline')).toBeTruthy();
    expect(container.querySelector('.reports-summary:not(.reports-summary-inline)')).toBeNull();
  };
  expectInlineSummaryOnly();
  expect(screen.getByRole('heading', { name: 'Safety & Sobriety Report' })).toBeTruthy();
  expect(screen.queryByLabelText('Ride Status')).toBeNull();
  expect(screen.queryByLabelText('Ignition State')).toBeNull();
  expect(screen.queryByLabelText('Sort Order')).toBeNull();
  expect(screen.queryByRole('columnheader', { name: 'Ignition State' })).toBeNull();
  expect(screen.queryByRole('columnheader', { name: 'Ride Status' })).toBeNull();
  fireEvent.change(screen.getByLabelText('View'), { target: { value: 'failures' } });
  expectInlineSummaryOnly();
  expect(screen.queryByLabelText('Ride Status')).toBeNull();
  expect(screen.queryByLabelText('Ignition State')).toBeNull();
  expect(screen.getByLabelText('Failure / Lockout Type')).toBeTruthy();
  expect(screen.getByRole('columnheader', { name: 'Failure / Lockout Reason' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Export Excel' }));
  await waitFor(() => expect(onExport).toHaveBeenCalledOnce());
  expect(onExport.mock.calls[0]).toMatchObject([{ title: 'Failed Tests & Lockouts', view: 'failures', rows: [expect.arrayContaining(['0.08 BAC'])] }, 'excel']);
  fireEvent.change(screen.getByLabelText('View'), { target: { value: 'trends' } });
  expectInlineSummaryOnly();
  expect(screen.getByRole('heading', { name: 'Sobriety Trends' })).toBeTruthy();
  expect(screen.getByRole('img', { name: 'Number of tests by date, grouped by sobriety result' })).toBeTruthy();
  expect(screen.queryByLabelText('Failure / Lockout Type')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Date Range' }));
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2099-01-01' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply range' }));
  expect(screen.queryByRole('img')).toBeNull();
  expect(screen.getByText('No matching records')).toBeTruthy();
});

it('shows account filters only for master list and keeps missing device data empty', () => {
  render(<OrganizedReports data={data} threshold="0.05" styles={{}} onExport={vi.fn(async () => {})} />);
  const type = screen.getByLabelText('Report Type');
  expect(within(type).getAllByRole('option').map(option => option.textContent)).toEqual(['Safety & Sobriety Report', 'Rider Report', 'Admin Report', 'Motorcycle Report', 'Device Report']);
  fireEvent.change(type, { target: { value: 'rider' } });
  expect((screen.getByLabelText('View') as HTMLSelectElement).value).toBe('rider-master');
  expect(screen.queryByLabelText('Role')).toBeNull();
  expect(screen.getByLabelText('Face ID Status')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Date Range' })).toBeNull();
  expect(screen.queryByLabelText('Account Status')).toBeNull();
  fireEvent.change(type, { target: { value: 'device' } });
  expect(screen.getByLabelText('Search Device or Rider')).toBeTruthy();
  expect(screen.queryByLabelText('Ignition State')).toBeNull();
  expect(screen.queryByLabelText('Face ID Status')).toBeNull();
  expect(screen.queryByRole('columnheader', { name: 'SIM Card Slot' })).toBeNull();
  expect(screen.getByText('No matching records')).toBeTruthy();
});

it('applies the date range together, cancels drafts, clears filters, and exports newest first', async () => {
  const onExport = vi.fn(async () => {});
  const { container } = render(<OrganizedReports data={data} threshold="0.05" styles={{}} onExport={onExport} />);
  expect(container.querySelectorAll('.reports-stat')).toHaveLength(3);
  expect(container.querySelector('.reports-summary-inline')).toBeTruthy();
  expect(container.querySelector('.reports-summary-inline')?.textContent).not.toContain('Failed');
  expect(screen.getByText('1 Passed · 1 Failed · 0 Ongoing')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Date Range' }));
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-09-02' } });
  fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-09-02' } });
  expect(screen.getAllByRole('row')).toHaveLength(3);
  fireEvent.click(screen.getByRole('button', { name: 'Apply range' }));
  expect(screen.getAllByRole('row')).toHaveLength(2);
  expect(screen.getByText('0 Passed · 1 Failed · 0 Ongoing')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Date Range' }));
  fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-09-01' } });
  expect((screen.getByRole('button', { name: 'Apply range' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getAllByRole('row')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Date Range' }));
  fireEvent.click(screen.getByRole('button', { name: 'Clear range' }));
  expect(screen.getAllByRole('row')).toHaveLength(3);
  fireEvent.click(screen.getByRole('button', { name: 'Export Excel' }));
  await waitFor(() => expect(onExport).toHaveBeenCalledOnce());
  const exported = onExport.mock.calls[0] as unknown as [import('./report-snapshot').ReportSnapshot, string];
  expect(exported[0].rows.map(row => row[2])).toEqual(['0.00 BAC', '0.08 BAC']);
  expect(exported[0].filters).toContain('Newest first');
});
