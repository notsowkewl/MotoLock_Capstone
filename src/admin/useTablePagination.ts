import { useState } from 'react';

export function useTablePagination<T>(records: T[], filterKey = '') {
  const [state, setState] = useState({ page: 1, size: 10, filterKey });
  const pages = Math.max(1, Math.ceil(records.length / state.size));
  const page = filterKey !== state.filterKey ? 1 : Math.min(state.page, pages);
  if (state.filterKey !== filterKey || state.page !== page) {
    setState({ ...state, page, filterKey });
  }
  const start = records.length ? (page - 1) * state.size + 1 : 0;
  const end = Math.min(page * state.size, records.length);
  return {
    rows: records.slice((page - 1) * state.size, page * state.size),
    page, pages, size: state.size, start, end, total: records.length,
    setPage: (next: number) => setState(previous => ({ ...previous, page: Math.max(1, Math.min(next, pages)) })),
    setSize: (size: number) => setState(previous => ({ ...previous, size, page: 1 })),
  };
}
