import React from 'react';
import { reportDate } from './report-snapshot';
import type { ReportSnapshot } from './report-snapshot';
import TablePagination, { useTablePagination } from './TablePagination';
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
  const compactSafety = ['Sober', 'Not Sober', 'Failed'].every(label => allCounts.some(item => item[0] === label));
  const counts = compactSafety ? ['Total Records', 'Sober', 'Not Sober', 'Failed'].map(label =>
    [label, allCounts.find(item => item[0] === label || (label === 'Total Records' && item[0] === 'Total Tests'))?.[1] ?? 0]) : allCounts;
  const outcomes = compactSafety ? ['Passed', 'Failed', 'Ongoing'].flatMap(label => {
    const item = allCounts.find(item => item[0] === label);
    return item ? [`${typeof item[1] === 'number' ? item[1].toLocaleString() : item[1]} ${label}`] : [];
  }).join(' · ') : '';
  const passRate = compactSafety ? allCounts.find(item => item[0] === 'Pass Rate')?.[1] : undefined;
  return <section className="report-preview" aria-label="Report preview">
    <div className="reports-summary" aria-live="polite">{counts.map(([label, count]) => <div className="reports-stat" key={label}><span>{label}</span><strong>{typeof count === 'number' ? count.toLocaleString() : count}</strong></div>)}</div>
    <div className="reports-results">
      <div className="reports-toolbar">
        <div><h3 className="reports-heading">{report.title}</h3>
          {outcomes && <p className="reports-outcome-summary" aria-live="polite">{outcomes}{passRate !== undefined ? ` · ${passRate} Pass Rate` : ''}</p>}
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
