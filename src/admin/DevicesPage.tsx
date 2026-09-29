import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Device } from './types';
import TablePagination from './TablePagination';
import { useTablePagination } from './useTablePagination';
import './DevicesPage.css';
import HelmetStickerDialog from './HelmetStickerDialog';
import { isHelmetVisualId } from '../shared/helmet-marker';

const shortId = (id: Device['id']) => `DEV-${String(id).slice(0, 8).toUpperCase()}`;
const ignition = (device: Device) => {
  // A missing lock reading must not be presented as ready.
  const locked: unknown = device.is_locked;
  return locked === true || locked === 1 ? 'Ignition Locked' : locked === false || locked === 0 ? 'Ignition Ready' : 'Awaiting Hardware';
};

export default function DevicesPage({ devices, styles, onOpenAlerts }: {
  devices: Device[];
  styles: Record<string, CSSProperties>;
  onOpenAlerts: () => void;
}) {
  const [search, setSearch] = useState('');
  const [stickerId, setStickerId] = useState<Device['id'] | null>(null);
  const stickerDevice = devices.find(device => device.id === stickerId);
  const [status, setStatus] = useState('all');
  const [selectedId, setSelectedId] = useState<Device['id'] | null>(null);
  const [override, setOverride] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const selected = devices.find(device => device.id === selectedId);
  const query = search.trim().toLowerCase();
  const filtered = devices.filter(device => (String(device.id).toLowerCase().includes(query) || shortId(device.id).toLowerCase().includes(query) || device.helmet_visual_id?.toLowerCase().includes(query)) && (status === 'all' || ignition(device) === status));
  const pagination = useTablePagination(filtered, JSON.stringify([search, status]));
  useEffect(() => {
    if (selected && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [selected]);
  useEffect(() => {
    if (override) dialog.current?.querySelector<HTMLButtonElement>('[data-alert-link]')?.focus();
  }, [override]);
  const close = () => { dialog.current?.close(); setSelectedId(null); setOverride(false); };
  const badge = (device: Device) => <span className={`device-status ${ignition(device) === 'Ignition Ready' ? 'device-status-ready' : ''}`}><span aria-hidden="true">{ignition(device) === 'Ignition Ready' ? '✓' : '•'}</span> {ignition(device)}</span>;
  const details = (device: Device) => <div className="device-details"><span>Helmet ID: {device.helmet_visual_id || 'Not synced'}</span>{device.model && <span>{device.model}</span>}</div>;

  return <div className="devices-page">
    <div className="devices-summary" aria-label="Device summary">
      {[
        ['Devices', devices.length],
        ['Ignition Ready', devices.filter(device => ignition(device) === 'Ignition Ready').length],
        ['Ignition Locked', devices.filter(device => ignition(device) === 'Ignition Locked').length],
        ...(devices.some(device => ignition(device) === 'Awaiting Hardware') ? [['Awaiting Hardware', devices.filter(device => ignition(device) === 'Awaiting Hardware').length]] : []),
      ].map(([label, count]) => <div key={label}><span>{label}</span><strong>{Number(count).toLocaleString()}</strong></div>)}
    </div>
    <div style={styles.card}>
      <div className="devices-filters">
        <label>Search<input type="search" placeholder="Search Device ID..." value={search} onChange={event => setSearch(event.target.value)} style={styles.input} /></label>
        <label>Ignition Status<select value={status} onChange={event => setStatus(event.target.value)} style={styles.input}><option value="all">All Status</option><option>Ignition Ready</option><option>Ignition Locked</option><option>Awaiting Hardware</option></select></label>
        <button style={styles.actionBtn} onClick={() => { setSearch(''); setStatus('all'); }}>Clear filters</button>
      </div>
      <div className="devices-table-scroll"><table style={styles.table}>
        <thead><tr>{['Device ID', 'Ignition Status', 'Device Details', 'Actions'].map(header => <th scope="col" key={header} style={styles.tableHeader}>{header}</th>)}</tr></thead>
        <tbody>{pagination.rows.map(device => <tr key={device.id}>
          <td style={styles.tableCell}><span className="device-id" title={String(device.id)}>{shortId(device.id)}</span></td>
          <td style={styles.tableCell}>{badge(device)}</td>
          <td style={styles.tableCell}>{details(device)}</td>
          <td style={styles.tableCell}><button style={styles.actionBtn} aria-label={`Manage device ${device.id}`} onClick={() => { setOverride(false); setSelectedId(device.id); }}>Manage</button> <button style={styles.actionBtn} aria-label={`Generate sticker for device ${device.id}`} onClick={() => setStickerId(device.id)}>Generate sticker</button>{!isHelmetVisualId(device.helmet_visual_id) && <small className="sticker-sync-note">Helmet ID needs syncing</small>}</td>
        </tr>)}{!filtered.length && <tr><td colSpan={4} style={styles.tableCell}><div className="devices-empty"><strong>{devices.length ? 'No matching devices' : 'No devices available'}</strong><p>{devices.length ? 'Try adjusting your search or ignition status filter.' : 'Registered devices will appear here.'}</p></div></td></tr>}</tbody>
      </table></div>
      <TablePagination pagination={pagination} label="MotoLock devices" styles={styles} />
    </div>
    {stickerDevice && <HelmetStickerDialog key={String(stickerDevice.id)} device={stickerDevice} onClose={() => setStickerId(null)} />}
    {selected && <dialog ref={dialog} className="device-dialog" aria-labelledby="device-dialog-title" onCancel={close} onClose={() => { setSelectedId(null); setOverride(false); }}>
      <h3 id="device-dialog-title">{override ? 'Device Override' : `Device ${shortId(selected.id)}`}</h3>
      {override && <p className="device-override-message">Device override actions are managed through Alerts &amp; Incidents. Open an active alert to continue.</p>}
      <dl><dt>Device ID</dt><dd className="device-full-id">{selected.id}</dd>{!override && <><dt>Ignition Status</dt><dd>{badge(selected)}</dd><dt>Device Details</dt><dd>{details(selected)}</dd></>}</dl>
      <div className="device-dialog-actions">
        {override ? <button data-alert-link style={styles.actionBtn} onClick={() => { close(); onOpenAlerts(); }}>Go to Alerts &amp; Incidents</button> : <button style={styles.actionBtn} onClick={() => setOverride(true)}>Device Override</button>}
        <button style={styles.actionBtn} onClick={close}>Cancel</button>
      </div>
    </dialog>}
  </div>;
}
