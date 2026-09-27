import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { createReportSnapshot, rideReportTypes, userReportTypes } from './report-snapshot';
import { reportOptions } from './report-options';
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
      const snapshot = createReportSnapshot(option.value, records, metadata);
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
      for (const header of snapshot.headers) expect(pdf).toContain(header);
      if (rideReportTypes.includes(option.value)) {
        expect(pdf).toContain('0.049 BAC');
        expect(pdf).toContain('0.00 BAC');
        expect(pdf).toContain('Not Tested');
      } else if (userReportTypes.includes(option.value)) {
        expect(pdf).toContain('091******67');
        expect(pdf).toContain('Enrolled');
      } else {
        expect(pdf).toContain('ID-0');
        expect(pdf).toContain('settings_updated');
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
  expect(snapshot.rows[2]).toEqual(['Not Recorded', 'Missing reading', 'Not Tested', 'Not Tested', 'Not Recorded', 'Failed']);
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
  expect(workbook.getWorksheet('Report')!.getCell('C8').value).toBe('00123');
});
