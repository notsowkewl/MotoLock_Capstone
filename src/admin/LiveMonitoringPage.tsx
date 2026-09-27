import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Device } from './types';
import './LiveMonitoringPage.css';

const shortId = (id: Device['id']) => `DEV-${String(id).slice(0, 8).toUpperCase()}`;
const shortUser = (id: string) => id.length > 8 ? `${id.slice(0, 8)}…` : id;
const reading = (value: unknown) => value === true || value === 1 ? true : value === false || value === 0 ? false : null;
const lockLabel = (device: Device) => reading(device.is_locked) === null ? 'Not Recorded' : reading(device.is_locked) ? 'Locked' : 'Unlocked';
const relayLabel = (device: Device) => reading(device.relay_status) === null ? 'Not Recorded' : reading(device.relay_status) ? 'Active' : 'Locked';

export default function LiveMonitoringPage({ devices, styles, onRefresh, lockIcon }: {
  devices: Device[];
  styles: Record<string, CSSProperties>;
  onRefresh: () => Promise<void>;
  lockIcon: (locked: boolean) => ReactNode;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [selectedId, setSelectedId] = useState<Device['id'] | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const selected = devices.find(device => device.id === selectedId);
  useEffect(() => {
    if (selected && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [selected]);
  const query = search.trim().toLowerCase();
  const filtered = devices.filter(device => [String(device.id), shortId(device.id), device.user_id, device.rider_name].some(value => value?.toLowerCase().includes(query)) && (status === 'All' || lockLabel(device) === status));
  const rider = (device: Device, full = false) => <div className="monitoring-rider">
    <strong>{device.rider_name && device.rider_name !== 'Unassigned' ? device.rider_name : device.user_id ? 'Name not available' : 'Unassigned'}</strong>
    {device.user_id && <span title={device.user_id}>User ID: {full ? device.user_id : shortUser(device.user_id)}</span>}
  </div>;
  const badge = (label: string, lock = false) => <span
    title={lock && label === 'Not Recorded' ? 'Lock status is unavailable or not recognized.' : undefined}
    aria-label={lock && label === 'Not Recorded' ? 'Not Recorded. Lock status is unavailable or not recognized.' : undefined}
    tabIndex={lock && label === 'Not Recorded' ? 0 : undefined}
    className={`monitoring-status${label === 'Locked' ? ' monitoring-status-locked' : ''}`}>
    {lock && label !== 'Not Recorded' && lockIcon(label === 'Locked')}{label}
  </span>;
  const close = () => { dialog.current?.close(); setSelectedId(null); };

  return <section className="monitoring-page" aria-label="Live Monitoring devices">
    <div className="monitoring-toolbar">
      <div className="monitoring-context"><span className="monitoring-dot" aria-hidden="true" />Device monitoring · Manual refresh</div>
      <button type="button" style={styles.actionBtn} disabled={refreshing} onClick={async () => {
        setRefreshing(true); setRefreshError('');
        try { await onRefresh(); } catch { setRefreshError('Unable to refresh devices. Please try again.'); } finally { setRefreshing(false); }
      }}>{refreshing ? 'Refreshing…' : '↻ Refresh'}</button>
    </div>
    {refreshError && <p role="alert">{refreshError}</p>}
    <div className="monitoring-summary" aria-label="Monitoring summary">
      <span><strong>{devices.length}</strong> Devices</span>
      <span><strong>{devices.filter(device => lockLabel(device) === 'Unlocked').length}</strong> Unlocked</span>
      <span><strong>{devices.filter(device => lockLabel(device) === 'Locked').length}</strong> Locked</span>
      {devices.some(device => lockLabel(device) === 'Not Recorded') && <span><strong>{devices.filter(device => lockLabel(device) === 'Not Recorded').length}</strong> Not Recorded</span>}
    </div>
    <div style={styles.card}>
      <div className="monitoring-filters">
        <label>Search<input type="search" placeholder="Search device or rider..." value={search} onChange={event => setSearch(event.target.value)} style={styles.input} /></label>
        <label>Lock Status<select value={status} onChange={event => setStatus(event.target.value)} style={styles.input}>{['All', 'Locked', 'Unlocked'].map(value => <option key={value}>{value}</option>)}</select></label>
      </div>
      <p className="monitoring-note">Relay Control shows the relay state; Lock Status shows whether the lock is engaged or released.</p>
      <div className="monitoring-table-scroll"><table style={styles.table}>
        <colgroup>{['21%', '13%', '16%', '16%', '25%', '9%'].map((width, i) => <col key={i} style={{ width }} />)}</colgroup>
        <thead><tr>{['Device ID', 'SIM Card Slot', 'Relay Control', 'Lock Status', 'Assigned Rider', 'Actions'].map(header => <th scope="col" key={header} style={styles.tableHeader}>{header}</th>)}</tr></thead>
        <tbody>{filtered.map(device => <tr key={device.id}>
          <td style={styles.tableCell}><code title={String(device.id)}>{shortId(device.id)}</code></td>
          <td style={styles.tableCell}>{device.sim_number || 'N/A'}</td>
          <td style={styles.tableCell}>{badge(relayLabel(device))}</td>
          <td style={styles.tableCell}>{badge(lockLabel(device), true)}</td>
          <td style={styles.tableCell}>{rider(device)}</td>
          <td style={styles.tableCell}><button type="button" style={styles.actionBtn} aria-label={`View device ${device.id}`} onClick={() => setSelectedId(device.id)}>Details</button></td>
        </tr>)}{!filtered.length && <tr><td colSpan={6} style={styles.tableCell}><div className="monitoring-empty">{devices.length ? 'No devices match your search or lock status filter.' : 'No devices registered in the system.'}</div></td></tr>}</tbody>
      </table></div>
    </div>
    {selected && <dialog ref={dialog} className="monitoring-dialog" aria-labelledby="monitoring-details-title" onCancel={close} onClose={() => setSelectedId(null)}>
      <h3 id="monitoring-details-title">Device Details</h3>
      <dl><dt>Device ID</dt><dd>{selected.id}</dd><dt>SIM Card Slot</dt><dd>{selected.sim_number || 'N/A'}</dd><dt>Relay Control</dt><dd>{badge(relayLabel(selected))}</dd><dt>Lock Status</dt><dd>{badge(lockLabel(selected), true)}</dd><dt>Assigned Rider</dt><dd>{rider(selected, true)}</dd></dl>
      <div className="monitoring-dialog-footer"><button type="button" style={styles.actionBtn} onClick={close}>Close</button></div>
    </dialog>}
  </section>;
}
