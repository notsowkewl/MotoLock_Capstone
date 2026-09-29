import type { CSSProperties } from 'react';
import type { useTablePagination } from './useTablePagination';

type Props = {
  pagination: Omit<ReturnType<typeof useTablePagination>, 'rows'>;
  label: string;
  recordNoun?: string;
  styles: Record<string, CSSProperties>;
};

export default function TablePagination({ pagination: p, label, recordNoun = 'records' }: Props) {
  const firstPage = Math.max(1, Math.min(p.page - 2, p.pages - 4));
  const visiblePages = Array.from({ length: Math.min(5, p.pages) }, (_, index) => firstPage + index);
  const button = (active = false, disabled = false): CSSProperties => ({
    width: 42, height: 42, padding: 0, borderRadius: 10,
    border: active ? '1px solid #f31325' : '1px solid var(--border, #dedede)',
    background: active ? '#f31325' : 'var(--bg, #f3f3f3)',
    color: active ? '#fff' : 'var(--text, #142638)',
    fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1,
    flexShrink: 0,
  });
  return <nav aria-label={`${label} pagination`} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, paddingTop: 16, borderTop: '1px solid var(--border)', marginTop: 12 }}>
    <span role="status" style={{ fontSize: 13, color: 'var(--muted)', marginRight: 'auto' }}>Showing {p.start}{recordNoun === 'riders' ? '–' : '-'}{p.end} of {p.total} {recordNoun}</span>
    <div style={{ display: 'flex', gap: 7, marginLeft: 'auto', flexWrap: 'wrap' }}>
      <button type="button" aria-label="Previous" disabled={p.page === 1} onClick={() => p.setPage(p.page - 1)} style={button(false, p.page === 1)}>&lsaquo;</button>
      {visiblePages.map(page => <button key={page} type="button" aria-label={`Page ${page}`} aria-current={p.page === page ? 'page' : undefined}
        onClick={() => p.setPage(page)} style={button(p.page === page)}>{page}</button>)}
      <button type="button" aria-label="Next" disabled={p.page === p.pages} onClick={() => p.setPage(p.page + 1)} style={button(false, p.page === p.pages)}>&rsaquo;</button>
    </div>
  </nav>;
}
