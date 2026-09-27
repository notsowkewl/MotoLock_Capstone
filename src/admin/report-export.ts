import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { reportCellColor, reportDate } from './report-snapshot';
import type { ReportSnapshot } from './report-snapshot';

const ink = '#202938';
const red = '#ed1c24';

export function buildReportPdf(report: ReportSnapshot) {
  const doc = new jsPDF({ orientation: report.headers.length > 3 ? 'landscape' : 'portrait', format: 'a4' });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  doc.setProperties({ title: report.title, author: 'MotoLock', subject: report.coverage });
  const heading = () => {
    doc.setFillColor(ink).rect(0, 0, width, 24, 'F');
    doc.setFillColor(red).rect(0, 24, width, 1.5, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(19).setTextColor('#ffffff').text('Moto', 14, 16);
    doc.setTextColor('#ff5260').text('Lock', 30.5, 16);
    doc.setFontSize(9).setTextColor('#ffffff').text('ADMINISTRATION / REPORTS', width - 14, 15, { align: 'right' });
  };
  heading();
  doc.setFont('helvetica', 'bold').setFontSize(17).setTextColor(ink);
  const titleLines = doc.splitTextToSize(report.title, width - 28);
  doc.text(titleLines, 14, 37);
  let y = 37 + titleLines.length * 7;
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor('#596579');
  const metadata = [
    `Coverage: ${report.coverage}`,
    report.filters,
    `Generated: ${reportDate(report.generatedAt)} | ${report.rows.length} matching records`,
  ];
  for (const line of metadata) {
    const lines = doc.splitTextToSize(line, width - 28);
    doc.text(lines, 14, y);
    y += lines.length * 4.5 + 1;
  }
  autoTable(doc, {
    startY: y + 4, margin: { top: 33, right: 14, bottom: 18, left: 14 },
    head: [report.headers], body: report.rows,
    theme: 'striped', showHead: 'everyPage', rowPageBreak: 'avoid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 3.5, textColor: ink, overflow: 'linebreak', valign: 'middle' },
    headStyles: { fillColor: ink, textColor: '#ffffff', fontStyle: 'bold', cellPadding: 4 },
    alternateRowStyles: { fillColor: '#f1f4f8' },
    didParseCell: data => {
      if (data.section === 'body') {
        const color = reportCellColor(String(data.cell.raw));
        if (color) { data.cell.styles.textColor = color; data.cell.styles.fontStyle = 'bold'; }
      }
    },
    willDrawPage: data => { if (data.pageNumber > 1) heading(); },
  });
  if (!report.rows.length) {
    doc.setFontSize(10).setTextColor('#596579').text('No matching records for the selected filters.', 18, y + 24);
  }
  const count = doc.getNumberOfPages();
  for (let page = 1; page <= count; page++) {
    doc.setPage(page);
    doc.setDrawColor('#dce1e8').line(14, height - 14, width - 14, height - 14);
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor('#596579');
    doc.text('MotoLock | ' + report.title, 14, height - 8);
    doc.text(`${page} / ${count}`, width - 14, height - 8, { align: 'right' });
  }
  return doc;
}

export function buildReportWorkbook(report: ReportSnapshot) {
  const book = new ExcelJS.Workbook();
  book.creator = 'MotoLock';
  book.created = new Date(report.generatedAt);
  book.title = report.title;
  const sheet = book.addWorksheet('Report', {
    properties: { tabColor: { argb: 'FFED1C24' } },
    views: [{ state: 'frozen', ySplit: 7, showGridLines: false }],
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '7:7' },
    headerFooter: { oddFooter: '&LMotoLock&C&P / &N&RReport' },
  });
  const n = report.headers.length;
  const banner = (row: number, text: string, size: number, background: string, color: string) => {
    sheet.mergeCells(row, 1, row, n);
    const cell = sheet.getCell(row, 1);
    cell.value = text;
    cell.font = { name: 'Calibri', size, bold: row <= 2, color: { argb: color } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: background } };
    cell.alignment = { vertical: 'middle', wrapText: true, indent: 1 };
    sheet.getRow(row).height = row === 1 ? 34 : row === 2 ? 32 : 27;
  };
  banner(1, 'MotoLock  /  ADMINISTRATION & REPORTS', 19, 'FF202938', 'FFFFFFFF');
  banner(2, report.title, 16, 'FFED1C24', 'FFFFFFFF');
  banner(3, `Coverage: ${report.coverage}`, 11, 'FFF1F4F8', 'FF202938');
  banner(4, report.filters, 11, 'FFF1F4F8', 'FF202938');
  banner(5, `Generated: ${reportDate(report.generatedAt)}  |  ${report.rows.length} matching records`, 11, 'FFF1F4F8', 'FF596579');
  sheet.getRow(6).height = 10;
  sheet.getRow(7).values = report.headers;
  sheet.getRow(7).height = 28;
  sheet.getRow(7).eachCell(cell => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF202938' } };
    cell.alignment = { vertical: 'middle', wrapText: true, indent: 1 };
  });
  report.headers.forEach((header, index) => {
    const longest = Math.max(header.length, ...report.rows.map(row => row[index].length));
    sheet.getColumn(index + 1).width = Math.min(64, Math.max(20, longest + 4));
  });
  report.rows.forEach((values, index) => {
    const row = sheet.addRow(values);
    let lines = 1;
    row.eachCell((cell, column) => {
      const color = reportCellColor(String(cell.value));
      cell.font = { name: 'Calibri', size: 11, bold: !!color, color: { argb: color ? 'FF' + color.slice(1).toUpperCase() : 'FF202938' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index % 2 ? 'FFF1F4F8' : 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', wrapText: true, indent: 1 };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFDCE1E8' } } };
      // Strings preserve the exact preview text, masked phones, zeros, and timezone.
      cell.numFmt = '@';
      lines = Math.max(lines, Math.ceil(String(cell.value).length / ((sheet.getColumn(column).width || 20) - 4)));
    });
    row.height = Math.max(28, lines * 16 + 10);
  });
  sheet.autoFilter = { from: { row: 7, column: 1 }, to: { row: 7 + report.rows.length, column: n } };
  if (!report.rows.length) banner(8, 'No matching records for the selected filters.', 11, 'FFF1F4F8', 'FF596579');
  return book;
}

export async function downloadReport(report: ReportSnapshot, format: 'pdf' | 'excel') {
  const filename = `MotoLock_${report.type}_${report.generatedAt.slice(0, 10)}`;
  if (format === 'pdf') {
    buildReportPdf(report).save(filename + '.pdf');
    return;
  }
  const bytes = await buildReportWorkbook(report).xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename + '.xlsx';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
