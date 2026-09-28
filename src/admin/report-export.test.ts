import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { createReportSnapshot } from './report-snapshot';
import { reportOptions } from './report-options';
import { buildOrganizedReport, defaultReportFilters, emptyReportSources } from './organized-report-data';
import { buildReportPdf, buildReportWorkbook } from './report-export';
import type { ReportRow } from './types';

const metadata = { coverage: '2026-09-01 to 2026-09-27', filters: 'All matching records' };
const records: ReportRow[] = [
  { id: 12, created_at: '2026-09-10T05:00:00Z', full_name: 'Jenna Diaz', email: 'jenna@example.com', brac: '0.049', status: 'completed', phone: '09171234567', role: 'rider', face_enrolled: true, action: 'settings_updated' },
  { id: 4, full_name: 'Second rider', brac: '0', status: 'ongoing', role: 'admin' },
  { id: 0, full_name: 'Missing reading', brac: '', unlock_status: 'failed_face' },
];

describe('all report exports use the preview snapshot', () => {
  for (const option of reportOptions.filter(option => !option.disabled)) {
    it(option.label, async () => {
      const snapshot = buildOrganizedReport(option.value, 'details', {
        ...emptyReportSources,
        users: [{ id: 'rider', name: 'Jenna Diaz', email: 'jenna@example.com', role: 'rider', face_enrolled: true }],
        rides: records.map(row => ({ ...row, user_id: 'rider', initial_brac_level: row.brac })),
        motorcycles: [{ id: 'motorcycle', user_id: 'rider', model: 'Moto', plate_number: 'ABC123' }],
        devices: [{ id: 'device', user_id: 'rider', motorcycle_id: 'motorcycle', status: 'online' }],
        events: [{ id: 'event', user_id: 'rider', action_type: 'ride_completed', created_at: '2026-09-10T05:00:00Z', action_details: { ride_id: 12 } }],
      }, defaultReportFilters, '0.05');
      expect(snapshot.title).toBe(option.label);
      const workbook = buildReportWorkbook(snapshot);
      const saved = new ExcelJS.Workbook();
      await saved.xlsx.load(await workbook.xlsx.writeBuffer());
      const sheet = saved.getWorksheet('Report')!;
      expect(sheet.getRow(7).values).toEqual([undefined, ...snapshot.headers]);
      snapshot.rows.forEach((row, i) => expect(sheet.getRow(i + 8).values).toEqual([undefined, ...row]));
      expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 7 });
      expect(sheet.getCell('A7').fill).toMatchObject({ fgColor: { argb: 'FF202938' } });
      const pdf = buildReportPdf(snapshot).output();
      expect(pdf).toContain(snapshot.title);
      if (option.value === 'safety-sobriety') {
        expect(pdf).toContain('0.049 BAC');
        expect(pdf).toContain('0.00 BAC');
        expect(pdf).toContain('Not Tested');
      } else if (option.value === 'rider-master') {
        expect(pdf).not.toContain('091******67');
        expect(snapshot.headers).not.toContain('Phone');
        expect(pdf).toContain('Enrolled');
      }
    });
  }
});

it('freezes formatted data, preserves order and does not invent timestamps or zero readings', () => {
  const input = records.map(row => ({ ...row }));
  const snapshot = createReportSnapshot('sobriety-test', input, metadata);
  input[0].brac = '99';
  expect(snapshot.rows[0][2]).toBe('0.049 BAC');
  expect(snapshot.rows[1][2]).toBe('0.00 BAC');
  expect(snapshot.rows[2]).toEqual(['Not Recorded', 'Missing reading', 'Not Tested', 'Not Tested', 'Not Recorded']);
});

it('exports a sober failed ride with its recorded reason and without ignition state', async () => {
  const snapshot = createReportSnapshot('alcohol-detection', [{
    id: 1, brac: '0', status: 'failed_face', failure_reason: 'Face did not match',
  }], metadata);
  const pdf = buildReportPdf(snapshot).output();
  expect(pdf).toContain('Sober');
  expect(pdf).toContain('Face did not match');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await buildReportWorkbook(snapshot).xlsx.writeBuffer());
  expect(workbook.getWorksheet('Report')!.getRow(8).values).toEqual([undefined, ...snapshot.rows[0]]);
});

it('exports all rows beyond the 15-row preview and produces multiple PDF pages', async () => {
  const rows = Array.from({ length: 70 }, (_, i) => ({ ...records[0], id: i, full_name: `Rider ${i}` }));
  const snapshot = createReportSnapshot('sobriety-test', rows, metadata);
  const pdf = buildReportPdf(snapshot);
  expect(pdf.getNumberOfPages()).toBeGreaterThan(1);
  expect(pdf.output()).toContain('Rider 69');
  const workbook = buildReportWorkbook(snapshot);
  expect(workbook.getWorksheet('Report')!.getRow(77).getCell(2).value).toBe('Rider 69\njenna@example.com');
  if (process.env.REPORT_ARTIFACT_DIR) {
    const { mkdirSync, writeFileSync } = await import('node:fs');
    mkdirSync(process.env.REPORT_ARTIFACT_DIR, { recursive: true });
    writeFileSync(`${process.env.REPORT_ARTIFACT_DIR}/report.pdf`, new Uint8Array(pdf.output('arraybuffer')));
    await workbook.xlsx.writeFile(`${process.env.REPORT_ARTIFACT_DIR}/report.xlsx`);
  }
});

it('handles empty reports and stores formula-looking input as literal text', async () => {
  const empty = createReportSnapshot('audit-trail', [], metadata);
  expect(buildReportPdf(empty).output()).toContain('No matching records');
  expect(buildReportWorkbook(empty).getWorksheet('Report')!.getCell('A8').value).toContain('No matching records');
  const snapshot = createReportSnapshot('rider-master', [{ id: 1, full_name: '=1+1', phone: '00123' }], metadata);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await buildReportWorkbook(snapshot).xlsx.writeBuffer());
  expect(workbook.getWorksheet('Report')!.getCell('A8').value).toBe('=1+1');
  expect(snapshot.headers).toEqual(['Rider Name', 'Email', 'Role', 'Face ID']);
  expect(workbook.getWorksheet('Report')!.getCell('C8').value).toBe('Not Recorded');
  expect(snapshot.rows[0]).not.toContain('00123');
});
