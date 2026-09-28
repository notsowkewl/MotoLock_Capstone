import { useId, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

export default function ReportDateRange({ start, end, onChange, inputStyle }: {
  start: string; end: string; onChange: (start: string, end: string) => void; inputStyle?: CSSProperties;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [from, setFrom] = useState(start);
  const [to, setTo] = useState(end);
  const invalid = !!(from && to && from > to);
  const displayDate = (value: string) => new Date(value + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const caption = !start && !end ? 'All dates' : `${start ? displayDate(start) : 'Beginning'} – ${end ? displayDate(end) : 'Present'}`;
  return <div className="reports-date-range">
    <label htmlFor={`${id}-button`}>Date Range</label>
    <button id={`${id}-button`} type="button" className="reports-date-trigger" style={inputStyle} aria-haspopup="dialog" onClick={() => {
      setFrom(start); setTo(end); dialog.current?.showModal();
    }}>{caption}<span aria-hidden="true">▾</span></button>
    <dialog ref={dialog} className="reports-range-dialog" aria-labelledby={`${id}-title`}>
      <form onSubmit={event => { event.preventDefault(); if (!invalid) { onChange(from, to); dialog.current?.close(); } }}>
        <h3 id={`${id}-title`}>Select date range</h3>
        <div className="reports-range-fields">
          <label>From<input type="date" style={inputStyle} value={from} max={to || undefined} onChange={event => setFrom(event.target.value)} /></label>
          <label>To<input type="date" style={inputStyle} value={to} min={from || undefined} onChange={event => setTo(event.target.value)} /></label>
        </div>
        {invalid && <p role="alert">The end date must be on or after the start date.</p>}
        <p className="reports-muted">Leave either date empty for an open-ended range.</p>
        <div className="reports-range-actions">
          <button type="button" onClick={() => { onChange('', ''); dialog.current?.close(); }}>Clear range</button>
          <button type="button" onClick={() => dialog.current?.close()}>Cancel</button>
          <button type="submit" disabled={invalid}>Apply range</button>
        </div>
      </form>
    </dialog>
  </div>;
}
