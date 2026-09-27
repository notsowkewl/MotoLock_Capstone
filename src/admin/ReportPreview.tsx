import React from 'react';
import { reportDate, rideReportTypes } from './report-snapshot';
import type { ReportSnapshot } from './report-snapshot';
import TablePagination, { useTablePagination } from './TablePagination';

export default function ReportPreview({ report, exporting, onExport }: {
  report: ReportSnapshot;
  exporting: boolean;
  onExport: (format: 'pdf' | 'excel') => void;
}) {
  const rides = rideReportTypes.includes(report.type);
  const pagination = useTablePagination(report.rows, report.generatedAt);
  const counts = [
    ['Total Records', report.rows.length],
    ...(rides ? ['Sober', 'Not Sober', 'Ongoing', 'Failed'].map(label => [label, report.rows.filter(row => row[label === 'Sober' || label === 'Not Sober' ? 3 : 5] === label).length]) : []),
  ];
  return <section className="report-preview" aria-label="Report preview">
    <div className="reports-summary" aria-live="polite">{counts.map(([label, count]) => <div className="reports-stat" key={label}><span>{label}</span><strong>{Number(count).toLocaleString()}</strong></div>)}</div>
    <div className="reports-results">
      <div className="reports-toolbar">
        <div><h3 className="reports-heading">{report.title}</h3><p className="reports-description" role="status">Showing {report.rows.length.toLocaleString()} {report.rows.length === 1 ? 'record' : 'records'}{report.hasFilters ? ' matching your filters' : ''}</p><p className="reports-updated">Last updated: {reportDate(report.generatedAt)}</p></div>
        <div className="reports-actions"><button disabled={exporting} onClick={() => onExport('pdf')}>Export PDF</button><button disabled={exporting} onClick={() => onExport('excel')}>Export Excel</button></div>
      </div>
      <div className="reports-table-scroll">
        <table className="reports-table"><thead><tr>{report.headers.map(header => <th scope="col" key={header}>{header}</th>)}</tr></thead>
          <tbody>{!report.rows.length ? <tr><td colSpan={report.headers.length}><div className="reports-empty"><strong>No matching records</strong><p>Try adjusting your filters or date range.</p></div></td></tr> : pagination.rows.map((row, index) => <tr key={index}>{row.map((value, column) => <td key={column}>
            {rides && column === 1 ? <div className="reports-rider"><strong>{value.split('\n')[0]}</strong><span>{value.split('\n').slice(1).join(' ')}</span></div>
              : rides && column >= 3 && !['Not Tested', 'Not Recorded'].includes(value) ? <span className={`report-badge report-badge-${value.toLowerCase().replace(/ /g, '-')}`}>{value === 'Sober' ? '✓ ' : ''}{value}</span>
                : <span className={rides && column === 2 ? `reports-bac${row[3] === 'Not Sober' ? ' reports-bac-high' : ''}` : ['Not Tested', 'Not Recorded'].includes(value) ? 'reports-muted' : ''}>{value}</span>}
          </td>)}</tr>)}</tbody>
        </table>
      </div>
      <TablePagination pagination={pagination} label="Records" styles={{}} />
      <p className="reports-export-note">Exports include all {report.rows.length.toLocaleString()} records in the selected order.{rides && ' Unavailable states are shown as Not Recorded.'}</p>
    </div>
  </section>;
}
