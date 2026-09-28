import { useMemo, useState } from 'react';
import type { AuditLog, Device, Rider, SafetyLog } from './types';
import { activityLabel, areaLabel, performerLabel } from './audit-presentation';
import { dashboardAlert } from './dashboard-presentation';
import './DashboardSearch.css';

type Result = { id: string; title: string; detail: string; page: string; tab: string; search: string };
const pages = [
  ['live-monitoring', 'Live Monitoring'], ['riders', 'Riders'], ['devices', 'MotoLock Devices'],
  ['sobriety', 'Sobriety Tests'], ['identity', 'Identity Verification'], ['alerts', 'Alerts & Incidents'],
  ['reports', 'Reports'], ['audit-logs', 'Audit Logs'], ['settings', 'Settings'],
] as const;

export default function DashboardSearch({ riders, devices, rides, logs, onNavigate }: {
  riders: Rider[]; devices: Device[]; rides: SafetyLog[]; logs: AuditLog[]; onNavigate: (tab: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(8);
  const records = useMemo(() => {
    const result: Result[] = [];
    const add = (id: string, title: string, detail: string, tab: string, page: string, extra = '') => result.push({ id, title, detail, tab, page, search: `${title} ${detail} ${page} ${extra}`.toLowerCase() });
    pages.forEach(([tab, page]) => add(`page-${tab}`, page, 'Open admin page', tab, page));
    riders.forEach(rider => add(`rider-${rider.id}`, rider.full_name || rider.name || 'Name not available', [rider.email, `User ID: ${rider.id}`].filter(Boolean).join(' · '), 'riders', 'Riders', [rider.phone, ...rider.motorcycles?.map(motorcycle => `${motorcycle.plate_number} ${motorcycle.model}`) || []].join(' ')));
    devices.forEach(device => add(`device-${device.id}`, `DEV-${String(device.id).slice(0, 8).toUpperCase()}`, [device.rider_name, `Device ID: ${device.id}`].filter(Boolean).join(' · '), 'live-monitoring', 'Live Monitoring', `${device.user_id} ${device.model || ''}`));
    rides.forEach(ride => {
      add(`ride-${ride.id}`, `${ride.full_name || 'Unknown rider'} · ${activityLabel(ride.status)}`, `Ride: ${ride.id}${ride.brac ? ` · ${ride.brac} BAC` : ''}`, 'sobriety', 'Sobriety Tests', `${ride.email} ${ride.status} ${ride.device_id || ''}`);
      if (['failed_brac', 'failed_face', 'failed_helmet'].includes(ride.status) || ride.alcohol_detected) {
        const alert = dashboardAlert(ride);
        add(`alert-${ride.id}`, alert.title, `${ride.full_name || 'Unknown rider'} · Ride: ${ride.id}`, 'alerts', 'Alerts & Incidents', `${ride.email} ${ride.device_id || ''}`);
      }
    });
    logs.forEach(log => add(`log-${log.id}`, activityLabel(log.action), `${performerLabel(log)} · ${areaLabel(log.module)} · ${log.target_record || 'Not Recorded'}`, 'audit-logs', 'Audit Logs', `${log.action} ${log.module}`));
    return result;
  }, [riders, devices, rides, logs]);
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = terms.length ? records.filter(record => terms.every(term => record.search.includes(term))) : [];
  return <section className="dashboard-search" aria-label="Overall dashboard search">
    <label htmlFor="dashboard-search-input">Search MotoLock</label>
    <div className="dashboard-search-field"><input id="dashboard-search-input" type="search" placeholder="Search riders, devices, tests, alerts, audit logs or pages..." value={query} onChange={event => { setQuery(event.target.value); setLimit(8); }} onKeyDown={event => { if (event.key === 'Escape') setQuery(''); }} aria-describedby="dashboard-search-help" />
      {query && <button type="button" onClick={() => setQuery('')}>Clear</button>}
    </div>
    <p id="dashboard-search-help">Search loaded records by name, email, device ID, SIM, plate number or activity.</p>
    {!!terms.length && <div className="dashboard-search-results">
      <p role="status">{matches.length ? `${matches.length} results · Showing ${Math.min(limit, matches.length)}` : 'No matching records or pages. Try another name, ID or keyword.'}</p>
      <ul>{matches.slice(0, limit).map(result => <li key={result.id}>
        <div><strong>{result.title}</strong><p>{result.detail}</p></div>
        <button type="button" onClick={() => onNavigate(result.tab)}>Open {result.page}</button>
      </li>)}</ul>
      {matches.length > limit && <button type="button" className="dashboard-search-more" onClick={() => setLimit(previous => previous + 8)}>Show more results</button>}
    </div>}
  </section>;
}
