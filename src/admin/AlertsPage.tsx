import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { alertTime, buildIncidents, filterIncidents, resolveIncident, deleteResolvedIncident, triggerLabel } from './alert-records';
import type { AlertRow, AlertStatus, AlertStore, Incident } from './alert-records';
import './AlertsPage.css';
import TablePagination, { useTablePagination } from './TablePagination';

interface Props {
  store: AlertStore;
  threshold: string;
  styles: Record<string, CSSProperties>;
}

export default function AlertsPage({ store, threshold, styles }: Props) {
  const [data, setData] = useState<{ rides: AlertRow[]; users: AlertRow[]; events: AlertRow[] } | null>(null);
  const [view, setView] = useState<AlertStatus>('Active');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [trigger, setTrigger] = useState('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  const dialog = useRef<HTMLDialogElement>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [rides, users, events] = await Promise.all([
        store.read('ride_history'), store.read('users'), store.read('audit_logs'),
      ]);
      setData({ rides, users, events });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to load alerts.');
    } finally { setLoading(false); }
  }, [store]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (selected && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [selected]);

  const incidents = data ? buildIncidents(data.rides, data.users, data.events, threshold) : [];
  const viewIncidents = incidents.filter(incident => incident.status === view);
  const filtered = filterIncidents(viewIncidents, search, status, 'all', trigger);
  const pagination = useTablePagination(filtered, JSON.stringify([view, search, status, trigger, threshold]));
  const triggers = [...new Set(incidents.map(incident => incident.trigger || 'Not Recorded'))].sort();
  const changeView = (next: AlertStatus) => { setView(next); setStatus('all'); };
  const clear = () => {
    setSearch('');
    setStatus('all');
    setTrigger('all');
    setView('Active');
  };
  const close = () => { if (!inFlight.current) { dialog.current?.close(); setSelected(null); } };
  const open = (incident: Incident, deleteAction = false) => { setDeleting(deleteAction); setSelected(incident); setNote(''); setSaveError(''); setNotice(''); };
  const confirm = async () => {
    if (!selected || (!deleting && selected.status !== 'Active') || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setSaveError('');
    try {
      const event = deleting ? await deleteResolvedIncident(store, selected) : await resolveIncident(store, selected, note);
      // Only move the alert after Supabase confirms the saved event.
      setData(previous => previous ? { ...previous, events: [...previous.events, event] } : previous);
      setNotice(deleting ? 'Resolved alert deleted from this view. Original test and resolution history are preserved.' : 'Alert resolved. The original test result and violation are unchanged.');
      dialog.current?.close();
      setSelected(null);
    } catch (failure) {
      setSaveError(failure instanceof Error ? failure.message : deleting ? 'Unable to delete alert.' : 'Unable to resolve alert.');
    } finally { inFlight.current = false; setSaving(false); }
  };
  const severityColor = (value: string) => /^(high|critical)( severity)?$/i.test(value) ? 'var(--red)' : /^(medium|warning)( severity)?$/i.test(value) ? 'var(--yellow)' : 'var(--muted)';
  const labelStyle: CSSProperties = { display: 'grid', gap: 8, minWidth: 160 };

  return <div>
    <div role="tablist" aria-label="Alert views" className="motolock-alert-tabs">
      {(['Active', 'Resolved'] as const).map(value => <button key={value} type="button" role="tab" aria-selected={view === value}
        onClick={() => changeView(value)} className="motolock-alert-tab">
        {value === 'Active' ? 'Active Alerts' : 'Resolved'} ({incidents.filter(incident => incident.status === value).length})
      </button>)}
    </div>
    <div style={{ ...styles.card, display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: 16, marginBottom: 12 }}>
      <label style={labelStyle}><span style={{ fontSize: 13, fontWeight: 600 }}>Search Rider</span>
        <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by rider name" style={styles.input} />
      </label>
      <label style={labelStyle}><span style={{ fontSize: 13, fontWeight: 600 }}>Status</span>
        <select value={status} onChange={event => {
          setStatus(event.target.value);
          if (event.target.value !== 'all') setView(event.target.value as AlertStatus);
        }} style={styles.input}>
          <option value="all">All Status</option><option>Active</option><option>Resolved</option>
        </select>
      </label>
      <label style={labelStyle}><span style={{ fontSize: 13, fontWeight: 600 }}>Trigger Reason</span>
        <select value={trigger} onChange={event => setTrigger(event.target.value)} style={styles.input}>
          <option value="all">All Reasons</option>{triggers.map(value => <option key={value}>{value}</option>)}
        </select>
      </label>
      <button type="button" onClick={clear} style={{ ...styles.actionBtn, minHeight: 42, flexShrink: 0, whiteSpace: 'nowrap' }}>Clear Filters</button>
      <span role="status" style={{ fontSize: 13, color: 'var(--muted)' }}>Showing {filtered.length} of {viewIncidents.length} alerts</span>
    </div>
    {notice && <p role="status" style={{ color: 'var(--green)' }}>{notice}</p>}
    {error && <p role="alert" style={{ color: 'var(--red)' }}>{error} <button type="button" onClick={() => void load()} style={styles.actionBtn}>Retry</button></p>}
    <div style={styles.card}>
      <table style={styles.table}>
        <thead><tr>
          {['Timestamp', 'Rider details', 'Trigger Reason', 'Severity', 'Status', 'Management Action'].map(title => <th key={title} style={styles.tableHeader}>{title}</th>)}
        </tr></thead>
        <tbody>
          {pagination.rows.map(incident => <tr key={incident.id}>
            <td style={styles.tableCell}>{alertTime(incident.timestamp)}</td>
            <td style={styles.tableCell}>{incident.rider || 'Not Recorded'}{incident.email ? ` (${incident.email})` : ''}</td>
            <td style={{ ...styles.tableCell, ...(incident.trigger === 'Alcohol Above Limit' ? { color: 'var(--red)', fontWeight: 600 } : {}) }}>{triggerLabel(incident)}</td>
            <td style={styles.tableCell}><span style={{ fontWeight: 700, color: severityColor(incident.severity) }}>{incident.severity || 'Not Recorded'}</span></td>
            <td style={styles.tableCell}><span style={{ fontWeight: 700, color: incident.status === 'Resolved' ? 'var(--green)' : 'var(--red)' }}>{incident.status}</span></td>
            <td style={styles.tableCell}><button type="button" aria-haspopup="dialog" onClick={() => open(incident)} disabled={loading || !!error} style={styles.actionBtn}>
              {incident.status === 'Active' ? 'Resolve Alert' : 'View Details'}
            </button>
              {incident.status === 'Resolved' && <button type="button" aria-haspopup="dialog" onClick={() => open(incident, true)} disabled={loading || !!error}
                style={{ ...styles.actionBtn, marginLeft: 8, color: 'var(--red)' }}>Delete</button>}
            </td>
          </tr>)}
          {!filtered.length && <tr><td colSpan={6} style={{ ...styles.tableCell, textAlign: 'center', color: 'var(--muted)' }}>
            {loading ? 'Loading alerts…' : error ? 'Alerts could not be loaded.' : 'No alerts match the selected view and filters.'}
          </td></tr>}
        </tbody>
      </table>
      <TablePagination pagination={pagination} label="Alerts and incidents" styles={styles} />
    </div>
    {selected && <dialog ref={dialog} className={`motolock-alert-dialog${selected.status === 'Active' ? ' motolock-resolve-dialog' : ''}`} aria-labelledby="alert-dialog-title" onCancel={event => { event.preventDefault(); close(); }}
      style={{ ...styles.modalContent, color: 'var(--text)', maxWidth: 'calc(100vw - 32px)', maxHeight: '85vh', overflowY: 'auto',
        ...(selected.status === 'Active' || deleting ? { position: 'fixed', inset: 0, margin: 'auto', width: 560, padding: 24, boxSizing: 'border-box', maxHeight: 'calc(100dvh - 32px)' } : {}) }}>
      <h3 id="alert-dialog-title">{deleting ? 'Delete Resolved Alert' : selected.status === 'Active' ? 'Resolve Alert' : 'Resolved Alert Details'}</h3>
      <dl style={{ fontSize: 14, display: 'grid', gridTemplateColumns: selected.status === 'Active' ? 'minmax(0, 155px) minmax(0, 1fr)' : '1fr 2fr', gap: selected.status === 'Active' ? '8px 16px' : 12, overflowWrap: 'anywhere' }}>
        {[
          ['Original timestamp', alertTime(selected.timestamp)], ['Rider', selected.rider],
          ['Trigger reason', triggerLabel(selected)], ['Incident details', selected.details], ['Severity', selected.severity],
          ['System action taken', selected.systemAction], ['Original test status', selected.originalStatus], ['Status', selected.status],
          ...(selected.status === 'Resolved' ? [['Resolved at', alertTime(selected.resolvedAt)], ['Resolved by', selected.resolvedBy], ...(selected.note ? [['Resolution note', selected.note]] : [])] : []),
        ].map(([label, value]) => <div key={label} style={{ display: 'contents' }}><dt style={{ fontWeight: 600 }}>{label}</dt><dd style={{ margin: 0, whiteSpace: 'pre-wrap', ...(label === 'Trigger reason' && selected.trigger === 'Alcohol Above Limit' ? { color: 'var(--red)', fontWeight: 600 } : {}) }}>{value || 'Not Recorded'}</dd></div>)}
      </dl>
      {selected.status === 'Active' && <>
        <p className="motolock-resolve-message">Resolving this alert confirms that the incident has been reviewed or handled. It does not change the original test result.</p>
        <label className="motolock-resolve-note">Resolution Note (Optional)
          <textarea value={note} onChange={event => setNote(event.target.value)} disabled={saving} rows={3} style={{ ...styles.input, margin: 0, resize: 'vertical', width: '100%', boxSizing: 'border-box' }} />
        </label>
      </>}
      {deleting && <p className="motolock-resolve-message">Delete this alert from the Resolved view? The original test and resolution history will be preserved. It will not return to Active Alerts.</p>}
      {saveError && <p role="alert" style={{ color: 'var(--red)' }}>{saveError}</p>}
      <div className={selected.status === 'Active' ? 'motolock-resolve-actions' : undefined} style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button type="button" autoFocus onClick={close} disabled={saving} style={selected.status === 'Active' ? undefined : styles.actionBtn}>{selected.status === 'Active' || deleting ? 'Cancel' : 'Close'}</button>
        {deleting && <button type="button" onClick={() => void confirm()} disabled={saving} style={{ ...styles.actionBtn, color: '#fff', background: 'var(--red)' }}>{saving ? 'Deleting…' : 'Delete Alert'}</button>}
        {selected.status === 'Active' && <button type="button" className="motolock-resolve-confirm" onClick={() => void confirm()} disabled={saving}>{saving ? 'Resolving…' : 'Resolve Alert'}</button>}
      </div>
    </dialog>}
    <style>{'.motolock-alert-dialog::backdrop { background: rgba(0,0,0,0.6); }'}</style>
  </div>;
}
