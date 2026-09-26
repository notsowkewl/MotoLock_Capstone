import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { AuditLog } from './types';
import { sortAuditLogs } from './audit-records';
import { activityLabel, areaLabel, performerLabel, relatedRecordLabel } from './audit-presentation';

export default function AuditLogsPage({ logs, styles }: { logs: AuditLog[]; styles: Record<string, CSSProperties> }) {
  const [search, setSearch] = useState('');
  const [module, setModule] = useState('');
  const [action, setAction] = useState('');
  const [admin, setAdmin] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const change = (setter: (value: string) => void, value: string) => { setter(value); setPage(1); };
  const query = search.trim().toLowerCase();
  const filtered = sortAuditLogs(logs.filter(log => {
    const date = new Date(log.created_at);
    const day = Number.isFinite(date.getTime()) ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : '';
    return (!module || log.module === module) && (!action || log.action === action) && (!admin || log.admin_name === admin)
      && (!from || !!day && day >= from) && (!to || !!day && day <= to)
      && (!query || [log.admin_name, log.action, log.module, log.target_record, log.created_at].some(value => value?.toLowerCase().includes(query)));
  }), sort === 'oldest');
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const current = Math.min(page, pages);
  const start = (current - 1) * 20;
  const firstPage = Math.max(1, Math.min(current - 2, pages - 4));
  const labelStyle: CSSProperties = { display: 'grid', gap: 8, minWidth: 160, flex: '1 1 160px', fontSize: 13, fontWeight: 600 };
  return <div>
    <div style={{ ...styles.card, display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: 16, marginBottom: 16 }}>
      <label style={labelStyle}>Search Logs<input type="search" placeholder="Search people, activities, areas or records" value={search} onChange={e => change(setSearch, e.target.value)} style={styles.input} /></label>
      {([
        ['Area', 'module', module, setModule], ['Activity', 'action', action, setAction], ['Performed By', 'admin_name', admin, setAdmin],
      ] as const).map(([label, field, selected, setter]) => <label key={field} style={labelStyle}>{label}
        <select value={selected} onChange={e => change(setter, e.target.value)} style={styles.input}>
          <option value="">{field === 'module' ? 'All Areas' : field === 'action' ? 'All Activities' : 'Everyone'}</option>
          {[...new Set(logs.map(log => log[field]).filter((v): v is string => !!v))].sort().map(v => <option key={v} value={v}>{field === 'module' ? areaLabel(v) : field === 'action' ? activityLabel(v) : v === 'MotoLock Developers' && logs.filter(log => log.admin_name === v).every(log => performerLabel(log) === 'System') ? 'System' : v}</option>)}
        </select>
      </label>)}
      <label style={labelStyle}>From Date<input type="date" value={from} max={to || undefined} onChange={e => change(setFrom, e.target.value)} style={styles.input} /></label>
      <label style={labelStyle}>To Date<input type="date" value={to} min={from || undefined} onChange={e => change(setTo, e.target.value)} style={styles.input} /></label>
      <label style={labelStyle}>Sort Order<select value={sort} onChange={e => change(setSort, e.target.value)} style={styles.input}><option value="newest">Newest to Oldest</option><option value="oldest">Oldest to Newest</option></select></label>
      <button type="button" style={{ ...styles.actionBtn, minHeight: 42, whiteSpace: 'nowrap' }} onClick={() => { setSearch(''); setModule(''); setAction(''); setAdmin(''); setFrom(''); setTo(''); setSort('newest'); setPage(1); }}>Clear Filters</button>
    </div>
    <div style={{ ...styles.card, overflowX: 'auto' }}>
      <table style={styles.table}>
        <thead><tr>{['Date & Time', 'Performed By', 'Activity', 'Area', 'Related Record'].map(title => <th key={title} style={{ ...styles.tableHeader, textTransform: 'none' }}>{title}</th>)}</tr></thead>
        <tbody>{filtered.slice(start, start + 20).map(log => <tr key={log.id}>
          <td style={styles.tableCell}>{Number.isFinite(Date.parse(log.created_at)) ? new Date(log.created_at).toLocaleString() : 'Not Recorded'}</td>
          <td style={styles.tableCell} title={log.admin_name}>{performerLabel(log)}</td>
          <td style={styles.tableCell}><strong>{activityLabel(log.action)}</strong></td>
          <td style={styles.tableCell}><span style={{ display: 'inline-block', padding: '4px 9px', borderRadius: 6, background: 'var(--bg)', color: 'var(--muted)', fontSize: 12 }}>{areaLabel(log.module)}</span></td>
          <td style={{ ...styles.tableCell, overflowWrap: 'anywhere' }}><span tabIndex={0} title={log.target_record} aria-label={log.target_record}>{relatedRecordLabel(log.target_record)}</span></td>
        </tr>)}{!filtered.length && <tr><td colSpan={5} style={{ ...styles.tableCell, textAlign: 'center', color: 'var(--muted)' }}>No audit logs match the selected filters.</td></tr>}</tbody>
      </table>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginTop: 16 }}>
        <span role="status" style={{ fontSize: 13, color: 'var(--muted)' }}>Showing {filtered.length ? start + 1 : 0}–{Math.min(start + 20, filtered.length)} of {filtered.length} logs</span>
        <nav aria-label="Audit log pagination" style={{ display: 'flex', gap: 6 }}>
          <button type="button" style={styles.actionBtn} aria-label="Previous page" disabled={current === 1} onClick={() => setPage(current - 1)}>‹</button>
          {Array.from({ length: Math.min(5, pages) }, (_, i) => firstPage + i).map(number => <button type="button" key={number} aria-label={`Page ${number}`} aria-current={current === number ? 'page' : undefined} style={{ ...styles.actionBtn, ...(current === number ? { background: 'var(--red)', color: '#fff' } : {}) }} onClick={() => setPage(number)}>{number}</button>)}
          <button type="button" style={styles.actionBtn} aria-label="Next page" disabled={current === pages} onClick={() => setPage(current + 1)}>›</button>
        </nav>
      </div>
    </div>
  </div>;
}
