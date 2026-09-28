import type { ReportSnapshot } from './report-snapshot';

export default function ReportTrendChart({ points }: { points: NonNullable<ReportSnapshot['chart']> }) {
  const max = Math.max(1, ...points.map(point => point.total));
  const width = Math.max(640, points.length * 68 + 80), height = 290;
  return <figure className="reports-trend">
    <figcaption>Sobriety by date <span className="reports-trend-legend"><span>■ Sober</span><span>■ Not Sober</span></span></figcaption>
    <div className="reports-chart-scroll" tabIndex={0} aria-label="Sobriety trend chart; scroll horizontally for more dates">
      <svg role="img" aria-label="Number of tests by date, grouped by sobriety result" viewBox={`0 0 ${width} ${height}`} style={{ minWidth: width }}>
        <text x="12" y="15" className="reports-chart-label">Number of Tests</text>
        {[0, 1, 2, 3, 4].map(step => { const value = Math.ceil(max / 4) * step, y = 220 - value / (Math.ceil(max / 4) * 4) * 175; return <g key={step}><line x1="45" x2={width - 10} y1={y} y2={y} className="reports-chart-grid" /><text x="36" y={y + 4} textAnchor="end" className="reports-chart-label">{value}</text></g>; })}
        {points.map((point, index) => {
          const scale = 175 / (Math.ceil(max / 4) * 4), x = 60 + index * (width - 80) / points.length;
          return <g key={point.date}>
            <rect x={x} y={220 - point.sober * scale} width="18" height={point.sober * scale} fill="var(--green)"><title>{point.date}: {point.sober} sober tests</title></rect>
            <rect x={x + 20} y={220 - point.notSober * scale} width="18" height={point.notSober * scale} fill="var(--red)"><title>{point.date}: {point.notSober} not sober tests</title></rect>
            <text x={x + 19} y="240" textAnchor="middle" className="reports-chart-label">{point.date}</text>
          </g>;
        })}
        <text x={width / 2} y="278" textAnchor="middle" className="reports-chart-label">Date / Time Period</text>
      </svg>
    </div>
  </figure>;
}
