import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { accountStatusValue, buildOrganizedReport, defaultReportFilters, humanLabel, reportControls } from './organized-report-data';
import type { ReportFilters, ReportSources } from './organized-report-data';
import { reportAreas } from './report-options';
import ReportPreview from './ReportPreview';
import ReportDateRange from './ReportDateRange';
import type { ReportSnapshot } from './report-snapshot';

export default function OrganizedReports({ data, threshold, styles, onExport }: {
  data: ReportSources; threshold: string; styles: Record<string, CSSProperties>;
  onExport: (snapshot: ReportSnapshot, format: 'pdf' | 'excel') => Promise<void>;
}) {
  const [type, setType] = useState('safety-sobriety');
  const [view, setView] = useState('details');
  const [filters, setFilters] = useState<ReportFilters>(defaultReportFilters);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const area = reportAreas.find(option => option.value === type) || reportAreas[0];
  const selectedView = area.views.find(option => option.value === view) || area.views[0];
  const reportType = selectedView.reportType;
  const controls = reportControls(reportType, selectedView.value);
  const report = useMemo(() => buildOrganizedReport(reportType, selectedView.value, data, filters, threshold), [reportType, selectedView.value, data, filters, threshold]);
  const change = (key: keyof ReportFilters, value: string) => setFilters(previous => ({ ...previous, [key]: value }));
  const select = (label: string, field: keyof ReportFilters, options: string[]) => <label>{label}<select style={styles.input} value={filters[field]} onChange={event => change(field, event.target.value)}>
    <option value="all">All</option>{options.map(value => <option key={value} value={value}>{value === 'superadmin' ? 'Super Admin' : humanLabel(value)}</option>)}
  </select></label>;
  return <div className="reports-page">
    <div style={styles.card}><div className="reports-filters">
      <label>{controls.devices ? 'Search Device or Rider' : controls.administrator ? 'Search Admin Name or Email' : 'Search Rider Name or Email'}<input type="search" style={styles.input} value={filters.search} onChange={event => change('search', event.target.value)} placeholder={controls.devices ? 'Search device, motorcycle, or rider...' : controls.administrator ? 'Search administrator name or email...' : 'Search rider name or email...'} /></label>
      <label>Report Type<select style={styles.input} value={type} onChange={event => {
        const next = reportAreas.find(option => option.value === event.target.value)!;
        setType(next.value); setView(next.views[0].value); setFilters(defaultReportFilters); setError('');
      }}>
        {reportAreas.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select></label>
      <label>View<select style={styles.input} value={selectedView.value} onChange={event => { setView(event.target.value); setFilters(defaultReportFilters); setError(''); }}>
        {area.views.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select></label>
      {controls.sobriety && select('Sobriety Status', 'sobriety', ['Sober', 'Not Sober'])}
      {controls.failure && <label>Failure / Lockout Type<select style={styles.input} value={filters.failure} onChange={event => change('failure', event.target.value)}><option value="all">All events</option><option value="sobriety">Sobriety Failures</option><option value="lockout">Lockouts</option></select></label>}
      {controls.adminRole && select('Admin Level', 'adminRole', ['admin', 'superadmin'])}
      {controls.account && <>
        {select('Face ID Status', 'face', ['Enrolled', 'Missing'])}
        {data.users.some(row => typeof row.status === 'string' && row.status) && select('Account Status', 'account', [...new Set(['active', 'not_active', ...data.users.map(row => accountStatusValue(row.status)).filter(Boolean)])])}
      </>}
      {controls.dates && <ReportDateRange key={`${type}:${view}`} start={filters.start} end={filters.end} inputStyle={styles.input}
        onChange={(start, end) => setFilters(previous => ({ ...previous, start, end }))} />}
    </div><div className="reports-filter-actions"><button style={styles.actionBtn} onClick={() => setFilters(defaultReportFilters)}>Clear filters</button></div></div>
    {error && <p role="alert">{error}</p>}
    <ReportPreview report={report} exporting={exporting} onExport={async format => {
      if (exporting) return;
      setExporting(true); setError('');
      try { await onExport(report, format); } catch (error) { setError(error instanceof Error ? error.message : 'Unable to export report.'); } finally { setExporting(false); }
    }} />
  </div>;
}
