import { Response } from 'express';
import ExcelJS from 'exceljs';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { AuthRequest } from '../middleware/auth.js';
import { HierarchyService } from '../services/HierarchyService.js';
import { ReportService, ReportFilter } from '../services/ReportService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseFilter(query: AuthRequest['query']): ReportFilter {
  return {
    period_type: query.period_type as ReportFilter['period_type'],
    start_date: (query.start_date as string) || new Date(new Date().setDate(1)).toISOString().slice(0, 10),
    end_date: (query.end_date as string) || new Date().toISOString().slice(0, 10),
    scope: query.scope as ReportFilter['scope'],
    user_ids: query.user_ids
      ? String(query.user_ids).split(',').map(Number)
      : undefined,
    division_ids: query.division_ids
      ? String(query.division_ids).split(',').map(Number)
      : undefined,
    activity_type_ids: query.activity_type_ids
      ? String(query.activity_type_ids).split(',').map(Number)
      : undefined,
    statuses: query.statuses ? String(query.statuses).split(',') : undefined,
  };
}

async function me(req: AuthRequest) {
  return HierarchyService.getUserWithScope(req.user!.id);
}

export const getDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const user = await me(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const data = await ReportService.dashboardStats(user, {
      start_date: req.query.start_date as string | undefined,
      end_date: req.query.end_date as string | undefined,
    });
    return res.json({ success: true, data });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const runReport = async (req: AuthRequest, res: Response) => {
  try {
    const user = await me(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const type = req.params.type;
    const filter = parseFilter(req.query);

    let data;
    switch (type) {
      case 'individual':
        data = await ReportService.individual(user, filter);
        break;
      case 'division':
        data = await ReportService.divisionSummary(user, filter);
        break;
      case 'department':
        data = await ReportService.departmentSummary(user, filter);
        break;
      case 'meetings':
        data = await ReportService.meetingsRegister(user, filter);
        break;
      case 'compliance':
        data = await ReportService.compliance(user, filter);
        break;
      default:
        return res.status(400).json({ error: 'Unknown report type' });
    }
    return res.json({ success: true, data, filter });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const exportExcel = async (req: AuthRequest, res: Response) => {
  try {
    const user = await me(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const type = req.params.type;
    const filter = parseFilter(req.query);
    const report =
      type === 'division'
        ? await ReportService.divisionSummary(user, filter)
        : type === 'department'
          ? await ReportService.departmentSummary(user, filter)
          : type === 'compliance'
            ? await ReportService.compliance(user, filter)
            : await ReportService.individual(user, filter);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('TVED Report');
    sheet.addRow(['TVED Activity & Task Tracking System']);
    sheet.addRow([`Period: ${filter.start_date} → ${filter.end_date}`]);
    sheet.addRow([]);

    const rows = report.rows as Record<string, unknown>[];
    if (rows.length) {
      const keys = Object.keys(rows[0]).filter((k) => k !== 'participants');
      sheet.addRow(keys);
      for (const row of rows) {
        sheet.addRow(keys.map((k) => row[k] as string | number | boolean | null));
      }
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="tved-${type}-report.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const exportPdf = async (req: AuthRequest, res: Response) => {
  try {
    const user = await me(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const filter = parseFilter(req.query);
    const report = await ReportService.individual(user, filter);

    const fontCandidates = [
      path.resolve(__dirname, '../../fonts/NotoSansLao-Regular.ttf'),
      path.resolve(__dirname, '../../../public/fonts/NotoSansLao-Regular.ttf'),
    ];
    const fontPath = fontCandidates.find((p) => fs.existsSync(p));
    const fontFace = `
      ${fontPath ? `@font-face { font-family: 'NotoSansLao'; src: url('file://${fontPath}'); }` : ''}
      body { font-family: 'NotoSansLao', 'Noto Sans Lao', 'Noto Sans', sans-serif; font-size: 12px; line-height: 1.8; }
      h1 { font-size: 18px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ccc; padding: 6px; text-align: left; overflow-wrap: anywhere; }
    `;

    const rowsHtml = report.rows
      .map(
        (r: any) => `<tr>
          <td>${r.start_date}</td>
          <td>${r.type_name_lo || r.type_name_en || ''}</td>
          <td>${r.title_lo}</td>
          <td>${((r.duration_minutes || 0) / 60).toFixed(1)}h</td>
          <td>${r.status}</td>
        </tr>`
      )
      .join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${fontFace}</style></head>
      <body>
        <h1>ລະບົບຕິດຕາມກິດຈະກຳ TVED</h1>
        <p>TVED Activity Report — ${filter.start_date} → ${filter.end_date}</p>
        <p>ລວມຊົ່ວໂມງ: ${report.total_hours}</p>
        <table>
          <thead><tr><th>ວັນທີ</th><th>ປະເພດ</th><th>ຫົວຂໍ້</th><th>ຊົ່ວໂມງ</th><th>ສະຖານະ</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body></html>`;

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="tved-report.pdf"');
    return res.send(Buffer.from(pdf));
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      error: 'PDF generation failed. Ensure Chromium dependencies are available.',
      message: e instanceof Error ? e.message : String(e),
    });
  }
};
