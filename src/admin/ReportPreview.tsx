import React from 'react';
import { reportDate } from './report-snapshot';
import type { ReportSnapshot } from './report-snapshot';
import TablePagination from './TablePagination';
import { useTablePagination } from './useTablePagination';
import ReportTrendChart from './ReportTrendChart';

export default function ReportPreview({ report, exporting, onExport }: {
  report: ReportSnapshot;
  exporting: boolean;
  onExport: (format: 'pdf' | 'excel') => void;
}) {
  const rides = report.headers.includes('BAC Level');
  const pagination = useTablePagination(report.rows, report.generatedAt);
  const allCounts = report.summary ? report.summary.map(item => [item.label, item.value]) : [
    ['Total Records', report.rows.length],
    ...(rides ? ['Sober', 'Not Sober'].map(label => [label, report.rows.filter(row => row[3].split('\n')[0] === label).length]) : []),
  ];
  const outcomeLabels = ['Passed', 'Failed', 'Ongoing'];
  const counts = allCounts.filter(item => !outcomeLabels.includes(String(item[0])));
  const outcomes = outcomeLabels.flatMap(label => {
    const item = allCounts.find(item => item[0] === label);
    return item ? [`${typeof item[1] === 'number' ? item[1].toLocaleString() : item[1]} ${label}`] : [];
  }).join(' · ');
  return <section className="report-preview" aria-label="Report preview">
    <div className="reports-results">
      <div className="reports-toolbar">
        <div><h3 className="reports-heading">{report.title}</h3>
          {!!counts.length && <div className="reports-summary reports-summary-inline" aria-live="polite">{counts.map(([label, count]) => <div className="reports-stat" key={label}><strong>{typeof count === 'number' ? count.toLocaleString() : count}</strong><span>{label}</span></div>)}</div>}
          {outcomes && <p className="reports-outcome-summary" aria-live="polite">{outcomes}</p>}
          <p className="reports-updated">Last updated: {reportDate(report.generatedAt)}</p></div>
        <div className="reports-actions"><button disabled={exporting} onClick={() => onExport('pdf')}>Export PDF</button><button disabled={exporting} onClick={() => onExport('excel')}>Export Excel</button></div>
      </div>
      {report.chart && report.chart.length > 0 && <ReportTrendChart points={report.chart} />}
      <details className="reports-data" open={report.chart?.length ? undefined : true} key={report.type + (report.view || '')}>
      <summary hidden={!report.chart}>View daily totals and export data ({report.rows.length} periods)</summary>
      <div className="reports-table-scroll">
        <table className="reports-table"><thead><tr>{report.headers.map(header => <th scope="col" key={header}>{header}</th>)}</tr></thead>
          <tbody>{!report.rows.length ? <tr><td colSpan={report.headers.length}><div className="reports-empty"><strong>No matching records</strong><p>Try adjusting your filters or date range.</p></div></td></tr> : pagination.rows.map((row, index) => <tr key={index}>{row.map((value, column) => <td key={column}>
            {['Rider Details', 'Rider', 'Assigned Rider'].includes(report.headers[column]) ? <div className="reports-rider"><strong>{value.split('\n')[0]}</strong><span>{value.split('\n').slice(1).join(' ')}</span></div>
              : ((rides && column === 3 && !['Not Tested', 'Not Recorded'].includes(value)) || (report.headers[column] === 'Face ID' && ['Enrolled', 'Missing'].includes(value))) ? <span className={`report-badge report-badge-${value.toLowerCase().replace(/ /g, '-')}`}>{value === 'Sober' ? '✓ ' : value === 'Not Sober' ? '✕ ' : ''}{value}</span>
                : <span className={rides && column === 2 ? `reports-bac${row[3] === 'Not Sober' ? ' reports-bac-high' : ''}` : ['Not Tested', 'Not Recorded'].includes(value) ? 'reports-muted' : ''}>{value}</span>}
          </td>)}</tr>)}</tbody>
        </table>
      </div>
      <TablePagination pagination={pagination} label="Records" styles={{}} />
      </details>
    </div>
  </section>;
}
