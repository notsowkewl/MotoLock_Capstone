import type { ReportRow } from './types';
import { reportOptions } from './report-options';

export const rideReportTypes = ['sobriety-test', 'alcohol-detection', 'failed-sobriety', 'rider-safety', 'sobriety-trend', 'alert-summary', 'safety-incident', 'critical-incident', 'resolved-incident', 'incident-resolution', 'alert-trend', 'comp-safety'];
export const userReportTypes = ['rider-master', 'rider-activity', 'rider-safety-hist', 'rider-incident-hist', 'rider-reg', 'admin-list', 'user-activity', 'role-permission', 'login-history', 'failed-login', 'account-status', 'comp-system'];
export interface ReportSnapshot {
  summary?: { label: string; value: string | number }[];
  note?: string;
  view?: string;
  chart?: { date: string; total: number; sober: number; notSober: number }[];
  type: string;
  title: string;
  generatedAt: string;
  coverage: string;
  filters: string;
  alcoholThreshold?: string;
  sortOrder?: string;
  hasFilters?: boolean;
  headers: string[];
  rows: string[][];
}
export const reportDate = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : 'Not Recorded';
export function reportRideStatus(row: ReportRow): string {
  const status = (row.status || '').trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/^ride_/, '');
  if (['ongoing', 'in_progress', 'started', 'pending', 'testing', 'verifying'].includes(status)) return 'Ongoing';
  if (['passed', 'completed', 'cleared'].includes(status)) return 'Passed';
  if (['failed', 'failed_brac', 'failed_face', 'failed_helmet', 'failed_identity', 'verification_failed', 'completed_with_issues', 'restricted'].includes(status)) return 'Failed';
  return 'Not Recorded';
}

export function createReportSnapshot(type: string, records: ReportRow[], metadata: Pick<ReportSnapshot, 'coverage' | 'filters'> & Partial<Pick<ReportSnapshot, 'alcoholThreshold' | 'sortOrder' | 'hasFilters'>>): ReportSnapshot {
  const rides = rideReportTypes.includes(type);
  const users = userReportTypes.includes(type);
  const sortedRecords = records.map((record, index) => ({
    record,
    index,
    timestamp: record.created_at ? Date.parse(record.created_at) : NaN,
  })).sort((a, b) => {
    const aValid = Number.isFinite(a.timestamp);
    const bValid = Number.isFinite(b.timestamp);
    if (aValid && bValid && a.timestamp !== b.timestamp) return metadata.sortOrder === 'oldest' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp;
    if (aValid !== bValid) return aValid ? -1 : 1;
    return a.index - b.index;
  }).map(item => item.record);
  return {
    type, title: reportOptions.find(option => option.value === type)?.label || ({ 'alcohol-detection': 'Alcohol Detection Report', 'sobriety-test': 'Sobriety Test Report' } as Record<string, string>)[type] || 'MotoLock Report',
    generatedAt: new Date().toISOString(), ...metadata,
    headers: rides ? ['Date & Time', 'Rider Details', 'BAC Level', 'Sobriety Status', 'Failure Reason']
      : users ? ['Rider Name', 'Email', 'Role', 'Face ID'] : ['Timestamp', 'Record ID', 'Details'],
    rows: sortedRecords.map(row => {
      if (rides) {
        const reading = row.brac?.trim() ? Number(row.brac) : NaN;
        const tested = Number.isFinite(reading) && reading >= 0;
        const configuredThreshold = Number(metadata.alcoholThreshold);
        const threshold = Number.isFinite(configuredThreshold) && configuredThreshold >= 0 ? configuredThreshold : 0.05;
        return [reportDate(row.created_at), [row.full_name || 'Not Recorded', row.email].filter(Boolean).join('\n'),
          tested ? `${reading.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 20, useGrouping: false })} BAC` : 'Not Tested', tested ? reading > threshold ? 'Not Sober' : 'Sober' : 'Not Tested',
          row.failure_reason?.trim() || 'Not Recorded'];
      }
      if (users) return [row.full_name || 'Not Recorded', row.email || 'Not Recorded', row.role || 'Not Recorded', row.face_enrolled ? 'Enrolled' : 'Missing'];
      return [reportDate(row.created_at), `ID-${row.id}`, row.action || row.model || row.unlock_status || 'System Log Activity'];
    }),
  };
}
export function reportCellColor(value: string): string | undefined {
  if (['Sober', 'Enrolled'].includes(value)) return '#16804a';
  if (['Not Sober', 'Failed', 'Missing'].includes(value)) return '#c91e30';
  if (['Not Tested', 'Not Recorded'].includes(value)) return '#6b7280';
}
