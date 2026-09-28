import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import DashboardPanels from './DashboardPanels';
import { dashboardSummary } from './dashboard-presentation';
import type { DashboardData } from './types';

afterEach(cleanup);

it('plots daily counts on one scale, keeps genuine ties equal, and exposes exact counts including zeros', () => {
  const daily = { ...data, sobrietySummary: [
    { date: '2026-09-10', passed: 7, failed: 0 },
    { date: '2026-09-18', passed: 0, failed: 2 },
    { date: '2026-09-19', passed: 7, failed: 7 },
  ] };
  const before = JSON.stringify(daily);
  const { container } = render(<DashboardPanels {...props} data={daily} />);
  const day = (date: string) => container.querySelector(`[data-date="${date}"]`)!;
  const height = (date: string, result: string) => Number(day(date).querySelector(`[data-result="${result}"]`)!.getAttribute('height'));
  expect(height('2026-09-10', 'passed') / height('2026-09-18', 'failed')).toBeCloseTo(7 / 2);
  expect(height('2026-09-10', 'failed')).toBe(0);
  expect(height('2026-09-18', 'passed')).toBe(0);
  expect(height('2026-09-19', 'passed')).toBe(height('2026-09-19', 'failed'));
  expect(height('2026-09-10', 'passed')).toBe(7 / 8 * 180);
  fireEvent.mouseEnter(day('2026-09-18'));
  const details = screen.getByRole('status');
  expect(within(details).getByText('Passed: 0')).toBeTruthy();
  expect(within(details).getByText('Failed: 2')).toBeTruthy();
  expect(within(details).getByText('Total: 2')).toBeTruthy();
  fireEvent.focus(day('2026-09-11'));
  expect(within(details).getByText('Total: 0')).toBeTruthy();
  expect(container.querySelector('.dashboard-test-totals')?.textContent).toContain('Total Tests23');
  fireEvent.change(screen.getByLabelText('Sobriety summary period'), { target: { value: 'custom' } });
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-09-18' } });
  fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-09-18' } });
  expect(container.querySelectorAll('.dashboard-chart-day')).toHaveLength(1);
  expect(height('2026-09-18', 'failed')).toBe(2 / 4 * 180);
  expect(JSON.stringify(daily)).toBe(before);
});
const data: DashboardData = {
  totalRiders: 7, totalMotorcycles: 4, activeDevices: 2, recentOverrides: 3, todaysRides: 1, failedTests: 14,
  sobrietySummary: [{ date: '2026-09-26', passed: '49', failed: '14' }],
  recentAlerts: [{ id: 'ride-1', created_at: '', full_name: 'Jenna Diaz', email: '', brac: '', status: 'failed_face', device_id: '16c0517d-aaaa-bbbb-cccc-123456789012', motorcycle_id: 'wrong-device', severity: 'Medium' }],
};
const target = 'Ride: d8208ae2-48bb-5af0-af01-b303dbf5ade4';
const logs = [{ id: 1, created_at: '2026-09-26T14:50:00Z', action: 'alert_resolved', module: 'alert', admin_name: 'Jenna Diaz', target_record: target }];
const props = { data, logs, updatedAt: '2026-09-27T12:00:00Z', styles: {}, onNavigate: vi.fn() };

it('uses the same supported 30-day period for chart, totals and percentages across month boundaries', () => {
  const summary = dashboardSummary([
    { date: '2026-08-29', passed: 4, failed: 1 },
    { date: '2026-09-27', passed: 5, failed: 0 },
    { date: '2026-08-28', passed: 100, failed: 100 },
    { date: '2026-09-28', passed: 100, failed: 100 },
  ], new Date(2026, 8, 27, 12));
  expect(summary.days).toHaveLength(30);
  expect(summary).toMatchObject({ passed: 9, failed: 1, total: 10, passedPercent: '90.0', failedPercent: '10.0' });
  render(<DashboardPanels {...props} />);
  expect((screen.getByRole('combobox', { name: 'Sobriety summary period' }) as HTMLSelectElement).value).toBe('month');
  expect(screen.getByText('77.8%')).toBeTruthy();
  expect(screen.getByText('22.2%')).toBeTruthy();
  expect(screen.getByText('63')).toBeTruthy();
  expect(screen.getByText('Number of Tests')).toBeTruthy();
  expect(screen.getByText('Date')).toBeTruthy();
});

it('changes the displayed totals and chart for every period including historical custom dates', () => {
  const history = { ...data, sobrietySummary: [
    { date: '2026-08-29', passed: 10, failed: 0 },
    { date: '2026-09-01', passed: 20, failed: 0 },
    { date: '2026-09-21', passed: 3, failed: 1 },
    { date: '2026-09-27', passed: 2, failed: 0 },
    { date: '2025-01-01', passed: 7, failed: 2 },
  ] };
  render(<DashboardPanels {...props} data={history} />);
  const select = screen.getByLabelText('Sobriety summary period');
  const description = () => document.getElementById('dashboard-chart-description')!.textContent;
  expect(description()).toContain('26 total tests');
  fireEvent.change(select, { target: { value: 'today' } });
  expect(description()).toContain('2 total tests');
  fireEvent.change(select, { target: { value: 'week' } });
  expect(description()).toContain('6 total tests');
  fireEvent.change(select, { target: { value: 'last30' } });
  expect(description()).toContain('36 total tests');
  fireEvent.change(select, { target: { value: 'custom' } });
  expect(screen.getByText('Select a valid start and end date.')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2025-01-01' } });
  fireEvent.change(screen.getByLabelText('To'), { target: { value: '2025-01-01' } });
  expect(description()).toContain('9 total tests');
  expect(screen.getByText('77.8%')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('To'), { target: { value: '2024-12-31' } });
  expect(screen.getByText('Select a valid start and end date.')).toBeTruthy();
});

it('humanizes audit values, retains the full record, and routes to existing pages', () => {
  const onNavigate = vi.fn();
  render(<DashboardPanels {...props} onNavigate={onNavigate} />);
  const activities = screen.getByRole('region', { name: 'Recent Activities' });
  expect(within(activities).getByText('Alert Resolved')).toBeTruthy();
  expect(within(activities).getByText('Jenna Diaz')).toBeTruthy();
  expect(within(activities).getByText('Area: Alerts')).toBeTruthy();
  expect(within(activities).getByText('Related Record: Ride · d8208ae2...')).toBeTruthy();
  expect(within(activities).getByText(target)).toBeTruthy();
  expect(activities.textContent).not.toContain('alert_resolved');
  fireEvent.click(screen.getByText('View All'));
  fireEvent.click(screen.getByText('View Audit Log'));
  expect(onNavigate.mock.calls).toEqual([['alerts'], ['audit-logs']]);
  expect(logs[0].action).toBe('alert_resolved');
});

it('uses the actual device ID, preserves severity, and never fabricates alert times', () => {
  render(<DashboardPanels {...props} />);
  const alerts = screen.getByRole('region', { name: 'Alerts Overview' });
  expect(within(alerts).getByText('Identity Verification Failed')).toBeTruthy();
  expect(within(alerts).getByText('Medium')).toBeTruthy();
  expect(within(alerts).getByText('DEV-16C0517D').getAttribute('title')).toBe(data.recentAlerts![0].device_id);
  expect(alerts.textContent).not.toContain('wrong-device');
  expect(within(alerts).getByText('Not Recorded')).toBeTruthy();
  expect(screen.getByText(/Summary & alerts auto-refresh/).querySelector('time')?.getAttribute('datetime')).toBe(props.updatedAt);
});

it('shows honest empty states and does not invent a refresh timestamp', () => {
  render(<DashboardPanels {...props} data={null} logs={[]} updatedAt={null} />);
  expect(screen.getByText('No recent alerts')).toBeTruthy();
  expect(screen.getByText('No recent activities')).toBeTruthy();
  expect(screen.getByText('No sobriety tests recorded in this period.')).toBeTruthy();
  expect(screen.getByText('Waiting for dashboard summary update')).toBeTruthy();
  expect(screen.getAllByText('0.0%')).toHaveLength(2);
});
