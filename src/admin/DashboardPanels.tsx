import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { AuditLog, DashboardData } from './types';
import { activityLabel, areaLabel, performerLabel, relatedRecordLabel } from './audit-presentation';
import { sortAuditLogs } from './audit-records';
import { dashboardAlert, dashboardPeriods, dashboardSummary, dashboardTime } from './dashboard-presentation';
import type { DashboardPeriod } from './dashboard-presentation';
import './DashboardPage.css';

export default function DashboardPanels({ data, logs, updatedAt, styles, onNavigate }: {
  data: DashboardData | null;
  logs: AuditLog[];
  updatedAt: string | null;
  styles: Record<string, CSSProperties>;
  onNavigate: (tab: string) => void;
}) {
  const [period, setPeriod] = useState<DashboardPeriod>('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const summary = dashboardSummary(data?.sobrietySummary, updatedAt ? new Date(updatedAt) : new Date(), period, from, to);
  const alerts = data?.recentAlerts?.slice(0, 5) || [];
  const activities = sortAuditLogs(logs).slice(0, 5);
  const peak = summary.days.reduce((max, day) => Math.max(max, day.passed, day.failed), 1);
  const step = Math.max(1, Math.ceil(peak / 4));
  const ceiling = step * 4;
  const plot = { x: 60, y: 30, width: 630, height: 180 };
  const slot = plot.width / Math.max(1, summary.days.length);
  const barWidth = Math.min(14, slot * 0.32);
  const ticks = [...new Set(Array.from({ length: Math.min(5, summary.days.length) }, (_, i) => Math.round(i * (summary.days.length - 1) / Math.max(1, Math.min(5, summary.days.length) - 1))))];
  return <>
    <div className="dashboard-panels">
      <section className="dashboard-panel dashboard-summary-panel" style={styles.card} aria-labelledby="dashboard-summary-title">
        <div className="dashboard-panel-header">
          <h2 id="dashboard-summary-title">Sobriety Test Summary</h2>
          <label className="dashboard-period">Period<select aria-label="Sobriety summary period" value={period} onChange={event => setPeriod(event.target.value as DashboardPeriod)}>{Object.entries(dashboardPeriods).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        {period === 'custom' && <div className="dashboard-custom-range"><label>From<input type="date" value={from} max={to || undefined} onChange={event => setFrom(event.target.value)} /></label><label>To<input type="date" value={to} min={from || undefined} onChange={event => setTo(event.target.value)} /></label></div>}
        <p className="dashboard-caption">{summary.days.length ? `${summary.days[0].label} – ${summary.days[summary.days.length - 1].label} · Daily test results${period === 'week' ? ' · Week starts Monday' : ''}` : 'Select a valid start and end date.'}</p>
        <div className="dashboard-test-totals">
          <div><span><i className="dashboard-key dashboard-key-passed" />Passed</span><strong>{summary.passed.toLocaleString()}</strong><small>{summary.passedPercent}%</small></div>
          <div><span><i className="dashboard-key dashboard-key-failed" />Failed</span><strong>{summary.failed.toLocaleString()}</strong><small>{summary.failedPercent}%</small></div>
          <div><span>Total Tests</span><strong>{summary.total.toLocaleString()}</strong><small>Selected period</small></div>
        </div>
        <svg className="dashboard-chart" viewBox="0 0 720 270" role="img" aria-labelledby="dashboard-chart-title dashboard-chart-description">
          <title id="dashboard-chart-title">Passed and failed tests by date</title>
          <desc id="dashboard-chart-description">{dashboardPeriods[period]}. X-axis: Date. Y-axis: Number of Tests. {summary.passed} passed, {summary.failed} failed, {summary.total} total tests. Each pair of bars represents one day.</desc>
          {[0, 1, 2, 3, 4].map(index => {
            const y = plot.y + plot.height - index / 4 * plot.height;
            return <g key={index}><line x1={plot.x} x2={plot.x + plot.width} y1={y} y2={y} stroke="var(--border)" strokeDasharray={index ? '3 4' : undefined} /><text x={plot.x - 10} y={y + 4} textAnchor="end">{index * step}</text></g>;
          })}
          {summary.days.map((day, index) => <g key={day.key} tabIndex={0} aria-label={`${day.label}: ${day.passed} passed, ${day.failed} failed`}>
            <title>{day.label}: {day.passed} passed, {day.failed} failed</title>
            {(['passed', 'failed'] as const).map((result, offset) => {
              const height = day[result] / ceiling * plot.height;
              return <rect key={result} x={plot.x + (index + 0.5) * slot + (offset - 1) * barWidth} y={plot.y + plot.height - height} width={barWidth * 0.9} height={height} rx={Math.min(2, barWidth / 4)} fill={result === 'passed' ? 'var(--green)' : 'var(--red)'} />;
            })}
          </g>)}
          {ticks.map(index => <text key={index} x={plot.x + (index + 0.5) * slot} y={232} textAnchor="middle">{summary.days[index].label}</text>)}
          <text x={375} y={258} textAnchor="middle">Date</text>
          <text transform="translate(16 120) rotate(-90)" textAnchor="middle">Number of Tests</text>
        </svg>
        {!summary.total && <p className="dashboard-empty">No sobriety tests recorded in this period.</p>}
      </section>
      <section className="dashboard-panel" style={styles.card} aria-labelledby="dashboard-alerts-title">
        <div className="dashboard-panel-header"><h2 id="dashboard-alerts-title">Alerts Overview</h2><button className="dashboard-link" onClick={() => onNavigate('alerts')}>View All</button></div>
        <p className="dashboard-caption">Recent safety alerts</p>
        {!alerts.length ? <p className="dashboard-empty">No recent alerts</p> : <ul className="dashboard-feed">{alerts.map(alert => {
          const presentation = dashboardAlert(alert);
          const deviceId = alert.device_id == null ? '' : String(alert.device_id);
          return <li key={alert.id} className="dashboard-alert-item">
            <div><strong>{presentation.title}</strong><p>{alert.full_name || 'Unknown rider'} · <span title={deviceId || undefined}>{deviceId ? `DEV-${deviceId.slice(0, 8).toUpperCase()}` : 'Device not recorded'}</span></p><time dateTime={Number.isFinite(Date.parse(alert.created_at)) ? alert.created_at : undefined}>{dashboardTime(alert.created_at)}</time></div>
            <span className={`dashboard-severity${['high', 'critical'].includes(presentation.severity.toLowerCase()) ? ' dashboard-severity-high' : ''}`}>{activityLabel(presentation.severity)}</span>
          </li>;
        })}</ul>}
      </section>
      <section className="dashboard-panel dashboard-activities" style={styles.card} aria-labelledby="dashboard-activities-title">
        <div className="dashboard-panel-header"><h2 id="dashboard-activities-title">Recent Activities</h2><button className="dashboard-link" onClick={() => onNavigate('audit-logs')}>View Audit Log</button></div>
        {!activities.length ? <p className="dashboard-empty">No recent activities</p> : <ul className="dashboard-feed">{activities.map(log => <li key={log.id} className="dashboard-activity-item">
          <div><strong>{activityLabel(log.action)}</strong><div className="dashboard-activity-meta"><span>{performerLabel(log)}</span><span>Area: {areaLabel(log.module)}</span>
            {log.target_record && log.target_record !== 'Not Recorded' ? <details><summary>Related Record: {relatedRecordLabel(log.target_record)}</summary><div className="dashboard-full-record">{log.target_record}</div></details> : <span>Related Record: Not Recorded</span>}
          </div></div>
          <time dateTime={Number.isFinite(Date.parse(log.created_at)) ? log.created_at : undefined}>{dashboardTime(log.created_at)}</time>
        </li>)}</ul>}
      </section>
    </div>
    <p className="dashboard-update">{updatedAt ? <>Summary &amp; alerts auto-refresh every 5 seconds · Last updated: <time dateTime={updatedAt}>{dashboardTime(updatedAt)}</time></> : 'Waiting for dashboard summary update'}</p>
  </>;
}
