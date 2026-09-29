import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Rider } from './types';
import TablePagination from './TablePagination';
import { useTablePagination } from './useTablePagination';
import './RidersPage.css';

const roleLabel = (role: string) => ({ rider: 'Rider', admin: 'Administrator', superadmin: 'Super Administrator' }[role] || role || 'Not Recorded');
const plateLabel = (plate: string | null) => !plate?.trim() || plate.trim().toUpperCase() === 'UNKNOWN' ? 'No plate recorded' : plate;
const faceLabel = (rider: Rider) => rider.face_enrolled ? 'Registered' : 'Missing';

export default function RidersPage({ riders, styles, maskPhone, onAdd, onEdit, onDelete }: {
  riders: Rider[];
  styles: Record<string, CSSProperties>;
  maskPhone: (phone?: string) => string;
  onAdd: () => void;
  onEdit: (rider: Rider) => void;
  onDelete: (rider: Rider) => void;
}) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name-asc');
  const [viewId, setViewId] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [contactsId, setContactsId] = useState<string | null>(null);
  const contactsDialog = useRef<HTMLDialogElement>(null);
  const riderRows = riders.filter(rider => rider.role?.trim().toLowerCase() === 'rider');
  const contactsRider = riderRows.find(rider => rider.id === contactsId);
  useEffect(() => {
    if (contactsRider && contactsDialog.current && !contactsDialog.current.open) contactsDialog.current.showModal();
  }, [contactsRider]);
  const closeContacts = () => { contactsDialog.current?.close(); setContactsId(null); };
  const selected = riderRows.find(rider => rider.id === viewId);
  useEffect(() => {
    if (selected && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [selected]);
  const query = search.trim().toLocaleLowerCase();
  const filtered = riderRows.filter(rider =>
    (!query || rider.full_name.toLocaleLowerCase().includes(query) || rider.email.toLocaleLowerCase().includes(query))
  ).sort((a, b) => {
    const nameOrder = a.full_name.localeCompare(b.full_name, undefined, { sensitivity: 'base', numeric: true });
    if (sort === 'name-desc') return -nameOrder;
    if (sort === 'face') return faceLabel(a).localeCompare(faceLabel(b)) || nameOrder;
    if (sort === 'motorcycle') {
      const model = (rider: Rider) => (rider.motorcycles || []).map(motorcycle => motorcycle.model).sort().join(', ');
      return Number(!model(a)) - Number(!model(b)) || model(a).localeCompare(model(b), undefined, { sensitivity: 'base', numeric: true }) || nameOrder;
    }
    return nameOrder;
  });
  const pagination = useTablePagination(filtered, JSON.stringify([search, sort]));
  const close = () => { dialog.current?.close(); setViewId(null); };
  const faceBadge = (rider: Rider) => <span className={`rider-face ${rider.face_enrolled ? 'rider-face-registered' : ''}`}><span aria-hidden="true">{rider.face_enrolled ? '✓' : '✕'}</span> {faceLabel(rider)}</span>;
  const motorcycles = (rider: Rider, full = false) => rider.motorcycles?.length ? <div className="rider-items">{rider.motorcycles.map(motorcycle => <div key={motorcycle.id}><span className="rider-plate">{plateLabel(motorcycle.plate_number)}</span> · {motorcycle.model || 'Model not recorded'}{full && (motorcycle.year || motorcycle.color) && <small>{[motorcycle.year, motorcycle.color].filter(Boolean).join(' · ')}</small>}</div>)}</div> : <span className="rider-secondary">None registered</span>;
  const contacts = (rider: Rider, full = false, all = false) => rider.contacts?.length ? <div className="rider-items rider-contacts">{(full || all ? rider.contacts : rider.contacts.slice(0, 1)).map(contact => <div key={contact.id}><span className="rider-contact-name">{contact.name}</span><small>{[contact.role, full ? contact.phone || contact.phone_number || 'Not Recorded' : maskPhone(contact.phone || contact.phone_number)].filter(Boolean).join(' \u00b7 ')}</small></div>)}{!full && !all && rider.contacts.length > 1 && <button className="rider-more-contacts" aria-haspopup="dialog" onClick={() => setContactsId(rider.id)}>+{rider.contacts.length - 1} more {rider.contacts.length === 2 ? 'contact' : 'contacts'}</button>}</div> : <span className="rider-secondary">No emergency contact</span>;

  return <div className="riders-page">
    <div style={styles.card}>
      <div className="riders-filters">
        <label className="riders-search">Search<input type="search" style={styles.input} placeholder="Search rider name or email..." value={search} onChange={event => setSearch(event.target.value)} /></label>
        <label>Sort Order<select style={styles.input} value={sort} onChange={event => setSort(event.target.value)}><option value="name-asc">Rider Name: A–Z</option><option value="name-desc">Rider Name: Z–A</option><option value="motorcycle">Motorcycle: Model A–Z</option><option value="face">Face ID Status: A–Z</option></select></label>
        <button style={styles.actionBtn} onClick={() => { setSearch(''); setSort('name-asc'); }}>Clear filters</button>
        <button style={{ ...styles.actionBtn, background: 'var(--red)', color: '#fff', borderColor: 'var(--red)' }} onClick={onAdd}>Add User</button>
      </div>
      <div className="riders-table-scroll" tabIndex={0} role="region" aria-label="Riders table"><table style={styles.table}>
        <thead><tr>{['Rider Name', 'Email', 'Motorcycle', 'Emergency Contacts', 'Role', 'Face ID Status', 'Actions'].map(header => <th scope="col" style={styles.tableHeader} key={header}>{header}</th>)}</tr></thead>
        <tbody>{pagination.rows.map(rider => <tr key={rider.id}>
          <td style={styles.tableCell}><button className="rider-name" onClick={() => setViewId(rider.id)} aria-label={`View rider ${rider.full_name}`}>{rider.full_name}</button></td>
          <td style={styles.tableCell}><span className="rider-email">{rider.email}</span></td>
          <td style={styles.tableCell}>{motorcycles(rider)}</td>
          <td style={styles.tableCell}>{contacts(rider)}</td>
          <td style={styles.tableCell}><span className="rider-role">{roleLabel(rider.role)}</span></td>
          <td style={styles.tableCell}>{faceBadge(rider)}</td>
          <td style={styles.tableCell}><div className="rider-actions"><button style={styles.actionBtn} onClick={() => onEdit(rider)}>Edit</button>{rider.role !== 'admin' ? <button style={styles.delBtn} onClick={() => onDelete(rider)}>Delete</button> : <span className="rider-secondary">Protected</span>}</div></td>
        </tr>)}{!filtered.length && <tr><td colSpan={7} style={styles.tableCell}><div className="riders-empty"><strong>No matching riders</strong><p>Try adjusting your search or filters.</p></div></td></tr>}</tbody>
      </table></div>
      <TablePagination pagination={pagination} label="Riders" recordNoun="riders" styles={styles} />
    </div>
    {contactsRider && <dialog ref={contactsDialog} className="rider-dialog rider-contacts-dialog" aria-labelledby="rider-contacts-title" onCancel={closeContacts} onClose={() => setContactsId(null)}>
      <h3 id="rider-contacts-title">Emergency Contacts</h3>
      <p className="rider-contacts-owner">{contactsRider.full_name}</p>
      {contacts(contactsRider, false, true)}
      <div className="rider-dialog-actions"><button style={styles.actionBtn} onClick={closeContacts}>Close</button></div>
    </dialog>}
    {selected && <dialog ref={dialog} className="rider-dialog" aria-labelledby="rider-details-title" onCancel={close} onClose={() => setViewId(null)}>
      <h3 id="rider-details-title">Rider Details</h3>
      <dl className="rider-profile">
        <div><dt>Full Name</dt><dd>{selected.full_name}</dd></div><div><dt>Email</dt><dd>{selected.email}</dd></div>
        <div><dt>Role</dt><dd>{roleLabel(selected.role)}</dd></div>
        <div><dt>Face ID Status</dt><dd>{faceBadge(selected)}</dd></div><div><dt>Rider ID</dt><dd>{selected.id}</dd></div>
        {selected.created_at && <div><dt>Account Created</dt><dd>{Number.isFinite(Date.parse(selected.created_at)) ? new Date(selected.created_at).toLocaleString() : selected.created_at}</dd></div>}
        {selected.updated_at && <div><dt>Last Updated</dt><dd>{Number.isFinite(Date.parse(selected.updated_at)) ? new Date(selected.updated_at).toLocaleString() : selected.updated_at}</dd></div>}
        <div className="rider-profile-wide"><dt>Registered Motorcycles</dt><dd>{motorcycles(selected, true)}</dd></div>
        <div className="rider-profile-wide"><dt>Emergency Contacts</dt><dd>{contacts(selected, true)}</dd></div>
      </dl>
      <div className="rider-dialog-actions"><button style={styles.actionBtn} onClick={() => { close(); onEdit(selected); }}>Edit Rider</button><button style={styles.actionBtn} onClick={close}>Close</button></div>
    </dialog>}
  </div>;
}
