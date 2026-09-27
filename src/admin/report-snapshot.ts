import type { ReportRow } from './types';
import { reportOptions } from './report-options';

export const rideReportTypes = ['sobriety-test', 'alcohol-detection', 'failed-sobriety', 'rider-safety', 'sobriety-trend', 'alert-summary', 'safety-incident', 'critical-incident', 'resolved-incident', 'incident-resolution', 'alert-trend', 'comp-safety'];
export const userReportTypes = ['rider-master', 'rider-activity', 'rider-safety-hist', 'rider-incident-hist', 'rider-reg', 'admin-list', 'user-activity', 'role-permission', 'login-history', 'failed-login', 'account-status', 'comp-system'];
export interface ReportSnapshot {
  type: string;
  title: string;
  generatedAt: string;
  coverage: string;
  filters: string;
  alcoholThreshold?: string;
  headers: string[];
  rows: string[][];
}
export const reportDate = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : 'Not Recorded';
const phone = (value?: string) => !value ? '—' : value.length < 7 ? value : value.slice(0, 3) + '*'.repeat(value.length - 5) + value.slice(-2);
export function createReportSnapshot(type: string, records: ReportRow[], metadata: Pick<ReportSnapshot, 'coverage' | 'filters'> & Partial<Pick<ReportSnapshot, 'alcoholThreshold'>>): ReportSnapshot {
  const rides = rideReportTypes.includes(type);
  const users = userReportTypes.includes(type);
  const sortedRecords = records.map((record, index) => ({
    record,
    index,
    timestamp: record.created_at ? Date.parse(record.created_at) : NaN,
  })).sort((a, b) => {
    const aValid = Number.isFinite(a.timestamp);
    const bValid = Number.isFinite(b.timestamp);
    if (aValid && bValid && a.timestamp !== b.timestamp) return b.timestamp - a.timestamp;
    if (aValid !== bValid) return aValid ? -1 : 1;
    return a.index - b.index;
  }).map(item => item.record);
  return {
    type, title: reportOptions.find(option => option.value === type)?.label || 'MotoLock Report',
    generatedAt: new Date().toISOString(), ...metadata,
    headers: rides ? ['Date', 'Rider', 'BrAC Level', 'Sobriety Status']
      : users ? ['Rider Name', 'Email', 'Phone', 'Role', 'Face ID'] : ['Timestamp', 'Record ID', 'Details'],
    rows: sortedRecords.map(row => {
      if (rides) {
        const reading = row.brac?.trim() ? Number(row.brac) : NaN;
        const tested = Number.isFinite(reading) && reading >= 0;
        const configuredThreshold = Number(metadata.alcoholThreshold);
        const threshold = Number.isFinite(configuredThreshold) && configuredThreshold >= 0 ? configuredThreshold : 0.05;
        return [reportDate(row.created_at), [row.full_name, row.email ? `(${row.email})` : ''].filter(Boolean).join(' ') || 'Not Recorded',
          tested ? `${row.brac} BAC` : 'Not Tested', tested ? reading > threshold ? 'Intoxicated' : 'Sober' : 'Not Tested'];
      }
      if (users) return [row.full_name || 'Not Recorded', row.email || 'Not Recorded', phone(row.phone), row.role || 'Not Recorded', row.face_enrolled ? 'Enrolled' : 'Missing'];
      return [reportDate(row.created_at), `ID-${row.id}`, row.action || row.model || row.unlock_status || 'System Log Activity'];
    }),
  };
}
export function reportCellColor(value: string): string | undefined {
  if (['Sober', 'Enrolled'].includes(value)) return '#16804a';
  if (value === 'Intoxicated') return '#c91e30';
  if (['Not Tested', 'Missing', 'Not Recorded'].includes(value)) return '#6b7280';
}
