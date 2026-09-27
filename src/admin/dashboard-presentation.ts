import type { DashboardData, SafetyLog } from './types';

const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const dashboardPeriods = { today: 'Today', week: 'This Week', month: 'This Month', last30: 'Last 30 Days', custom: 'Custom Range' };
export type DashboardPeriod = keyof typeof dashboardPeriods;

export function dashboardSummary(summary: DashboardData['sobrietySummary'] = [], now = new Date(), period: DashboardPeriod = 'last30', from = '', to = '') {
  let end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start = new Date(end);
  if (period === 'last30') start.setDate(start.getDate() - 29);
  if (period === 'week') start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  if (period === 'month') start.setDate(1);
  if (period === 'custom') { start = new Date(`${from}T00:00:00`); end = new Date(`${to}T00:00:00`); }
  const valid = Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && start <= end;
  const entries = new Map(summary.map(item => [item.date.slice(0, 10), item]));
  const days = [];
  for (const date = new Date(start); valid && date <= end; date.setDate(date.getDate() + 1)) {
    const key = dayKey(date);
    const entry = entries.get(key);
    days.push({ key, label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), passed: Number(entry?.passed || 0), failed: Number(entry?.failed || 0) });
  }
  const passed = days.reduce((sum, day) => sum + day.passed, 0);
  const failed = days.reduce((sum, day) => sum + day.failed, 0);
  const total = passed + failed;
  return { days, passed, failed, total, passedPercent: total ? (passed / total * 100).toFixed(1) : '0.0', failedPercent: total ? (failed / total * 100).toFixed(1) : '0.0' };
}

export const dashboardTime = (value: string) => Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Not Recorded';

export function dashboardAlert(alert: SafetyLog) {
  // Preserve the dashboard's existing alert classification and severity fallback.
  if (alert.alcohol_detected || alert.status === 'failed_brac' || parseFloat(alert.brac) >= 0.05) return { title: 'High Alcohol Detected', severity: alert.severity || alert.severity_level || 'High' };
  if (alert.face_verified === false || alert.status === 'failed_face') return { title: 'Identity Verification Failed', severity: alert.severity || alert.severity_level || 'Medium' };
  if (alert.helmet_verified === false || alert.status === 'failed_helmet') return { title: 'Helmet Safety Lockout', severity: alert.severity || alert.severity_level || 'Medium' };
  return { title: 'Safety Alert', severity: alert.severity || alert.severity_level || 'Low' };
}
